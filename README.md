# GSP — Gema Sinergi Peradaban

Fondasi workspace ERP modular untuk menyatukan akses ke sistem perusahaan dengan prinsip **check and balance**. Aplikasi baru ini memakai Next.js App Router, TypeScript, Tailwind CSS, komponen bergaya shadcn/ui, Supabase Auth, PostgreSQL, dan Row Level Security.

## Status modul

Baseline 4 November 2026: [aturan pengembangan](docs/aturan-pengembangan.md),
[PRD induk](docs/PRD.md), [ERD induk](docs/ERD.md),
[dasar pajak/jurnal pembelian](docs/pajak-dan-jurnal-pembelian.md), dan
[status implementasi pusat–cabang/pengajuan](docs/implementasi-2026-11-04.md).
Satu perusahaan memiliki pusat nonoperasional dan tiga cabang (Surabaya,
Jogjakarta, Jakarta), dengan satu pelaporan pajak. Key `owner` adalah Super Admin
pemilik sistem dengan akses penuh dan audit. Status individu dipisahkan dari
penugasan pekerjaan. Gunakan Pengajuan Bisnis untuk alur pembelian baru;
register pembayaran lama tidak menggantikan alur tersebut.

Repository ini merupakan ERP baru. Setelah migration Asset/workflow diterapkan, data baru dan perubahan disimpan sebagai draft. Data resmi baru berubah setelah pengajuan disetujui dan dieksekusi. Belum ada sinkronisasi otomatis dengan aplikasi eksternal.

| Modul | Kemampuan MVP tahap 1 |
| --- | --- |
| CRM & Proyek | Pencatatan kontak/prospek dan proyek |
| Asset Perusahaan | Kode, kategori, nomor seri, lokasi, penanggung jawab, nilai perolehan, kondisi/status dan usulan perubahan aset |
| Operasional | Daftar pekerjaan, prioritas, dan tenggat |
| Keuangan | Bagan akun dan register pembayaran; jurnal double-entry, posting, reversal, periode, dan rekonsiliasi saldo tersedia melalui modul Akuntansi |
| Pembayaran | Tagihan keluar melalui approval; kasbon dengan pemeriksaan Manager → Finance dan pertanggungjawaban Finance setelah pencairan |
| SDM | Data dasar karyawan; payroll belum tersedia |
| Perpajakan | Pencatatan masa, jenis, dasar, dan nilai pajak; kalkulasi/pelaporan resmi belum tersedia |
| Manajemen & Laporan | Jumlah catatan per modul, dibatasi untuk Superuser/direksi |

Integrasi sistem eksternal memerlukan URL API/repository sumber, kontrak data, pemetaan identitas, kredensial server yang disimpan dengan aman, dan persetujuan sebelum sinkronisasi atau migrasi data.

## Check and balance

- Perusahaan dibatasi melalui `organization_id` dan Supabase RLS.
- Pengaju tidak dapat menyetujui permintaannya sendiri.
- Persetujuan hanya melalui RPC transaksional `review_approval_request`; klien tidak memperoleh izin untuk mengubah status secara langsung.
- Keputusan merekam pemeriksa, waktu, alasan, dan peristiwa audit.
- Peran auditor hanya-baca untuk jejak audit; kredensial service role tidak dipakai di browser atau disimpan dalam registri integrasi.
- Auditor hanya-baca, termasuk pada pengajuan dan pertanggungjawaban kasbon.
- Perubahan data modul tahap awal direkam ke jejak audit melalui trigger database.
- RLS membatasi data berdasarkan organisasi dan peran, termasuk data sensitif SDM dan keuangan.
- Draft → diajukan → disetujui/ditolak → dieksekusi berlaku pada seluruh jenis record modul, termasuk Asset.
- Pemeriksa ditentukan oleh kebijakan organisasi; administrator sistem mengaturnya di `/pengaturan/persetujuan`. Pengaturan awal memakai direksi. Aset, pajak, dan pembayaran mendukung eskalasi nominal.
- Snapshot isi dokumen, versi dan kebijakan disimpan saat pengajuan. Dokumen yang diajukan terkunci. Revisi versi ditolak membutuhkan pengajuan baru.
- Tabel bisnis tidak menerima insert/update/delete/truncate dari klien. Eksekusi hanya melalui RPC dengan row lock, pemeriksaan versi dan satu bukti eksekusi unik per dokumen.
- [Panduan workflow dan penerapan database](docs/workflow.md).

