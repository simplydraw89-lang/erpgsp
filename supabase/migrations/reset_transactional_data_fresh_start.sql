-- ============================================================================
-- SCRIPT: reset_transactional_data_fresh_start.sql
-- Tujuan:
-- Membersihkan seluruh data transaksi dan input pengajuan dari awal (Fresh Start 0)
-- TANPA menghapus fungsi, struktur tabel, RLS, Master Organisasi, Cabang,
-- Chart of Accounts (COA), Periode Akuntansi, Master Klien/Vendor, maupun akun Login.
-- ============================================================================

begin;

-- 1. Matikan sementara seluruh trigger user (termasuk guard_accounting_journal,
--    scoped_legacy_write, sales_sph_number_guard, dan audit_*) pada tabel transaksi
do $$
declare
  v_tbl text;
begin
  foreach v_tbl in array array[
    'sales_invoices',
    'payment_records',
    'cash_advance_settlements',
    'cash_advances',
    'purchase_requests',
    'bank_reconciliations',
    'accounting_journal_lines',
    'accounting_journals',
    'tax_records',
    'project_portal_comments',
    'project_portal_entries',
    'project_memberships',
    'project_access_scopes',
    'operational_work_items',
    'crm_projects',
    'sales_documents',
    'sales_clients',
    'crm_clients',
    'procurement_vendors',
    'procurement_events',
    'procurement_attachments',
    'workflow_executions',
    'approval_requests',
    'workflow_documents',
    'audit_events'
  ] loop
    if to_regclass('public.' || v_tbl) is not null then
      execute format('alter table public.%I disable trigger user', v_tbl);
    end if;
  end loop;
end $$;

-- 2. Putuskan seluruh hubungan Foreign Key melingkar / silang antar tabel transaksi
update public.sales_documents set project_id = null;
update public.crm_projects set spk_id = null;
update public.purchase_requests
set journal_id = null,
    payment_journal_id = null,
    project_id = null;
update public.accounting_journals set reversal_of = null;
update public.accounting_journal_lines set project_id = null;

do $$
begin
  if to_regclass('public.sales_invoices') is not null then
    execute 'update public.sales_invoices set invoice_journal_id = null, payment_journal_id = null, project_id = null, spk_id = null';
  end if;
end $$;

-- 3. Bersihkan Tagihan Penjualan (Invoice & Kuitansi Milestone)
do $$
begin
  if to_regclass('public.sales_invoices') is not null then
    execute 'delete from public.sales_invoices';
  end if;
end $$;

-- 4. Bersihkan transaksi Pembayaran, Kasbon (SPPD), & Pengadaan Barang/Jasa (Purchase Order)
--    (Dihapus sebelum accounting_journals agar tidak ada FK yang menyangkut)
delete from public.payment_records;
delete from public.cash_advance_settlements;
delete from public.cash_advances;
delete from public.purchase_requests;

-- 5. Bersihkan transaksi Akuntansi & Perpajakan yang timbul dari pengajuan lama
delete from public.bank_reconciliations;
delete from public.accounting_journal_lines;
delete from public.accounting_journals;
delete from public.tax_records;

-- 6. Bersihkan Proyek, RAB, & Pekerjaan Operasional
do $$
begin
  if to_regclass('public.project_portal_comments') is not null then
    execute 'delete from public.project_portal_comments';
  end if;
end $$;
delete from public.project_portal_entries;
delete from public.project_memberships;
delete from public.project_access_scopes;
delete from public.operational_work_items;
delete from public.crm_projects;

-- 7. Bersihkan Dokumen Penjualan (Hapus SPK terlebih dahulu karena merujuk accepted_sph_id, lalu hapus SPH)
delete from public.sales_documents where kind <> 'sph';
delete from public.sales_documents;

-- 8. Bersihkan Event Riwayat / Timeline Pengajuan & Berkas Lampiran Transaksi
delete from public.procurement_events;
delete from public.procurement_attachments;
delete from public.workflow_executions;
delete from public.approval_requests;
delete from public.workflow_documents;
delete from public.audit_events
where entity_type in (
  'crm_project',
  'spk',
  'sph',
  'invoice',
  'sales_invoice',
  'purchase_request',
  'cash_advance',
  'cash_advance_settlement',
  'payment',
  'work_item',
  'tax_record',
  'accounting_journal'
);

-- 9. Bersihkan juga data Klien & Vendor dummy hasil testing sebelumnya
--    (termasuk PT Bumi Teknik Prima yang sempat terduplikasi dari hasil OCR lama)
delete from public.sales_clients;
delete from public.procurement_vendors;
do $$
begin
  if to_regclass('public.crm_clients') is not null then
    execute 'delete from public.crm_clients';
  end if;
end $$;

