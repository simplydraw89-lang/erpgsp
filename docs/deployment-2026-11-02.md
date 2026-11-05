# Status rilis migration — 2 November 2026

## Status berdasarkan bukti repository

| Environment | Migration paling baru terverifikasi | Status |
|---|---|---|
| PGlite lokal (`npm run test:workflow`) | Sampai migration terakhir di repository | Diterapkan sementara saat tes; tes membuat database baru dan tidak mengubah Supabase |
| Supabase lokal | Belum dijalankan | CLI config tersedia; local stack belum diverifikasi |
| Staging | Tidak diketahui | Project/ref dan schema tidak tersedia untuk pemeriksaan |
| Project Supabase aktif `cjxsdoxlrnpyhigkudha` | `20261102000100_accounting_advance_workflows` (diverifikasi dengan `supabase migration list --linked`, 2 November) | Sembilan migration lokal/remote cocok. Tabel, RPC, constraints, RLS/policies, triggers, dan grants target terverifikasi setelah penerapan |

Pemeriksaan read-only SQL Editor pada 2 November menemukan ledger `supabase_migrations.schema_migrations` tersedia dan memuat delapan migration dari `202610290001` sampai `20261031100000`. Ini berbeda dari catatan deployment sebelumnya yang menyebut ledger tersebut belum tersedia; gunakan hasil pemeriksaan aktual ini sebagai baseline baru. CLI dry-run hanya memilih migration terakhir, lalu `supabase db push` menerapkannya dan memperbarui ledger.

Backup terbaru dan prosedur restore telah dikonfirmasi pengguna sebelum perubahan database. Supabase CLI 2.122.0 dan `supabase/config.toml` telah disiapkan di workspace. Migration terakhir diterapkan melalui CLI, bukan SQL Editor, agar schema dan ledger tetap sinkron.

## Baseline pemeriksaan read-only sebelum penerapan — 2 November 2026

Editor yang kosong adalah buffer input, bukan bukti database kosong. Inventory aktual menemukan tabel target berikut:

- Ada: `company_entities`, `entity_memberships`, `accounting_periods`, `accounting_journals`, `accounting_journal_lines`, `cash_advances`.
- Belum ada: `bank_reconciliations`, `cash_advance_settlements`.
- Ledger remote berisi delapan migration sampai `20261031100000_multi_entity_accounting_foundation`.
- Dari nama RPC migration terbaru yang diperiksa, hanya `post_accounting_journal` ditemukan.

Setelah penerapan, kedua tabel dan seluruh 11 RPC target ditemukan. Keempat tabel akuntansi/settlement memiliki RLS aktif dan policy baca; semua RPC memiliki izin execute untuk `authenticated` dan ditolak untuk `anon`. Empat audit trigger target juga ditemukan. Constraint target terverifikasi.

Query untuk mengulang pemeriksaan tabel tanpa membaca isi bisnis atau mengubah schema:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'company_entities',
    'entity_memberships',
    'accounting_periods',
    'accounting_journals',
    'accounting_journal_lines',
    'bank_reconciliations',
    'cash_advances',
    'cash_advance_settlements'
  )
order by table_name;
```

Periksa RPC baru secara read-only:

```sql
select
  to_regprocedure('public.create_company_entity(uuid,text,text,text,text,uuid,text,boolean)') as create_entity,
  to_regprocedure('public.create_accounting_period(uuid,uuid,text,date,date)') as create_period,
  to_regprocedure('public.create_accounting_journal(uuid,uuid,uuid,text,date,text,text,jsonb)') as create_journal,
  to_regprocedure('public.reverse_accounting_journal(uuid,text,date,text)') as reverse_journal,
  to_regprocedure('public.reconcile_bank_balance(uuid,uuid,uuid,uuid,date,numeric,text)') as reconcile_balance,
  to_regprocedure('public.submit_cash_advance_settlement(uuid,uuid,numeric,numeric,numeric,text,text,date)') as submit_settlement,
  to_regprocedure('public.review_cash_advance_settlement(uuid,text,text)') as review_settlement;
```

Query ini hanya memeriksa keberadaan tabel/fungsi. Jika hasil menunjukkan objek sudah ada, **jangan** menjalankan ulang migration terkait. Jika objek belum ada, hasil tersebut juga belum cukup untuk memastikan semua prasyarat/versi cocok; minta administrator membandingkan kolom, constraint, policy, trigger, dan status backup sebelum memilih migration.

## Urutan migration instalasi baru

1. `202610290001_foundation.sql`
2. `202610290002_module_mvp.sql`
3. `20261030035918_asset_document_workflow.sql`
4. `20261030084607_dashboard_query_indexes.sql`
5. `20261030085540_hide_system_account_from_company_directory.sql`
6. `20261030101500_payment_module.sql`
7. `20261030123000_cash_advance_approval.sql`
8. `20261031100000_multi_entity_accounting_foundation.sql`
9. `20261102000100_accounting_advance_workflows.sql`

Daftar tersebut adalah untuk database baru. Migration 8 dan 9 bergantung pada schema yang dibentuk migration sebelumnya. Pada database aktif, tentukan urutan upgrade dari schema yang benar-benar ada; jangan menyalin seluruh daftar sebagai batch ke SQL Editor.

## Checklist sebelum perubahan environment aktif

- [x] Pengguna mengonfirmasi backup terbaru dan prosedur restore telah diverifikasi.
- [x] Ambil hasil inventory read-only serta tinjau ledger dan objek dari baseline environment.
- [x] Pastikan ledger dan schema konsisten; migration terbaru belum tercatat dan objek target belum ada sebelum penerapan.
- [x] Siapkan Supabase CLI dan konfigurasi lokal dengan versi PostgreSQL yang cocok (17).
- [x] Login CLI dan link project dengan akses deployment yang sesuai.
- [x] Tinjau migration list dan dry-run; hanya `20261102000100_accounting_advance_workflows.sql` yang diterapkan.
- [x] Terapkan satu migration dalam satu perubahan terkontrol.
- [x] Verifikasi tabel, constraint, RLS/policies, triggers, RPC, dan grants.
- [ ] Lakukan tes smoke perilaku per role pada aplikasi tanpa data produksi sensitif.
- [x] Catat tanggal, project/environment, migration, dan hasil di dokumen deployment ini.

Penerapan 2 November 2026:

```powershell
npx supabase db push --project-ref cjxsdoxlrnpyhigkudha
npx supabase migration list --linked
```

Status CLI mencocokkan sembilan migration lokal dan remote. Tes lokal memakai PGlite dengan database sementara; role-based live smoke test masih perlu dilakukan. Tidak ada kredensial produksi atau service-role key yang ditambahkan ke aplikasi atau repository.
