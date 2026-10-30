# Status penerapan — 30 Oktober 2026

Project: `erpgsp` (`cjxsdoxlrnpyhigkudha`). Akses administrasi tersedia melalui Supabase CLI setelah login; konektor Supabase percakapan memakai akun berbeda, sehingga deployment ini memakai CLI dengan project ref eksplisit.

Update lanjutan: migration Pembayaran `20261030101500_payment_module.sql` diterapkan dalam satu transaksi setelah catatan deployment ini. Verifikasi read-only mengonfirmasi tabel, RLS, policy organisasi, audit trigger, konfigurasi akses, indeks, serta tidak adanya privilege tulis langsung untuk `authenticated`/`anon`.

## Perubahan aktif

- Migration Asset/workflow `20261030035918` diterapkan dalam satu transaksi; tabel dan data lama dipertahankan.
- Tabel `company_assets`, `workflow_documents`, `approval_policies`, `workflow_executions` tersedia. Tujuh kebijakan baseline dan enam RPC tersedia.
- Indeks dashboard pribadi, antrean pemeriksa dan tenggat pajak ditambahkan melalui migration `20261030084607`.
- Migration `20261030085540` menyembunyikan akun teknis dari directory anggota yang dibaca pengguna perusahaan. Query pilihan penanggung jawab juga mengecualikan akun teknis.
- Dashboard baru menggunakan data pengguna dan organisasi aktif, kategori aplikasi sesuai peran, pencarian Ctrl+K, menu akun dan pintasan pengajuan pribadi.

## Akun sistem dan role perusahaan

Pengguna mengklarifikasi bahwa akun yang memakai key database `owner` adalah **Superuser teknis**, bukan pemilik perusahaan atau direksi. Key lama tetap digunakan untuk kompatibilitas authorization; seluruh label antarmuka kini menyebut Superuser. Akun ini mempunyai akses seluruh modul pada workspace. Tidak ada akun perusahaan atau penugasan role bisnis baru yang dibuat dalam deployment ini.

Role perusahaan dan pemeriksa akan disusun kemudian setelah modul dirapikan. Baseline kebijakan tetap mensyaratkan pemeriksa berbeda dari pengaju; Superuser tidak otomatis menyetujui pengajuannya sendiri. Pengajuan yang membutuhkan role pemeriksa tanpa anggota yang sesuai tetap ditolak secara aman.

## Verifikasi

Pemeriksaan database aktif dilakukan sebagai role `authenticated` di dalam transaksi yang di-rollback: draft tidak mengubah inventaris resmi, perubahan status langsung ditolak dan eksekusi tanpa persetujuan ditolak. RLS aktif pada seluruh tabel baru; `anon` tidak dapat mengeksekusi RPC eksekusi; `authenticated` dapat memanggilnya dengan pemeriksaan di dalam fungsi. Data uji tidak dipertahankan.

Tes PostgreSQL lokal menggunakan migration asli memeriksa seluruh lifecycle, versi, isolasi organisasi, hak akses, snapshot, idempotensi, rollback dan privasi directory Superuser. Tes browser terisolasi menguji login → dashboard → Asset → pengajuan → pemeriksaan → eksekusi serta revisi, pengaturan pemeriksa, pencarian, hak akses dan layout mobile.

CLI `db advisors --linked` tidak berhasil mengautentikasi temporary role `cli_login_postgres`; hasil advisor penuh belum tersedia. Pemeriksaan schema dan hak akses lewat `db query` Management API berhasil. Tidak ada password database atau service-role key yang ditambahkan ke aplikasi untuk mengatasi kegagalan advisor.

Schema awal tidak mempunyai tabel `supabase_migrations.schema_migrations` karena fondasi sebelumnya diterapkan manual. Perubahan ini juga diterapkan memakai SQL file sumber melalui `db query`. Baseline riwayat migration perlu ditata sebelum mengganti deployment ke `db push`; jangan mengulang migration Asset pada schema aktif yang sudah memilikinya.
