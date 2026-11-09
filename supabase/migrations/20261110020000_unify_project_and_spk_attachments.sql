-- ============================================================================
-- Migration: 20261110020000_unify_project_and_spk_attachments.sql
-- Tujuan:
-- 1. Sinkronisasi otomatis lampiran SPK/SPH ke crm_projects jika attachment_ids proyek kosong.
-- 2. Perbarui sales_attachment_reader agar Direktur & pengakses proyek dapat membaca
--    procurement_attachments yang tertaut ke crm_projects.attachment_ids.
-- 3. Izinkan pratinjau dan unduh berkas lampiran proyek di storage.
-- ============================================================================

-- 1. Perbarui fungsi sales_attachment_reader agar mendukung crm_projects
create or replace function gsp_private.sales_attachment_reader(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.procurement_attachments a
    where a.id = p_id
      and (
        -- Pembuat / pengunggah berkas
        a.uploaded_by = auth.uid()

        -- Pengguna adalah Direksi (Dirut, Direktur Keuangan, Direktur Teknis) atau Owner
        or exists(
          select 1 from public.work_assignments j
          where j.user_id = auth.uid()
            and j.organization_id = a.organization_id
            and (j.branch_id is null or j.branch_id = a.branch_id)
            and j.job_role in ('owner', 'president', 'finance_director', 'technical_director', 'branch_manager')
        )

        -- Tertaut ke dokumen penjualan SPH / SPK
        or exists(
          select 1 from public.sales_documents d
          where d.organization_id = a.organization_id
            and a.id = any(d.attachment_ids)
            and (
              d.kind = 'spk'
              or d.status <> 'draft'
              or gsp_private.sales_client_reader(d.organization_id)
              or gsp_private.sales_document_reader(d.organization_id, d.branch_id)
            )
        )

        -- Tertaut ke perencanaan proyek (crm_projects)
        or exists(
          select 1 from public.crm_projects p
          where p.organization_id = a.organization_id
            and (
              a.id = any(p.attachment_ids)
              or exists(
                select 1 from public.sales_documents sd
                where sd.id = p.spk_id and a.id = any(sd.attachment_ids)
              )
            )
            and (
              gsp_private.can_decide_project(p)
              or gsp_private.can_review_project(p)
              or gsp_private.can_access_business(p.organization_id, p.branch_id, 'sales')
              or gsp_private.can_access_business(p.organization_id, p.branch_id, 'procurement')
            )
        )
      )
  );
$$;

create or replace function public.can_read_sales_attachment(p_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$
  select gsp_private.sales_attachment_reader(p_id);
$$;

-- 2. Sinkronkan lampiran SPK yang sudah ada ke crm_projects yang attachment_ids-nya masih kosong
update public.crm_projects p
set attachment_ids = coalesce(sd.attachment_ids, '{}')
from public.sales_documents sd
where p.spk_id = sd.id
  and (p.attachment_ids is null or cardinality(p.attachment_ids) = 0)
  and sd.attachment_ids is not null
  and cardinality(sd.attachment_ids) > 0;

-- 3. Perbarui juga fungsi pembuatan crm_projects saat SPK disetujui agar otomatis mewarisi attachment_ids SPK
create or replace function gsp_private.api_decide_spk(
  p_id uuid,
  p_version integer,
  p_decision text,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  d public.sales_documents;
  v_next_status text;
  v_proj_id uuid;
  v_proj_code text;
  v_amount numeric(15,2);
  b public.business_units;
  c public.sales_clients;
  v_attachments uuid[];
begin
  select * into d from public.sales_documents where id = p_id for update;
  if d.id is null or d.kind <> 'spk' or not gsp_private.spk_reviewer(d.organization_id) then
    raise exception 'Akses verifikasi SPK ditolak.' using errcode = '42501';
  end if;
  if d.version is distinct from p_version then
    raise exception 'Versi SPK telah berubah. Muat ulang halaman dan periksa kembali.';
  end if;
  if d.status <> 'director_review' then
    raise exception 'Hanya SPK berstatus director_review yang dapat diputuskan.';
  end if;

  if p_decision = 'approve' then
    v_next_status := 'ready';
    v_amount := coalesce(d.amount, 0);

    select * into b from public.business_units where id = d.branch_id;
    select * into c from public.sales_clients where id = d.client_id;

    v_proj_code := gsp_private.generate_document_code(
      d.organization_id, 'prj', current_date, c.name, b.code, null
    );

    v_attachments := coalesce(d.attachment_ids, '{}');

    insert into public.crm_projects(
      organization_id, code, name, status, starts_on, created_by,
      client_id, spk_id, branch_id, contract_amount, approval_status, work_details,
      attachment_ids
    ) values (
      d.organization_id, v_proj_code, d.title, 'planned', current_date, auth.uid(),
      d.client_id, d.id, d.branch_id, v_amount, 'draft',
      'Diterbitkan dari SPK ' || coalesce(d.document_number, 'SPK') || ' atas SPH No. ' || coalesce(d.sph_number::text, '-'),
      v_attachments
    ) returning id into v_proj_id;

    update public.sales_documents
    set status = v_next_status,
        project_id = v_proj_id,
        return_to_stage = null,
        review_note = nullif(btrim(p_note), ''),
        version = version + 1
    where id = d.id;

    perform gsp_private.procurement_log(
      d.organization_id, d.branch_id, d.id, 'spk', 'approved', p_note,
      jsonb_build_object('project_id', v_proj_id, 'project_code', v_proj_code, 'status', v_next_status)
    );

    return v_proj_id;

  elsif p_decision = 'revise' then
    if nullif(btrim(p_note), '') is null then
      raise exception 'Catatan revisi wajib diisi.';
    end if;
    v_next_status := 'revision_requested';

    update public.sales_documents
    set status = v_next_status,
        return_to_stage = 'branch_entry',
        review_note = btrim(p_note),
        version = version + 1
    where id = d.id;

    perform gsp_private.procurement_log(
      d.organization_id, d.branch_id, d.id, 'spk', 'revision_requested', p_note,
      jsonb_build_object('status', v_next_status)
    );
    return null;

  elsif p_decision = 'reject' then
    if nullif(btrim(p_note), '') is null then
      raise exception 'Alasan penolakan wajib diisi.';
    end if;
    v_next_status := 'rejected';

    update public.sales_documents
    set status = v_next_status,
        return_to_stage = null,
        review_note = btrim(p_note),
        version = version + 1
    where id = d.id;

    perform gsp_private.procurement_log(
      d.organization_id, d.branch_id, d.id, 'spk', 'rejected', p_note,
      jsonb_build_object('status', v_next_status)
    );
    return null;

  else
    raise exception 'Keputusan tidak valid: %', p_decision;
  end if;
end $$;
