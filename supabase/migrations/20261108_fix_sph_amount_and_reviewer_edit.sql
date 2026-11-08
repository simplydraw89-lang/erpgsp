-- Migration: 20261108_fix_sph_amount_and_reviewer_edit.sql
-- 1. Memperbaiki penyimpanan kolom amount (Nilai SPH) yang sebelumnya tidak disertakan pada INSERT dan UPDATE
-- 2. Mengizinkan Manager Cabang dan Direktur (pemeriksa) untuk melakukan EDIT langsung pada dokumen SPH
-- 3. Mencatat setiap aksi edit oleh pemeriksa ke audit trail (procurement_events)

create or replace function gsp_private.api_save_sph_request(
  p_org uuid,
  p_branch uuid,
  p_payload jsonb,
  p_id uuid default null,
  p_version integer default null,
  p_submit boolean default false
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  d public.sales_documents;
  c public.sales_clients;
  i uuid;
  attachments uuid[];
  scopes text[];
  next_status text;
  snapshot jsonb;
  v_amount numeric;
  v_is_reviewer boolean := false;
  v_is_creator boolean := false;
  v_is_owner boolean := false;
begin
  if not gsp_private.sales_client_reader(p_org) or not gsp_private.can_access_business(p_org, p_branch, 'sales') then
    raise exception 'Akses pengajuan SPH cabang ditolak.' using errcode = '42501';
  end if;

  if not exists(select 1 from public.business_units where id = p_branch and organization_id = p_org and kind in ('branch', 'center')) then
    raise exception 'Pilih cabang operasional yang diizinkan.';
  end if;

  if p_id is not null then
    select * into d from public.sales_documents where id = p_id for update;
  end if;

  if d.id is not null then
    v_is_owner := gsp_private.is_superadmin(p_org);
    v_is_creator := (d.created_by = auth.uid());
    v_is_reviewer := gsp_private.can_review_sph(d);

    if d.organization_id <> p_org or d.branch_id <> p_branch or d.kind <> 'sph' then
      raise exception 'Cabang atau organisasi SPH tidak sesuai.' using errcode = '42501';
    end if;

    if not (v_is_creator or v_is_reviewer or v_is_owner) then
      raise exception 'Anda tidak memiliki hak untuk mengubah SPH ini.' using errcode = '42501';
    end if;

    if d.version is distinct from p_version then
      raise exception 'Versi SPH sudah berubah. Muat ulang formulir.';
    end if;

    -- Pengaju biasa hanya boleh mengubah saat draft atau revisi
    if v_is_creator and not (v_is_reviewer or v_is_owner) and d.status not in ('draft', 'rejected', 'revision_requested') then
      raise exception 'Dokumen SPH sedang dalam peninjauan dan terkunci.';
    end if;
  elsif p_version is not null then
    raise exception 'Draft SPH tidak ditemukan.';
  end if;

  select * into c from public.sales_clients where id = nullif(p_payload->>'client_id', '')::uuid and organization_id = p_org;
  if c.id is null then
    raise exception 'Klien tidak ditemukan pada perusahaan ini.';
  end if;

  if nullif(btrim(p_payload->>'title'), '') is null or length(p_payload->>'title') > 300 then
    raise exception 'Judul penawaran wajib diisi, maksimal 300 karakter.';
  end if;

  select coalesce(array_agg(value::uuid), '{}') into attachments
  from jsonb_array_elements_text(coalesce(p_payload->'attachment_ids', '[]'));
  perform gsp_private.validate_sales_attachments(p_org, p_branch, attachments);

  if d.id is not null and not d.attachment_ids <@ attachments then
    raise exception 'Lampiran tersimpan tidak boleh dihapus.';
  end if;

  select coalesce(array_agg(value), '{}') into scopes
  from jsonb_array_elements_text(coalesce(p_payload->'work_scopes', '[]'));

  if not scopes <@ array['Pertek','UKL/UPL','Amdal','DELH','DPLH','Andalalin','LB 3','Lainnya']::text[] or cardinality(scopes) <> (select count(distinct x) from unnest(scopes) x) then
    raise exception 'Lingkup pekerjaan tidak valid atau duplikat.';
  end if;

  v_amount := nullif(regexp_replace(coalesce(p_payload->>'amount', ''), '[^0-9.]', '', 'g'), '')::numeric;

  if coalesce(p_submit, false) then
    if (p_payload->>'confirmed')::boolean is distinct from true then
      raise exception 'Konfirmasi kebenaran data sebelum mengajukan SPH.';
    end if;

    if nullif(btrim(p_payload->>'work_area'), '') is null or cardinality(scopes) = 0 or nullif(p_payload->>'deal_status', '') is null or nullif(p_payload->>'valid_until', '') is null then
      raise exception 'Lengkapi daerah pengerjaan, lingkup, status deal dan masa berlaku sebelum submit.';
    end if;

    if v_amount is null or v_amount <= 0 then
      raise exception 'Nilai SPH wajib diisi dengan nominal positif sebelum submit.';
    end if;

    if (p_payload->>'valid_until')::date < (now() at time zone 'Asia/Bangkok')::date then
      raise exception 'Masa berlaku SPH sudah berakhir.';
    end if;

    if c.email is null or c.phone is null or c.industry not in ('Mining','Migas','Industri','Umum') or length(regexp_replace(coalesce(c.npwp,''),'[^0-9]','','g')) not in (15,16) then
      raise exception 'Lengkapi identitas klien yang valid sebelum submit SPH.';
    end if;
  end if;

  snapshot := jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'address', c.address,
    'npwp', c.npwp,
    'phone', c.phone,
    'email', c.email,
    'industry', c.industry
  );

  if d.id is null then
    i := coalesce(p_id, gen_random_uuid());
    insert into public.sales_documents(
      id, organization_id, branch_id, client_id, kind, title, source,
      amount, notes, attachment_ids, work_area, work_scopes, deal_status,
      valid_until, client_snapshot, created_by
    )
    values(
      i, p_org, p_branch, c.id, 'sph', btrim(p_payload->>'title'), 'company',
      v_amount, nullif(btrim(p_payload->>'notes'), ''), attachments,
      nullif(btrim(p_payload->>'work_area'), ''), scopes,
      nullif(p_payload->>'deal_status', ''), nullif(p_payload->>'valid_until', '')::date,
      snapshot, auth.uid()
    );
    perform gsp_private.procurement_log(p_org, p_branch, i, 'sph', 'draft_created');
  else
    i := d.id;
    update public.sales_documents
    set client_id = c.id,
        title = btrim(p_payload->>'title'),
        amount = coalesce(v_amount, amount),
        notes = nullif(btrim(p_payload->>'notes'), ''),
        attachment_ids = attachments,
        work_area = nullif(btrim(p_payload->>'work_area'), ''),
        work_scopes = scopes,
        deal_status = nullif(p_payload->>'deal_status', ''),
        valid_until = nullif(p_payload->>'valid_until', '')::date,
        client_snapshot = snapshot,
        status = case when (v_is_reviewer or v_is_owner) then d.status else 'draft' end,
        version = version + 1
    where id = i;

    if v_is_reviewer or v_is_owner then
      perform gsp_private.procurement_log(
        p_org, p_branch, i, 'sph', 'reviewer_edited',
        'Pemeriksa (Manager/Direktur) memperbarui data SPH secara langsung.',
        jsonb_build_object('amount', v_amount, 'title', p_payload->>'title', 'actor_id', auth.uid())
      );
    else
      perform gsp_private.procurement_log(p_org, p_branch, i, 'sph', 'draft_updated');
    end if;
  end if;

  if coalesce(p_submit, false) and not (v_is_reviewer or v_is_owner) then
    next_status := case
      when exists(
        select 1 from public.work_assignments
        where organization_id = p_org and user_id = auth.uid()
        and (branch_id = p_branch or branch_id is null)
        and job_role in ('branch_manager', 'president', 'finance_director', 'technical_director')
      ) or exists(
        select 1 from public.business_units where id = p_branch and kind = 'center'
      ) then 'director_review'
      else 'branch_review'
    end;
    update public.sales_documents set status = next_status, submitted_at = now(), version = version + 1 where id = i;
    perform gsp_private.procurement_log(p_org, p_branch, i, 'sph', 'submitted', null, jsonb_build_object('next_status', next_status, 'confirmed', true));
  end if;

  return i;
end;
$$;

grant execute on function public.save_sph_request(uuid, uuid, jsonb, uuid, integer, boolean) to authenticated;
notify pgrst, 'reload schema';
