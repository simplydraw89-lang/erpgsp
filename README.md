# GSP — Gema Sinergi Peradaban

Fondasi workspace ERP modular untuk menyatukan akses ke sistem perusahaan dengan prinsip **check and balance**. Aplikasi baru ini memakai Next.js App Router, TypeScript, Tailwind CSS, komponen bergaya shadcn/ui, Supabase Auth, PostgreSQL, dan Row Level Security.

## Status modul

Repository ini merupakan ERP baru. Setelah migration Asset/workflow diterapkan, data baru dan perubahan disimpan sebagai draft. Data resmi baru berubah setelah pengajuan disetujui dan dieksekusi. Belum ada sinkronisasi otomatis dengan aplikasi eksternal.

| Modul | Kemampuan MVP tahap 1 |
| --- | --- |
| CRM & Proyek | Pencatatan kontak/prospek dan proyek |
| Asset Perusahaan | Kode, kategori, nomor seri, lokasi, penanggung jawab, nilai perolehan, kondisi/status dan usulan perubahan aset |
| Operasional | Daftar pekerjaan, prioritas, dan tenggat |
| Keuangan | Bagan akun; jurnal dan posting akuntansi belum tersedia |
| Pembayaran | Tagihan keluar, penerima, nilai, jatuh tempo, status belum lunas/lunas, serta perubahan status melalui approval |
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
- Perubahan data modul tahap awal direkam ke jejak audit melalui trigger database.
- RLS membatasi data berdasarkan organisasi dan peran, termasuk data sensitif SDM dan keuangan.
- Draft → diajukan → disetujui/ditolak → dieksekusi berlaku pada seluruh jenis record modul, termasuk Asset.
- Pemeriksa ditentukan oleh kebijakan organisasi; administrator sistem mengaturnya di `/pengaturan/persetujuan`. Pengaturan awal memakai direksi. Aset, pajak, dan pembayaran mendukung eskalasi nominal.
- Snapshot isi dokumen, versi dan kebijakan disimpan saat pengajuan. Dokumen yang diajukan terkunci. Revisi versi ditolak membutuhkan pengajuan baru.
- Tabel bisnis tidak menerima insert/update/delete/truncate dari klien. Eksekusi hanya melalui RPC dengan row lock, pemeriksaan versi dan satu bukti eksekusi unik per dokumen.
- [Panduan workflow dan penerapan database](docs/workflow.md).

## Menjalankan lokal

```powershell
npm install
Copy-Item .env.example .env.local
# Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Jalankan migration berikut secara berurutan pada project Supabase baru:

1. `supabase/migrations/202610290001_foundation.sql`
2. `supabase/migrations/202610290002_module_mvp.sql`
3. `supabase/migrations/20261030035918_asset_document_workflow.sql`
4. `supabase/migrations/20261030084607_dashboard_query_indexes.sql`
5. `supabase/migrations/20261030085540_hide_system_account_from_company_directory.sql`
6. `supabase/migrations/20261030101500_payment_module.sql`

Untuk project yang sudah memakai dua migration awal, terapkan migration berikutnya berurutan setelah memeriksa schema aktif. Migration Asset mempertahankan data lama dan mencabut jalur tulis langsung pada tabel bisnis. Pengajuan approval lama tetap tersimpan, tetapi tidak dapat dieksekusi karena belum memiliki snapshot dokumen; buat pengajuan baru melalui workflow.

Key database `owner` adalah alias lama untuk **Superuser teknis**, bukan role pemilik perusahaan. Label antarmuka memakai Superuser; akun ini disembunyikan dari directory pengguna perusahaan dan pilihan penanggung jawab. Penetapan role bisnis akan dilakukan terpisah. Lihat [status deployment aktif](docs/deployment-2026-10-30.md).

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

1. Modul Pembayaran tahap awal adalah register tagihan keluar; belum membuat jurnal atau posting akuntansi.
2. Tahap ini tidak menghitung, merekonsiliasi, atau mengirim pelaporan pajak.
3. Tahap ini tidak mencakup payroll, absensi, invoice masuk otomatis, unggah bukti bayar, rekonsiliasi bank, atau portal klien.
4. Data diinput manual; tidak ada sinkronisasi dengan sistem eksternal.
5. Sebelum transaksi produksi, lengkapi alur bisnis, validasi, rekonsiliasi, dan pengujian RLS per peran.

Fondasi ini tidak menggantikan nasihat hukum/pajak atau proses persetujuan kebijakan perusahaan.
