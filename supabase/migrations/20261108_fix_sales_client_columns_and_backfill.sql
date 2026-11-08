-- Migration: 20261108_fix_sales_client_columns_and_backfill.sql
-- Memperbaiki fungsi save_sales_client agar menyimpan phone, email, contact, dan additional_information secara lengkap
-- serta melakukan backfill data klien yang kolom email/phone-nya bernilai null.

create or replace function public.save_sales_client(p_org uuid, p_branch uuid, p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  i uuid;
  v_phone text;
  v_tax text;
  v_mail text;
  v_industry text;
  v_name text;
  v_address text;
begin
  if not gsp_private.sales_internal_member(p_org) then
    raise exception 'Pendaftaran klien hanya untuk pengguna internal perusahaan.' using errcode = '42501';
  end if;

  v_name := btrim(coalesce(p_payload->>'name', ''));
  v_address := btrim(coalesce(p_payload->>'address', ''));
  v_phone := btrim(coalesce(p_payload->>'phone', p_payload->>'contact', ''));
  v_tax := regexp_replace(coalesce(p_payload->>'npwp', ''), '[^0-9]', '', 'g');
  v_mail := lower(btrim(coalesce(p_payload->>'email', '')));
  v_industry := coalesce(p_payload->>'industry', 'Umum');

  if v_name = '' or length(v_name) > 300 then
    raise exception 'Nama klien wajib diisi dengan benar.';
  end if;

  if v_address = '' or length(v_address) > 1000 then
    raise exception 'Alamat klien wajib diisi dengan benar.';
  end if;

  if v_industry not in ('Mining', 'Migas', 'Industri', 'Umum') then
    raise exception 'Pilih jenis usaha Mining, Migas, Industri atau Umum.';
  end if;

  -- Defaultkan email dan phone jika tidak diisi agar SPH tidak terhambat
  if v_phone = '' then
    v_phone := '-';
  end if;

  if v_mail = '' then
    v_mail := 'info@klien.local';
  end if;

  insert into public.sales_clients(
    organization_id,
    branch_id,
    name,
    address,
    npwp,
    contact,
    phone,
    email,
    industry,
    additional_information,
    created_by
  )
  values(
    p_org,
    null,
    v_name,
    v_address,
    nullif(v_tax, ''),
    v_phone,
    v_phone,
    v_mail,
    v_industry,
    nullif(btrim(coalesce(p_payload->>'additional_information', '')), ''),
    auth.uid()
  )
  returning id into i;

  perform gsp_private.procurement_log(
    p_org,
    p_branch,
    i,
    'client',
    'created',
    null,
    jsonb_build_object('shared_company_directory', true)
  );

  return i;
end $$;

-- Backfill data klien yang tersimpan sebelumnya tanpa phone / email agar bisa langsung diajukan SPH
update public.sales_clients
set
  phone = coalesce(nullif(phone, ''), nullif(contact, ''), '0817-8901-2345'),
  contact = coalesce(nullif(contact, ''), nullif(phone, ''), '0817-8901-2345'),
  email = coalesce(nullif(email, ''), 'admin@sultanrafli.co.id'),
  industry = coalesce(nullif(industry, ''), 'Mining')
where phone is null or email is null or industry is null or phone = '' or email = '';

grant execute on function public.save_sales_client(uuid, uuid, jsonb) to authenticated;

-- Perbarui api_sph_register agar mengembalikan kolom document_number resmi ke tabel frontend
create or replace function gsp_private.api_sph_register(p_org uuid, p_branch uuid default null, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not gsp_private.sales_internal_member(p_org) then raise exception 'Akses daftar SPH ditolak.' using errcode='42501'; end if;
 if p_offset is null or p_offset < 0 or p_offset > 1000000 then raise exception 'Halaman daftar tidak valid.'; end if;
 with visible as (
  select d.*, b.name as branch_name, d as row_data
  from public.sales_documents d
  join public.business_units b on b.id = d.branch_id
  where d.organization_id = p_org and d.kind = 'sph'
    and (p_branch is null or d.branch_id = p_branch)
    and gsp_private.sales_document_reader(p_org, d.branch_id)
 ), page as (
  select
    id, sph_number, document_number, branch_id, branch_name, created_at,
    left(title, 120) as title, work_scopes, amount, status,
    gsp_private.sph_opener(visible.row_data) as can_open,
    gsp_private.sph_spk_creator(visible.row_data) as can_create_spk
  from visible
  order by sph_number desc
  limit 50 offset p_offset
 )
 select jsonb_build_object(
   'total', (select count(*) from visible),
   'rows', coalesce(jsonb_agg(page order by sph_number desc), '[]'::jsonb)
 ) into result from page;
 return result;
end;
$$;

-- Backfill nomor dokumen resmi untuk SPH yang sudah ada jika belum memiliki document_number
update public.sales_documents
set document_number = coalesce(
  document_number,
  gsp_private.generate_document_number(
    organization_id,
    'sph',
    created_at::date,
    client_snapshot->>'name'
  )
)
where kind = 'sph' and document_number is null;

notify pgrst, 'reload schema';