-- 10. Reset seluruh counter penomoran dokumen agar mulai kembali dari 000001
delete from gsp_private.document_counters;

do $$
begin
  if to_regclass('gsp_private.sph_counters') is not null then
    execute 'delete from gsp_private.sph_counters';
  end if;
end $$;

-- 10. Pastikan akun Demo (demo@gsp.test) aktif, kata sandi sinkron, dan kolom token
--     GoTrue tidak bernilai NULL (mencegah gagal login pada Supabase Auth)
create extension if not exists pgcrypto;

do $$
declare
  v_org_id uuid;
  v_demo_id uuid;
  v_instance_id uuid;
  v_password text := 'GspPreview!2026#ReadOnly';
begin
  select id into v_org_id from public.organizations limit 1;
  if v_org_id is null then
    return;
  end if;

  select coalesce(
    (select instance_id from auth.users where instance_id is not null limit 1),
    '00000000-0000-0000-0000-000000000000'::uuid
  ) into v_instance_id;

  select id into v_demo_id from auth.users where lower(email) = 'demo@gsp.test' limit 1;

  if v_demo_id is null then
    v_demo_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      phone_change,
      phone_change_token,
      reauthentication_token,
      created_at,
      updated_at
    ) values (
      v_instance_id,
      v_demo_id,
      'authenticated',
      'authenticated',
      'demo@gsp.test',
      crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Tamu / Eksekutif Demo","is_demo":true}'::jsonb,
      false,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      now(),
      now()
    );
  else
    update auth.users
    set instance_id = coalesce(instance_id, v_instance_id),
        aud = 'authenticated',
        role = 'authenticated',
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        encrypted_password = crypt(v_password, gen_salt('bf')),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"full_name":"Tamu / Eksekutif Demo","is_demo":true}'::jsonb,
        confirmation_token = coalesce(confirmation_token, ''),
        recovery_token = coalesce(recovery_token, ''),
        email_change_token_new = coalesce(email_change_token_new, ''),
        email_change = coalesce(email_change, ''),
        email_change_token_current = coalesce(email_change_token_current, ''),
        phone_change = coalesce(phone_change, ''),
        phone_change_token = coalesce(phone_change_token, ''),
        reauthentication_token = coalesce(reauthentication_token, ''),
        banned_until = null,
        deleted_at = null,
        updated_at = now()
    where id = v_demo_id;
  end if;

  -- Pastikan auth.identities terdaftar dengan benar untuk GoTrue
  delete from auth.identities where user_id = v_demo_id and provider = 'email';

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    v_demo_id,
    jsonb_build_object(
      'sub', v_demo_id::text,
      'email', 'demo@gsp.test',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    v_demo_id::text,
    now(),
    now(),
    now()
  );

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, v_demo_id, 'director')
  on conflict (organization_id, user_id) do update set role = 'director';

  insert into public.person_profiles (organization_id, user_id, relationship_status)
  values (v_org_id, v_demo_id, 'permanent')
  on conflict (organization_id, user_id) do update set relationship_status = 'permanent';

  delete from public.work_assignments
  where organization_id = v_org_id and user_id = v_demo_id and job_role = 'president';

  insert into public.work_assignments (organization_id, user_id, branch_id, job_role)
  values (v_org_id, v_demo_id, null, 'president');
end $$;

-- 11. Aktifkan kembali seluruh trigger user seperti semula
do $$
declare
  v_tbl text;
begin
  foreach v_tbl in array array[
    'sales_invoices',
    'payment_records',
    'cash_advance_settlements',
    'cash_advances',
    'purchase_requests',
    'bank_reconciliations',
    'accounting_journal_lines',
    'accounting_journals',
    'tax_records',
    'project_portal_comments',
    'project_portal_entries',
    'project_memberships',
    'project_access_scopes',
    'operational_work_items',
    'crm_projects',
    'sales_documents',
    'sales_clients',
    'crm_clients',
    'procurement_vendors',
    'procurement_events',
    'procurement_attachments',
    'workflow_executions',
    'approval_requests',
    'workflow_documents',
    'audit_events'
  ] loop
    if to_regclass('public.' || v_tbl) is not null then
      execute format('alter table public.%I enable trigger user', v_tbl);
    end if;
  end loop;
end $$;

commit;

-- Verifikasi hasil: seluruh tabel pengajuan kini bernilai 0 (bersih untuk mulai dari awal)
select 
  (select count(*) from public.sales_documents) as sisa_sph_spk,
  (select count(*) from public.sales_invoices) as sisa_sales_invoices,
  (select count(*) from public.crm_projects) as sisa_proyek,
  (select count(*) from public.purchase_requests) as sisa_pengadaan,
  (select count(*) from public.cash_advances) as sisa_kasbon,
  (select count(*) from public.accounting_journals) as sisa_jurnal;
