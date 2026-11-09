-- ============================================================================
-- SCRIPT: reset_transactional_data_fresh_start.sql
-- Tujuan:
-- Membersihkan seluruh data transaksi pengajuan dari awal (Fresh Start)
-- TANPA menghapus fungsi, struktur tabel, RLS, Master Organisasi, Cabang,
-- Chart of Accounts (COA), Master Klien/Vendor, maupun akun Login pengguna.
-- ============================================================================

begin;

-- 1. Matikan sementara trigger audit pada tabel-tabel transaksi
do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'audit_crm_projects') then
    alter table public.crm_projects disable trigger audit_crm_projects;
  end if;
  if exists (select 1 from pg_trigger where tgname = 'audit_crm_project') then
    alter table public.crm_projects disable trigger audit_crm_project;
  end if;
end $$;

-- 2. Putuskan hubungan Foreign Key melingkar antara crm_projects dan sales_documents
update public.sales_documents set project_id = null;
update public.crm_projects set spk_id = null;

-- 3. Bersihkan transaksi Akuntansi & Perpajakan yang timbul dari pengajuan lama
delete from public.bank_reconciliations;
delete from public.accounting_journal_lines;
delete from public.accounting_journals;
delete from public.tax_records;

-- 4. Bersihkan transaksi Kasbon & Pengadaan Barang/Jasa
delete from public.cash_advance_settlements;
delete from public.cash_advances;
delete from public.purchase_requests;
delete from public.payment_records;

-- 5. Bersihkan Proyek & Pekerjaan Operasional
delete from public.project_portal_entries;
delete from public.project_memberships;
delete from public.project_access_scopes;
delete from public.operational_work_items;
delete from public.crm_projects;

-- 6. Bersihkan Dokumen Penjualan (Invoice, Kuitansi, SPK, SPH)
delete from public.sales_documents;

-- 7. Bersihkan Event Riwayat / Timeline Pengajuan & Berkas Lampiran Transaksi
delete from public.procurement_events;
delete from public.procurement_attachments;
delete from public.workflow_executions;
delete from public.workflow_documents;
delete from public.approval_requests;
delete from public.audit_events where entity_type in ('crm_project', 'spk', 'sph', 'invoice', 'purchase_request', 'cash_advance');

-- 8. Aktifkan kembali trigger audit
do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'audit_crm_projects') then
    alter table public.crm_projects enable trigger audit_crm_projects;
  end if;
  if exists (select 1 from pg_trigger where tgname = 'audit_crm_project') then
    alter table public.crm_projects enable trigger audit_crm_project;
  end if;
end $$;

commit;

-- Verifikasi hasil: seluruh tabel pengajuan kini bernilai 0 (bersih untuk mulai dari awal)
select 
  (select count(*) from public.sales_documents) as sisa_sph_spk_invoice,
  (select count(*) from public.crm_projects) as sisa_proyek,
  (select count(*) from public.purchase_requests) as sisa_pengadaan,
  (select count(*) from public.cash_advances) as sisa_kasbon,
  (select count(*) from public.accounting_journals) as sisa_jurnal;