## Menjalankan lokal

### Menjalankan di laptop lain

Repository: https://github.com/simplydraw89-lang/erpgsp, branch `main`.
Gunakan Git dan Node.js 24 (lingkungan lokal saat ini memakai Node.js 24.20.0).

```powershell
git clone https://github.com/simplydraw89-lang/erpgsp.git
cd erpgsp
npm ci
Copy-Item .env.example .env.local
```

Isi `.env.local` dengan URL dan publishable key Supabase yang sama dengan
laptop asal, atau salin `.env.local` secara pribadi ke folder hasil clone.
File ini tidak disimpan di GitHub. Lalu jalankan `npm run dev` dan buka
`http://localhost:3000`. Gunakan akun yang sudah ada pada project Supabase yang
sama; data/Auth/lampiran berada di Supabase, bukan disalin bersama repository.
Untuk sekadar menjalankan kode di laptop lain dengan project aktif yang sama,
tidak perlu mengulang migration atau konfigurasi pembukuan. Folder `node_modules`
dan `.next` dibuat ulang secara lokal.

Pembacaan PDF digital tersedia secara lokal. OCR gambar/PDF pindai menggunakan
Windows OCR dan PowerShell; fitur tersebut memerlukan Windows dengan komponen
OCR yang sesuai. Menjalankan aplikasi pada OS lain tidak otomatis menyediakan
mesin OCR Windows.

### Konfigurasi awal lokal

```powershell
npm ci
Copy-Item .env.example .env.local
# Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Migration berikut adalah urutan instalasi untuk project Supabase baru:

1. `supabase/migrations/202610290001_foundation.sql`
2. `supabase/migrations/202610290002_module_mvp.sql`
3. `supabase/migrations/20261030035918_asset_document_workflow.sql`
4. `supabase/migrations/20261030084607_dashboard_query_indexes.sql`
5. `supabase/migrations/20261030085540_hide_system_account_from_company_directory.sql`
6. `supabase/migrations/20261030101500_payment_module.sql`
7. `supabase/migrations/20261030123000_cash_advance_approval.sql`
8. `supabase/migrations/20261031100000_multi_entity_accounting_foundation.sql`
9. `supabase/migrations/20261102000100_accounting_advance_workflows.sql`
10. `supabase/migrations/20261104044243_branch_procurement_foundation.sql`
11. `supabase/migrations/20261104051705_procurement_documents.sql`
12. `supabase/migrations/20261104075321_unique_branch_accounting_mapping.sql`
13. `supabase/migrations/20261104092327_hierarchical_coa_and_posting_guards.sql`
14. `supabase/migrations/20261105032021_sales_document_numbering.sql`
15. `supabase/migrations/20261105070347_sales_shared_clients_and_sph_workflow.sql`
16. `supabase/migrations/20261105083655_sph_register_decisions_notifications.sql`

Ledger project aktif sudah memuat 16 migration sampai revisi SPH 5 November.
Lihat [status aktivasi dan transisi akses cabang](docs/implementasi-2026-11-04.md).
Pengisian Pembelian, konfigurasi pembukuan dan staging menunggu konfirmasi
pemilik; menyalin aplikasi ke laptop lain tidak memulai langkah tersebut.
Akun nonowner tidak membaca data lama yang belum dipetakan ke cabang.

Gunakan Supabase CLI untuk menerapkan dan mencatat migration. Di project baru, autentikasi dan link project lalu tinjau daftar migration sebelum `db push`. Urutan di atas adalah baseline instalasi baru, bukan instruksi untuk menjalankan ulang semua migration pada project yang sudah berisi data. Untuk setiap environment yang sudah aktif, cocokkan schema dan riwayat migration terlebih dahulu, lalu jalankan hanya migration yang memang belum diterapkan dan kompatibel. Jangan menerapkan migration terbaru ke database produksi sebelum pemeriksaan read-only dan backup/pemulihan mengikuti [status rilis migration](docs/deployment-2026-11-02.md). Migration Asset mempertahankan data lama dan mencabut jalur tulis langsung pada tabel bisnis. Pengajuan approval lama tetap tersimpan, tetapi tidak dapat dieksekusi karena belum memiliki snapshot dokumen; buat pengajuan baru melalui workflow.

Key database `owner` dipertahankan untuk **Super Admin pemilik sistem** sesuai arahan 4 November. Akun ini memiliki akses penuh lintas cabang, termasuk pemeriksaan pengajuan dengan audit, dan tidak membutuhkan penugasan jabatan karyawan. Direktori karyawan tetap memisahkan akun sistem ini. Catatan deployment lama merupakan riwayat, bukan definisi kewenangan terbaru.

Untuk project baru, setelah migration pertama buat organisasi dan keanggotaan Superuser lewat Supabase SQL Editor dengan user Auth yang sudah dibuat. Migration kedua menambahkan tabel modul, kebijakan RLS, dan audit otomatis:

```sql
insert into public.organizations (name, slug)
values ('Gema Sinergi Peradaban', 'gema-sinergi-peradaban')
returning id;

