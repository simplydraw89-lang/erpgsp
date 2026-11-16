-- ============================================================================
-- SCRIPT: staging_clean_reset.sql
-- Tujuan:
-- Membersihkan SELURUH data input transaksi, pengajuan, dokumen, dan jurnal
-- (Fresh Start 0) agar sistem siap distaging ulang dari awal dengan fitur-fitur baru.
--
-- JAMINAN KEAMANAN:
-- 1. Struktur tabel (DDL), fungsi RPC, triggers, dan RLS policies TETAP UTUH.
-- 2. Master Organisasi, Master Cabang (business_units), dan Entitas Akuntansi TETAP AMAN.
-- 3. Akun Login Pengguna/Direksi/Admin, Penugasan Jabatan (work_assignments) TETAP AMAN.
-- 4. Bagan Akun (COA / finance_accounts) & Aturan Approval TETAP AMAN.
-- 5. Penomoran Dokumen (SPH, SPK, Invoice, Kwitansi) di-reset ke 0 agar mulai dari 001.
-- ============================================================================

begin;

-- 1. Matikan sementara trigger user pada tabel-tabel transaksi agar tidak diblokir oleh guard-triggers
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
    'bank_statement_lines',
    'accounting_journal_lines',
    'accounting_journals',
    'tax_records',
    'tax_fiscal_adjustments',
    'leave_requests',
    'payroll_items',
    'payroll_runs',
    'project_timesheets',
    'project_milestones',
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
update public.sales_documents set project_id = null where project_id is not null;
update public.crm_projects set spk_id = null where spk_id is not null;
update public.purchase_requests
set journal_id = null,
    payment_journal_id = null,
    project_id = null
where journal_id is not null or payment_journal_id is not null or project_id is not null;

update public.accounting_journals set reversal_of = null where reversal_of is not null;
update public.accounting_journal_lines set project_id = null where project_id is not null;

do $$
begin
  if to_regclass('public.sales_invoices') is not null then
    execute 'update public.sales_invoices set invoice_journal_id = null, payment_journal_id = null, project_id = null, spk_id = null';
  end if;
end $$;

-- 3. Bersihkan Data Penagihan & Invoice Penjualan (WAPU & Non-WAPU)
do $$
begin
  if to_regclass('public.sales_invoices') is not null then
    execute 'delete from public.sales_invoices';
  end if;
end $$;

-- 4. Bersihkan Transaksi Pembayaran, Kasbon (SPPD) & Pengadaan Barang/Jasa
delete from public.payment_records;
delete from public.cash_advance_settlements;
delete from public.cash_advances;
delete from public.purchase_requests;

-- 5. Bersihkan Transaksi Akuntansi, Bank & Perpajakan
do $$
begin
  if to_regclass('public.tax_fiscal_adjustments') is not null then
    execute 'delete from public.tax_fiscal_adjustments';
  end if;
  if to_regclass('public.bank_statement_lines') is not null then
    execute 'delete from public.bank_statement_lines';
  end if;
end $$;

delete from public.bank_reconciliations;
delete from public.accounting_journal_lines;
delete from public.accounting_journals;
delete from public.tax_records;

-- 6. Bersihkan Proyek, Milestones, Portal Klien & Timesheet Lapangan
do $$
begin
  if to_regclass('public.project_portal_comments') is not null then
    execute 'delete from public.project_portal_comments';
  end if;
  if to_regclass('public.project_milestones') is not null then
    execute 'delete from public.project_milestones';
  end if;
  if to_regclass('public.project_timesheets') is not null then
    execute 'delete from public.project_timesheets';
  end if;
end $$;

delete from public.project_portal_entries;
delete from public.project_memberships;
delete from public.project_access_scopes;
delete from public.operational_work_items;
delete from public.crm_projects;

-- 7. Bersihkan Dokumen Penjualan (SPK & SPH)
delete from public.sales_documents where kind <> 'sph';
delete from public.sales_documents;

-- 8. Bersihkan Transaksi HR & Penggajian Testing
do $$
begin
  if to_regclass('public.leave_requests') is not null then
    execute 'delete from public.leave_requests';
  end if;
  if to_regclass('public.payroll_items') is not null then
    execute 'delete from public.payroll_items';
  end if;
  if to_regclass('public.payroll_runs') is not null then
    execute 'delete from public.payroll_runs';
  end if;
end $$;

-- 9. Bersihkan Lampiran Berkas, Event Pengadaan, dan Antrean Approval Lama
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
  'accounting_journal',
  'leave_request'
);

-- 10. Bersihkan Master Klien & Vendor Hasil Testing Sebelumnya
delete from public.sales_clients;
delete from public.procurement_vendors;
do $$
begin
  if to_regclass('public.crm_clients') is not null then
    execute 'delete from public.crm_clients';
  end if;
end $$;

-- Bersihkan profil khusus akun klien testing (karyawan internal tetap aman)
delete from public.person_profiles where relationship_status = 'client';

-- 11. Reset Counter Penomoran Dokumen (Kembali ke 0 agar mulai dari 001)
delete from gsp_private.document_counters;
do $$
begin
  if to_regclass('gsp_private.sph_counters') is not null then
    execute 'delete from gsp_private.sph_counters';
  end if;
end $$;

-- 12. Aktifkan Kembali Seluruh Trigger User Seperti Semula
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
    'bank_statement_lines',
    'accounting_journal_lines',
    'accounting_journals',
    'tax_records',
    'tax_fiscal_adjustments',
    'leave_requests',
    'payroll_items',
    'payroll_runs',
    'project_timesheets',
    'project_milestones',
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

-- 13. Beritahu PostgREST untuk me-reload skema
notify pgrst, 'reload schema';

-- 14. Tampilkan Ringkasan Hasil Pembersihan
select 
  (select count(*) from public.sales_documents) as sisa_sph_spk,
  (select count(*) from public.sales_invoices) as sisa_invoices,
  (select count(*) from public.crm_projects) as sisa_proyek,
  (select count(*) from public.purchase_requests) as sisa_pembelian,
  (select count(*) from public.cash_advances) as sisa_kasbon_sppd,
  (select count(*) from public.accounting_journals) as sisa_jurnal_akuntansi,
  (select count(*) from public.business_units) as total_cabang_aman,
  (select count(*) from public.finance_accounts) as total_coa_aman,
  (select count(*) from public.organization_members) as total_user_aman;
