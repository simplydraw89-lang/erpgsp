-- ============================================================================
-- 20261107_fix_sph_opener_rls.sql
-- Penyelarasan Aturan Seluruh Cabang (Pusat, Surabaya, Jogjakarta, Jakarta)
-- 1. Cakupan Cabang: Mendukung 'branch' dan 'center' (Pusat) secara konsisten
-- 2. SPH Opener RLS: Mencegah 404 setelah persetujuan
-- 3. can_review_sph: Branch Manager per cabang -> Direktur (Keuangan, Teknis, Utama)
-- 4. can_review_spk: Direktur Utama & Direktur Teknis -> Otomatis Buat Proyek
-- 5. Vendor & Klien: Dapat didaftarkan untuk cabang operasional maupun kantor pusat
-- ============================================================================

-- 1. Alur Persetujuan SPH Seluruh Cabang
create or replace function gsp_private.can_review_sph(d public.sales_documents)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select d.kind = 'sph'
  and (
    gsp_private.is_superadmin(d.organization_id)
    or (
      gsp_private.sales_document_reader(d.organization_id, d.branch_id)
      and (d.created_by <> auth.uid() or gsp_private.is_superadmin(d.organization_id))
      and case d.status
        when 'branch_review' then gsp_private.has_job(d.organization_id, d.branch_id, array['branch_manager', 'admin'])
        when 'director_review' then gsp_private.has_job(d.organization_id, null, array['finance_director', 'technical_director', 'president'])
        when 'accounting_review' then gsp_private.has_job(d.organization_id, null, array['accounting_tax'])
        when 'finance_review' then gsp_private.has_job(d.organization_id, null, array['finance'])
        else false
      end
    )
  );
$$;

-- 2. Hak Baca SPH (Opener): Semua yang berhak membaca sales cabang, pembuat, reviewer, dan superadmin
create or replace function gsp_private.sph_opener(d public.sales_documents)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select gsp_private.is_superadmin(d.organization_id)
    or gsp_private.sales_document_reader(d.organization_id, d.branch_id)
    or gsp_private.can_review_sph(d)
    or (d.created_by = auth.uid());
$$;

-- 3. Alur Persetujuan SPK Seluruh Cabang
create or replace function gsp_private.can_review_spk(d public.sales_documents)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select d.kind = 'spk'
  and d.status = 'director_review'
  and (
    gsp_private.is_superadmin(d.organization_id)
    or gsp_private.has_job(d.organization_id, null, array['president', 'technical_director'])
  );
$$;