insert into public.organization_members (organization_id, user_id, role)
values ('<organization-uuid>', '<auth-user-uuid>', 'owner');
```

Jangan simpan `service_role` di `NEXT_PUBLIC_*`, browser, atau `integration_sources`. Untuk integrasi server-to-server gunakan secret manager deployment atau Supabase Vault.

## Validasi

```powershell
npm run lint
npm run typecheck
npm run test:auth
npm run test:workflow
npm run test:dashboard
npm run build
```

Tes workflow juga menguji persetujuan kasbon Manager → Finance, penolakan auditor, pertanggungjawaban, jurnal berimbang, reversal, penutupan periode, dan rekonsiliasi saldo.

Jika login berhasil tetapi kembali ke `/login?error=session_verification`, periksa koneksi **proses server Next.js** ke Supabase. Browser dan server sama-sama perlu mengakses Supabase. Server yang dijalankan dalam sandbox tanpa izin jaringan dapat gagal dengan `fetch failed` / `EACCES`, walaupun login dari browser berhasil. Jalankan ulang `npm run dev` pada terminal dengan akses jaringan yang sesuai. Jangan melewati pemeriksaan sesi untuk mengatasi masalah koneksi ini.

## Struktur

```text
src/app/(workspace)/       halaman workspace, modul, approvals, audit
src/app/login/             login Supabase
src/app/setup/             diagnostik konfigurasi/keanggotaan
src/components/            layout dan komponen UI
src/lib/auth/              konteks organisasi
src/lib/supabase/          client browser/server
supabase/migrations/       fondasi RLS, approvals, audit, integrasi
```

## Batas tahap awal

1. Jurnal manual, posting, reversal, dan perbandingan saldo buku besar dengan rekening koran sudah tersedia. Posting otomatis dari transaksi register, matching transaksi bank satu per satu, laporan formal PSAK/ISAK, dan pengelolaan multi-currency belum termasuk.
2. Tahap ini tidak menghitung, merekonsiliasi, atau mengirim pelaporan pajak.
3. Tahap ini tidak mencakup payroll, absensi, invoice masuk otomatis, penyimpanan file bukti privat, rekonsiliasi transaksi bank satu per satu, atau portal klien. Pertanggungjawaban kasbon saat ini mencatat jumlah aktual dan referensi bukti, bukan unggahan file.
4. Data diinput manual; tidak ada sinkronisasi dengan sistem eksternal.
5. Sebelum transaksi produksi, lengkapi alur bisnis, validasi, rekonsiliasi, dan pengujian RLS per peran.

Fondasi ini tidak menggantikan nasihat hukum/pajak atau proses persetujuan kebijakan perusahaan.
