-- Migration: 20261108_fix_crm_projects_client_fk.sql
-- Memperbaiki constraint foreign key client_id pada public.crm_projects
-- Masalah: crm_projects_client_id_fkey lama merujuk ke public.crm_clients (tabel legacy MVP),
-- padahal seluruh alur SPH, SPK, dan Sales sekarang menggunakan public.sales_clients.
-- Hal ini menyebabkan error: "insert or update on table 'crm_projects' violates foreign key constraint 'crm_projects_client_id_fkey'"
-- saat Direktur Utama menyetujui SPK.

-- 1. Lepas constraint foreign key lama yang merujuk ke crm_clients
alter table public.crm_projects drop constraint if exists crm_projects_client_id_fkey;
alter table public.crm_projects drop constraint if exists crm_projects_client_same_org_fk;

-- 2. Sinkronisasi data crm_clients ke sales_clients jika ada data lama yang belum tersinkron
insert into public.sales_clients (id, organization_id, name, address, contact, industry, created_by)
select c.id, c.organization_id, c.name, coalesce(c.company_name, 'Alamat belum diisi'), coalesce(c.phone, c.email, '-'), 'Umum', c.created_by
from public.crm_clients c
where not exists (select 1 from public.sales_clients s where s.id = c.id)
on conflict do nothing;

-- 3. Bersihkan client_id pada crm_projects jika ada data sampah yang tidak ada di sales_clients
update public.crm_projects
set client_id = null
where client_id is not null
  and not exists (select 1 from public.sales_clients where id = crm_projects.client_id);

-- 4. Pasang foreign key yang sah ke public.sales_clients
alter table public.crm_projects
  add constraint crm_projects_sales_client_fk
  foreign key (client_id)
  references public.sales_clients(id)
  on delete set null;

-- 5. Pastikan api_decide_spk juga mengambil amount dari accepted_sph_id jika amount SPK masih 0
create or replace function gsp_private.api_decide_spk(
  p_id uuid,
  p_version integer,
  p_decision text,
  p_note text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  d public.sales_documents;
  b public.business_units;
  c public.sales_clients;
  v_proj_id uuid;
  v_proj_code text;
  v_next_status text;
  v_amount numeric(15,2);
  v_return_stage text := null;
begin
  select * into d from public.sales_documents where id = p_id for update;
  if d.id is null or not gsp_private.can_review_spk(d) then
    raise exception 'Bukan tahap pemeriksaan SPK Anda atau akses validasi ditolak.' using errcode = '42501';
  end if;
  if d.version is distinct from p_version then
    raise exception 'Versi SPK berubah. Muat ulang dan periksa kembali.';
  end if;
  if p_decision is null or p_decision not in ('approve', 'revise', 'reject') then
    raise exception 'Pilih Setujui, Revisi atau Tolak.';
  end if;
  if p_decision in ('revise', 'reject') and nullif(btrim(p_note), '') is null then
    raise exception 'Alasan revisi atau penolakan wajib diisi.';
  end if;

  if p_decision = 'approve' then
    v_next_status := 'ready';
    select * into b from public.business_units where id = d.branch_id;
    select * into c from public.sales_clients where id = d.client_id;
    v_amount := coalesce(d.amount, 0);

    -- Fallback: jika amount SPK belum tercatat, ambil dari SPH yang disepakati
    if (v_amount is null or v_amount = 0) and d.accepted_sph_id is not null then
      select coalesce(amount, 0) into v_amount from public.sales_documents where id = d.accepted_sph_id;
    end if;

    v_proj_code := gsp_private.generate_document_number(
      d.organization_id, 'prj', current_date, c.name, b.code, null
    );

    insert into public.crm_projects(
      organization_id, code, name, status, starts_on, created_by,
      client_id, spk_id, branch_id, contract_amount, approval_status, work_details
    ) values (
      d.organization_id, v_proj_code, d.title, 'planned', current_date, auth.uid(),
      d.client_id, d.id, d.branch_id, coalesce(v_amount, 0), 'draft',
      'Diterbitkan dari SPK ' || coalesce(d.document_number, 'SPK') || ' atas SPH No. ' || coalesce(d.sph_number::text, '-')
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
    v_next_status := 'revision_requested';
    v_return_stage := 'director_review';

    update public.sales_documents
    set status = v_next_status,
        return_to_stage = v_return_stage,
        review_note = nullif(btrim(p_note), ''),
        version = version + 1
    where id = d.id;

    perform gsp_private.procurement_log(
      d.organization_id, d.branch_id, d.id, 'spk', 'revision_requested', p_note,
      jsonb_build_object('status', v_next_status, 'return_to_stage', v_return_stage)
    );

    return null;

  elsif p_decision = 'reject' then
    v_next_status := 'rejected';

    update public.sales_documents
    set status = v_next_status,
        return_to_stage = null,
        review_note = nullif(btrim(p_note), ''),
        version = version + 1
    where id = d.id;

    perform gsp_private.procurement_log(
      d.organization_id, d.branch_id, d.id, 'spk', 'rejected', p_note,
      jsonb_build_object('status', v_next_status)
    );

    return null;
  end if;

  return null;
end;
$$;

notify pgrst, 'reload schema';
