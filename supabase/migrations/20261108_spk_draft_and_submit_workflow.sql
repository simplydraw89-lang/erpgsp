-- ============================================================================
-- 20261108_spk_draft_and_submit_workflow.sql
-- Alur SPK Terpisah: Simpan Draft SPK vs Kirim Pengajuan SPK ke Direktur
-- Termasuk notifikasi lonceng untuk SPK dan SPH
-- ============================================================================

-- 1. Perbarui api_save_sales_document agar membedakan Simpan Draft dan Kirim Pengajuan
create or replace function gsp_private.api_save_sales_document(p_org uuid, p_branch uuid, p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  d public.sales_documents;
  c public.sales_clients;
  i uuid;
  attachments uuid[];
  v_spk_number text;
  v_is_submit boolean;
  v_status text;
begin
  if p_payload->>'kind' is distinct from 'spk' then
    return gsp_private.api_save_sales_document_base(p_org, p_branch, p_payload);
  end if;

  select * into d from public.sales_documents
  where id = nullif(p_payload->>'accepted_sph_id', '')::uuid and organization_id = p_org for update;
  if d.id is null or not gsp_private.sph_spk_creator(d) or d.branch_id <> p_branch or d.client_id is distinct from nullif(p_payload->>'client_id', '')::uuid then
    raise exception 'SPK wajib merujuk SPH klien/cabang yang sudah disetujui Direktur Keuangan.' using errcode = '42501';
  end if;
  if nullif(btrim(p_payload->>'title'), '') is null then
    raise exception 'Judul SPK wajib diisi.';
  end if;

  select * into c from public.sales_clients where id = d.client_id and organization_id = p_org;

  select coalesce(array_agg(value::uuid), '{}') into attachments
  from jsonb_array_elements_text(coalesce(p_payload->'attachment_ids', '[]'));
  perform gsp_private.validate_sales_attachments(p_org, p_branch, attachments);

  v_spk_number := gsp_private.generate_document_number(p_org, 'spk', current_date, c.name, null, null);

  -- Periksa apakah pengaju memilih simpan draft atau kirim pengajuan langsung ke Direktur
  v_is_submit := coalesce((p_payload->>'submit')::boolean, p_payload->>'intent' = 'submit', false);
  v_status := case when v_is_submit then 'director_review' else 'draft' end;

  insert into public.sales_documents(
    organization_id, branch_id, client_id, kind, title, source,
    accepted_sph_id, notes, attachment_ids, client_snapshot, created_by,
    status, document_number
  )
  values(
    p_org, p_branch, d.client_id, 'spk', btrim(p_payload->>'title'),
    coalesce(p_payload->>'source', 'company'), d.id, p_payload->>'notes',
    attachments, d.client_snapshot, auth.uid(),
    v_status, v_spk_number
  ) returning id into i;

  perform gsp_private.procurement_log(
    p_org, p_branch, i, 'spk',
    case when v_is_submit then 'submitted_to_director' else 'draft_created' end,
    null,
    jsonb_build_object('document_number', v_spk_number, 'status', v_status)
  );

  return i;
end$$;

-- 2. Perbarui api_update_spk_document agar mendukung pengajuan saat edit draft
create or replace function gsp_private.api_update_spk_document(
  p_id uuid,
  p_version integer,
  p_payload jsonb
) returns void
language plpgsql security definer set search_path='' as $$
declare
  d public.sales_documents;
  attachments uuid[];
  v_is_submit boolean;
  v_next_status text;
begin
  select * into d from public.sales_documents where id = p_id for update;
  if d.id is null or not gsp_private.can_edit_spk(d) then
    raise exception 'Akses edit SPK ditolak atau status SPK sudah terkunci.' using errcode = '42501';
  end if;
  if d.version is distinct from p_version then
    raise exception 'Versi SPK telah berubah. Muat ulang halaman dan periksa kembali.';
  end if;
  if nullif(btrim(p_payload->>'title'), '') is null then
    raise exception 'Judul SPK wajib diisi.';
  end if;

  select coalesce(array_agg(value::uuid), '{}') into attachments
  from jsonb_array_elements_text(coalesce(p_payload->'attachment_ids', '[]'));
  perform gsp_private.validate_sales_attachments(d.organization_id, d.branch_id, attachments);

  v_is_submit := coalesce((p_payload->>'submit')::boolean, p_payload->>'intent' = 'submit', false);
  v_next_status := d.status;
  if v_is_submit and d.status in ('draft', 'revision_requested') then
    v_next_status := 'director_review';
  end if;

  update public.sales_documents
  set title = btrim(p_payload->>'title'),
      source = coalesce(p_payload->>'source', d.source),
      notes = nullif(btrim(p_payload->>'notes'), ''),
      attachment_ids = attachments,
      status = v_next_status,
      version = version + 1
  where id = d.id;

  perform gsp_private.procurement_log(
    d.organization_id, d.branch_id, d.id, 'spk',
    case when v_is_submit and d.status in ('draft', 'revision_requested') then 'submitted_to_director' else 'updated' end,
    null,
    jsonb_build_object('edited_by', auth.uid(), 'version', d.version + 1, 'status', v_next_status)
  );
end;
$$;

-- 3. Fungsi API khusus submit SPK draft ke Direktur
create or replace function gsp_private.api_submit_sales_spk(
  p_id uuid,
  p_version integer
) returns void
language plpgsql security definer set search_path='' as $$
declare
  d public.sales_documents;
begin
  select * into d from public.sales_documents where id = p_id for update;
  if d.id is null or not gsp_private.can_edit_spk(d) then
    raise exception 'Akses ajukan SPK ditolak.' using errcode = '42501';
  end if;
  if d.version is distinct from p_version then
    raise exception 'Versi SPK telah berubah. Muat ulang halaman dan periksa kembali.';
  end if;
  if d.status not in ('draft', 'revision_requested') then
    raise exception 'Hanya SPK draft atau perlu revisi yang dapat diajukan.';
  end if;

  update public.sales_documents
  set status = 'director_review',
      version = version + 1
  where id = d.id;

  perform gsp_private.procurement_log(
    d.organization_id, d.branch_id, d.id, 'spk', 'submitted_to_director', null,
    jsonb_build_object('submitted_by', auth.uid(), 'version', d.version + 1, 'status', 'director_review')
  );
end;
$$;

create or replace function public.submit_sales_spk(
  p_id uuid,
  p_version integer
) returns void
language sql security invoker set search_path='' as $$
  select gsp_private.api_submit_sales_spk(p_id, p_version);
$$;

grant execute on function public.submit_sales_spk(uuid, integer) to authenticated;

-- 4. Notifikasi Terpadu (SPH & SPK) untuk icon lonceng
create or replace function gsp_private.api_sales_notifications(p_org uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with items as (
  -- SPH
  select d.id, 'sph'::text as kind, d.sph_number, d.document_number, d.status, d.review_note, d.created_at,
   case when gsp_private.can_review_sph(d) then 'approval' else 'follow_up' end category,
   case when gsp_private.can_review_sph(d) then 'Butuh persetujuan SPH' else 'SPH perlu tindak lanjut' end label
  from public.sales_documents d where d.organization_id=p_org and d.kind='sph' and gsp_private.sales_internal_member(p_org)
  and (gsp_private.can_review_sph(d) or (d.created_by=auth.uid() and gsp_private.sph_opener(d) and d.status in ('revision_requested','rejected','ready') and not exists(select 1 from public.sales_documents s where s.kind='spk' and s.accepted_sph_id=d.id)))

  union all

  -- SPK
  select d.id, 'spk'::text as kind, d.sph_number, d.document_number, d.status, d.review_note, d.created_at,
   case when gsp_private.can_review_spk(d) then 'approval' else 'follow_up' end category,
   case when gsp_private.can_review_spk(d) then 'Validasi SPK Direktur'
        when d.status = 'revision_requested' then 'SPK perlu revisi'
        when d.status = 'ready' then 'SPK telah disetujui (Proyek Aktif)'
        else 'SPK perlu tindak lanjut' end label
  from public.sales_documents d where d.organization_id=p_org and d.kind='spk' and gsp_private.sales_internal_member(p_org)
  and (gsp_private.can_review_spk(d) or (d.created_by=auth.uid() and d.status in ('revision_requested', 'rejected', 'ready')))
 ) select jsonb_build_object('total',count(*),'items',coalesce((select jsonb_agg(x order by x.created_at desc) from (select * from items order by created_at desc limit 100)x),'[]')) from items
$$;

-- 5. Penyelarasan Pendaftaran Klien Lintas Cabang (Pusat & Seluruh Cabang)
create or replace function public.save_sales_client(p_org uuid, p_branch uuid, p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  i uuid;
  v_branch uuid := p_branch;
  v_contact text;
  v_client_code text;
begin
  -- Otomatis gunakan cabang dari penugasan pengguna jika p_branch null
  if v_branch is null then
    select branch_id into v_branch
    from public.work_assignments
    where organization_id = p_org and user_id = auth.uid() and branch_id is not null
    limit 1;
    if v_branch is null then
      select id into v_branch
      from public.business_units
      where organization_id = p_org and kind in ('center', 'branch')
      order by case when kind = 'center' then 1 else 2 end
      limit 1;
    end if;
  end if;

  if not (
    gsp_private.is_superadmin(p_org)
    or gsp_private.can_access_business(p_org, v_branch, 'sales')
    or gsp_private.sales_internal_member(p_org)
    or exists (
      select 1 from public.work_assignments w
      where w.organization_id = p_org and w.user_id = auth.uid()
    )
  ) then
    raise exception 'Akses klien cabang ditolak.' using errcode = '42501';
  end if;

  if not exists(select 1 from public.business_units where id = v_branch and organization_id = p_org and kind in ('branch', 'center')) then
    raise exception 'Cabang tidak valid.';
  end if;

  v_contact := btrim(coalesce(p_payload->>'phone', p_payload->>'contact', ''));

  if nullif(btrim(p_payload->>'name'), '') is null or nullif(btrim(p_payload->>'address'), '') is null
     or nullif(v_contact, '') is null or nullif(btrim(p_payload->>'industry'), '') is null then
    raise exception 'Nama PT, alamat, kontak, dan bidang usaha wajib diisi.';
  end if;

  begin
    v_client_code := gsp_private.generate_document_number(p_org, 'client', current_date, null, null, null);
  exception when others then
    v_client_code := null;
  end;

  insert into public.sales_clients(
    organization_id, branch_id, name, address, npwp, contact, phone, email,
    industry, additional_information, created_by, client_code
  )
  values (
    p_org, v_branch, btrim(p_payload->>'name'), btrim(p_payload->>'address'),
    nullif(btrim(p_payload->>'npwp'), ''),
    v_contact, v_contact, lower(nullif(btrim(p_payload->>'email'), '')),
    p_payload->>'industry',
    nullif(btrim(p_payload->>'additional_information'), ''),
    auth.uid(), v_client_code
  )
  returning id into i;

  perform gsp_private.procurement_log(
    p_org, v_branch, i, 'client', 'created', null,
    jsonb_build_object('shared_company_directory', true, 'client_code', v_client_code)
  );

  return i;
end $$;

grant execute on function public.save_sales_client(uuid, uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