-- 4. Pendaftaran Vendor Seluruh Cabang (Pusat & Cabang Operasional)
create or replace function public.save_procurement_vendor(p_org uuid, p_branch uuid, p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
  if not gsp_private.can_access_business(p_org, p_branch, 'procurement') then
    raise exception 'Akses cabang ditolak.' using errcode='42501';
  end if;
  if not exists(select 1 from public.business_units where id = p_branch and organization_id = p_org and kind in ('branch', 'center')) then
    raise exception 'Pilih cabang usaha yang valid.';
  end if;
  if exists(select 1 from unnest(array['name','address','bank_owner','bank_account','payment_method']) k where nullif(btrim(p_payload->>k),'') is null) then
    raise exception 'Identitas vendor dan rekening wajib diisi.';
  end if;
  insert into public.procurement_vendors(organization_id, branch_id, name, address, npwp, bank_owner, bank_account, payment_method, created_by)
  values(p_org, p_branch, btrim(p_payload->>'name'), p_payload->>'address', nullif(p_payload->>'npwp',''), p_payload->>'bank_owner', p_payload->>'bank_account', p_payload->>'payment_method', auth.uid())
  returning id into v;
  perform gsp_private.procurement_log(p_org, p_branch, v, 'vendor', 'submitted');
  return v;
end $$;

-- 5. Pendaftaran Klien Seluruh Cabang (Pusat & Cabang Operasional)
create or replace function public.save_sales_client(p_org uuid, p_branch uuid, p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare i uuid;
begin
  if not gsp_private.can_access_business(p_org, p_branch, 'sales') then
    raise exception 'Akses klien cabang ditolak.' using errcode='42501';
  end if;
  if not exists(select 1 from public.business_units where id = p_branch and organization_id = p_org and kind in ('branch', 'center')) then
    raise exception 'Cabang tidak valid.';
  end if;
  if exists(select 1 from unnest(array['name','address','contact','industry']) k where nullif(btrim(p_payload->>k),'') is null) then
    raise exception 'Nama PT, alamat, kontak, dan bidang usaha wajib diisi.';
  end if;
  insert into public.sales_clients(organization_id, branch_id, name, address, npwp, contact, industry, created_by)
  values(p_org, p_branch, p_payload->>'name', p_payload->>'address', nullif(p_payload->>'npwp',''), p_payload->>'contact', p_payload->>'industry', auth.uid())
  returning id into i;
  perform gsp_private.procurement_log(p_org, p_branch, i, 'client', 'created');
  return i;
end $$;

-- 6. Pengajuan SPH Seluruh Cabang (Pusat & Cabang Operasional)
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
begin
  if not gsp_private.sales_client_reader(p_org) or not gsp_private.can_access_business(p_org, p_branch, 'sales') then
    raise exception 'Akses pengajuan SPH cabang ditolak.' using errcode='42501';
  end if;
  if not exists(select 1 from public.business_units where id = p_branch and organization_id = p_org and kind in ('branch', 'center')) then
    raise exception 'Pilih cabang operasional yang diizinkan.';
  end if;
  if p_id is not null then
    select * into d from public.sales_documents where id = p_id for update;
  end if;
  if d.id is not null then
    if d.organization_id <> p_org or d.branch_id <> p_branch or d.kind <> 'sph' or (d.created_by <> auth.uid() and not gsp_private.is_superadmin(p_org)) then
      raise exception 'Draft SPH bukan milik Anda atau cabang berubah.' using errcode='42501';
    end if;
    if d.version is distinct from p_version or d.status not in ('draft', 'rejected', 'revision_requested') then
      raise exception 'Versi SPH berubah atau dokumen sudah terkunci.';
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
  select coalesce(array_agg(value::uuid), '{}') into attachments from jsonb_array_elements_text(coalesce(p_payload->'attachment_ids', '[]'));
  perform gsp_private.validate_sales_attachments(p_org, p_branch, attachments);
  if d.id is not null and not d.attachment_ids <@ attachments then
    raise exception 'Lampiran tersimpan tidak boleh dihapus.';
  end if;
  select coalesce(array_agg(value), '{}') into scopes from jsonb_array_elements_text(coalesce(p_payload->'work_scopes', '[]'));
  if not scopes <@ array['Pertek','UKL/UPL','Amdal','DELH','DPLH','Andalalin','LB 3','Lainnya']::text[] or cardinality(scopes) <> (select count(distinct x) from unnest(scopes) x) then
    raise exception 'Lingkup pekerjaan tidak valid atau duplikat.';
  end if;
  if coalesce(p_submit, false) then
    if (p_payload->>'confirmed')::boolean is distinct from true then
      raise exception 'Konfirmasi kebenaran data sebelum mengajukan SPH.';
    end if;
    if nullif(btrim(p_payload->>'work_area'), '') is null or cardinality(scopes) = 0 or nullif(p_payload->>'deal_status', '') is null or nullif(p_payload->>'valid_until', '') is null then
      raise exception 'Lengkapi daerah pengerjaan, lingkup, status deal dan masa berlaku sebelum submit.';
    end if;
    if (p_payload->>'valid_until')::date < (now() at time zone 'Asia/Bangkok')::date then
      raise exception 'Masa berlaku SPH sudah berakhir.';
    end if;
    if c.email is null or c.phone is null or c.industry not in ('Mining','Migas','Industri','Umum') or length(regexp_replace(coalesce(c.npwp,''),'[^0-9]','','g')) not in (15,16) then
      raise exception 'Lengkapi identitas klien yang valid sebelum submit SPH.';
    end if;
  end if;
  snapshot := jsonb_build_object('id', c.id, 'name', c.name, 'address', c.address, 'npwp', c.npwp, 'phone', c.phone, 'email', c.email, 'industry', c.industry);
  if d.id is null then
    i := coalesce(p_id, gen_random_uuid());
    insert into public.sales_documents(id, organization_id, branch_id, client_id, kind, title, source, notes, attachment_ids, work_area, work_scopes, deal_status, valid_until, client_snapshot, created_by)
    values(i, p_org, p_branch, c.id, 'sph', btrim(p_payload->>'title'), 'company', nullif(btrim(p_payload->>'notes'), ''), attachments, nullif(btrim(p_payload->>'work_area'), ''), scopes, nullif(p_payload->>'deal_status', ''), nullif(p_payload->>'valid_until', '')::date, snapshot, auth.uid());
  else
    i := d.id;
    update public.sales_documents
    set client_id = c.id,
        title = btrim(p_payload->>'title'),
        notes = nullif(btrim(p_payload->>'notes'), ''),
        attachment_ids = attachments,
        work_area = nullif(btrim(p_payload->>'work_area'), ''),
        work_scopes = scopes,
        deal_status = nullif(p_payload->>'deal_status', ''),
        valid_until = nullif(p_payload->>'valid_until', '')::date,
        client_snapshot = snapshot,
        status = 'draft',
        review_note = null,
        version = version + 1
    where id = i;
  end if;
  perform gsp_private.procurement_log(p_org, p_branch, i, 'sph', case when d.id is null then 'draft_created' else 'draft_updated' end);
  if coalesce(p_submit, false) then
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
end $$;

-- Notifikasi reload schema
notify pgrst, 'reload schema';
