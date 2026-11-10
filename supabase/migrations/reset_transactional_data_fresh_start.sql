-- ============================================================================
-- SCRIPT: reset_transactional_data_fresh_start.sql
-- Tujuan:
-- Membersihkan seluruh data transaksi dan input pengajuan dari awal (Fresh Start 0)
-- TANPA menghapus fungsi, struktur tabel, RLS, Master Organisasi, Cabang,
-- Chart of Accounts (COA), Periode Akuntansi, Master Klien/Vendor, maupun akun Login.
-- ============================================================================

begin;

-- 1. Matikan sementara trigger user (termasuk guard_accounting_journal & audit)
--    agar jurnal berstatus 'posted' dan relasi dokumen dapat dibersihkan tanpa error.
alter table public.accounting_journal_lines disable trigger user;
alter table public.accounting_journals disable trigger user;
alter table public.crm_projects disable trigger user;
alter table public.sales_documents disable trigger user;
alter table public.purchase_requests disable trigger user;

do $$
begin
  if to_regclass('public.sales_invoices') is not null then
    execute 'alter table public.sales_invoices disable trigger user';
  end if;
end $$;

-- 2. Putuskan hubungan Foreign Key melingkar antar dokumen, proyek, dan jurnal
update public.sales_documents set project_id = null, parent_id = null;
update public.crm_projects set spk_id = null;

do $$
begin
  if to_regclass('public.sales_invoices') is not null then
    execute 'update public.sales_invoices set invoice_journal_id = null, payment_journal_id = null';
  end if;
end $$;

-- 3. Bersihkan Tagihan Penjualan (Invoice & Kuitansi Milestone)
do $$
begin
  if to_regclass('public.sales_invoices') is not null then
    execute 'delete from public.sales_invoices';
  end if;
end $$;

-- 4. Bersihkan transaksi Akuntansi & Perpajakan yang timbul dari pengajuan lama
delete from public.bank_reconciliations;
delete from public.accounting_journal_lines;
delete from public.accounting_journals;
delete from public.tax_records;

-- 5. Bersihkan transaksi Kasbon (SPPD) & Pengadaan Barang/Jasa (Purchase Order)
delete from public.cash_advance_settlements;
delete from public.cash_advances;
delete from public.purchase_requests;
delete from public.payment_records;

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

-- 7. Bersihkan Dokumen Penjualan (SPK, SPH, dsb.)
delete from public.sales_documents;

-- 8. Bersihkan Event Riwayat / Timeline Pengajuan & Berkas Lampiran Transaksi
delete from public.procurement_events;
delete from public.procurement_attachments;
delete from public.workflow_executions;
delete from public.workflow_documents;
delete from public.approval_requests;
delete from public.audit_events
where entity_type in (
  'crm_project',
  'spk',
  'sph',
  'invoice',
  'sales_invoice',
  'purchase_request',
  'cash_advance',
  'accounting_journal'
);

-- 9. Reset counter penomoran dokumen transaksi agar mulai kembali dari 000001
--    (Tetap mempertahankan counter 'client' dan 'vendor' agar master mitra tidak bentrok)
delete from gsp_private.document_counters
where lower(doc_type) not in ('client', 'vendor');

-- ============================================================================
-- OPSIONAL: Jika Anda juga ingin menghapus Master Klien & Vendor yang pernah
-- diinput saat testing, hapus tanda komentar (--) pada 3 baris di bawah ini:
-- delete from public.sales_clients;
-- delete from public.procurement_vendors;
-- delete from gsp_private.document_counters where lower(doc_type) in ('client', 'vendor');
-- ============================================================================

-- 10. Aktifkan kembali seluruh trigger user seperti semula
alter table public.accounting_journal_lines enable trigger user;
alter table public.accounting_journals enable trigger user;
alter table public.crm_projects enable trigger user;
alter table public.sales_documents enable trigger user;
alter table public.purchase_requests enable trigger user;

do $$
begin
  if to_regclass('public.sales_invoices') is not null then
    execute 'alter table public.sales_invoices enable trigger user';
  end if;
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
