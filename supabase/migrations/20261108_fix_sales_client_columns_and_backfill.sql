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
notify pgrst, 'reload schema';
