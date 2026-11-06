-- 20261107_allow_admin_create_spk.sql
-- Izinkan pembuat SPH, Admin cabang, dan role penjualan cabang untuk membuat SPK dari SPH yang telah disetujui (ready / accepted).
-- Izinkan juga pembukaan SPH yang telah berstatus ready/accepted oleh staf cabang yang berwenang.

-- 1. Perbarui sph_spk_creator agar tidak mengunci d.created_by = auth.uid() saja
create or replace function gsp_private.sph_spk_creator(d public.sales_documents) returns boolean
language sql stable security definer set search_path='' as $$
  select d.kind = 'sph'
  and d.status in ('ready', 'accepted')
  and gsp_private.sales_client_reader(d.organization_id)
  and (
    d.created_by = auth.uid()
    or gsp_private.is_superadmin(d.organization_id)
    or gsp_private.can_access_business(d.organization_id, d.branch_id, 'sales')
  );
$$;

-- 2. Perbarui sph_opener agar staf berwenang cabang dapat membaca SPH yang telah disetujui
create or replace function gsp_private.sph_opener(d public.sales_documents) returns boolean
language sql stable security definer set search_path='' as $$
  select gsp_private.is_superadmin(d.organization_id)
  or (d.created_by = auth.uid() and gsp_private.sales_document_reader(d.organization_id, d.branch_id))
  or gsp_private.can_review_sph(d)
  or (d.status in ('ready', 'accepted') and gsp_private.sales_document_reader(d.organization_id, d.branch_id));
$$;

-- 3. Perbarui api_sph_spk_context untuk menyertakan client_id dan pesan error yang ramah
create or replace function gsp_private.api_sph_spk_context(p_org uuid, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d public.sales_documents;
begin
  select * into d from public.sales_documents where organization_id = p_org and id = p_id;
  if d.id is null or not gsp_private.sph_spk_creator(d) then
    raise exception 'SPK hanya dapat dibuat setelah SPH disetujui Direktur Keuangan.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'id', d.id,
    'sph_number', d.sph_number,
    'title', d.title,
    'branch_id', d.branch_id,
    'client_id', d.client_id,
    'client_name', d.client_snapshot->>'name',
    'amount', d.amount
  );
end$$;

-- 4. Perbarui api_save_sales_document dengan pesan error yang konsisten
create or replace function gsp_private.api_save_sales_document(p_org uuid, p_branch uuid, p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  d public.sales_documents;
  i uuid;
  attachments uuid[];
begin
  if p_payload->>'kind' is distinct from 'spk' then
    return gsp_private.api_save_sales_document_base(p_org, p_branch, p_payload);
  end if;
  select * into d from public.sales_documents where id = nullif(p_payload->>'accepted_sph_id', '')::uuid and organization_id = p_org for update;
  if d.id is null or not gsp_private.sph_spk_creator(d) or d.branch_id <> p_branch or d.client_id is distinct from nullif(p_payload->>'client_id', '')::uuid then
    raise exception 'SPK wajib merujuk SPH klien/cabang yang sudah disetujui Direktur Keuangan.' using errcode = '42501';
  end if;
  if nullif(btrim(p_payload->>'title'), '') is null then
    raise exception 'Judul SPK wajib diisi.';
  end if;
  select coalesce(array_agg(value::uuid), '{}') into attachments from jsonb_array_elements_text(coalesce(p_payload->'attachment_ids', '[]'));
  perform gsp_private.validate_sales_attachments(p_org, p_branch, attachments);
  insert into public.sales_documents(
    organization_id, branch_id, client_id, kind, title, source,
    accepted_sph_id, notes, attachment_ids, client_snapshot, created_by
  )
  values(
    p_org, p_branch, d.client_id, 'spk', btrim(p_payload->>'title'),
    coalesce(p_payload->>'source', 'company'), d.id, p_payload->>'notes',
    attachments, d.client_snapshot, auth.uid()
  ) returning id into i;
  perform gsp_private.procurement_log(p_org, p_branch, i, 'spk', 'draft_created');
  return i;
end$$;

-- 5. Berikan grant execute pada authenticated role dan reload schema PostgREST
grant execute on function gsp_private.sph_spk_creator(public.sales_documents) to authenticated;
grant execute on function gsp_private.sph_opener(public.sales_documents) to authenticated;
grant execute on function public.sph_spk_context(uuid, uuid) to authenticated;
grant execute on function public.save_sales_document(uuid, uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
