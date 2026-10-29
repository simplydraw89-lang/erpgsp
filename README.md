# GSP — Gema Sinergi Peradaban

Fondasi workspace ERP modular untuk menyatukan akses ke sistem perusahaan dengan prinsip **check and balance**. Aplikasi baru ini memakai Next.js App Router, TypeScript, Tailwind CSS, komponen bergaya shadcn/ui, Supabase Auth, PostgreSQL, dan Row Level Security.

## Sistem sumber yang dianalisis

| Sistem | Kondisi yang ditemukan | Arah integrasi |
| --- | --- | --- |
| `bindex-main` | Next.js 14 dan Supabase; accounting/finance, CRM dasar, aset, SDM, administrasi, dan laporan. | Petakan perusahaan, user/role, COA, jurnal, aset, dan HR ke modul keuangan/SDM terpadu. |
| `GSP-staging` | Next.js 16, Supabase, Tailwind, dan workflow CRM/proyek, quotation, operasi, invoice, expense, portal klien, serta audit. | Jadikan CRM dan operasi sebagai sumber proses bisnis; pertahankan batas data klien dan project. |
| `aplikasi-pajak` | Next.js 15 terpisah dengan backend FastAPI; kalkulator, transaksi, rekonsiliasi, aset, ekspor, dan administrasi pajak. | Pindahkan layanan pajak secara bertahap ke Supabase/Next.js, setelah aturan dan kontrak data diverifikasi. |

Ketiga sistem saat ini **belum** dikonsolidasikan oleh source code ini. Proyek baru menyiapkan satu shell, registri modul, autentikasi/keanggotaan organisasi, antrean persetujuan, dan jejak audit. Integrasi data nyata perlu dilakukan bertahap memakai migration dan kontrak API; jangan menyalin SQL lama ke database produksi tanpa pemetaan, uji migrasi, serta persetujuan pemilik data.

## Check and balance

- Perusahaan dibatasi melalui `organization_id` dan Supabase RLS.
- Pengaju tidak dapat menyetujui permintaannya sendiri.
- Persetujuan hanya melalui RPC transaksional `review_approval_request`; klien tidak memperoleh izin untuk mengubah status secara langsung.
- Keputusan merekam pemeriksa, waktu, alasan, dan peristiwa audit.
- Peran auditor hanya-baca untuk jejak audit; kredensial service role tidak dipakai di browser atau disimpan dalam registri integrasi.
- Status modul menunggu integrasi ditampilkan apa adanya; dashboard tidak mengarang angka lintas sistem.

## Menjalankan lokal

```powershell
npm install
Copy-Item .env.example .env.local
# Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Jalankan migration `supabase/migrations/202610290001_foundation.sql` pada **project Supabase baru/non-produksi**. Setelah itu buat organisasi dan keanggotaan owner lewat Supabase SQL Editor dengan user Auth yang sudah dibuat:

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
npm run build
```

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

## Tahapan sebelum data operasional dipindahkan

1. Tetapkan identitas perusahaan, cabang, akun pengguna, owner data, dan kebijakan pemisahan tugas.
2. Buat pemetaan skema untuk tiga sistem dan sepakati sumber kebenaran tiap entitas; jangan menyatukan tabel ber-nama sama sebelum konflik identitas diperiksa.
3. Sepakati kontrak API, event, dan strategi sinkronisasi; gunakan ID eksternal yang stabil dan idempotensi.
4. Migrasikan satu domain pada database staging terisolasi, dengan backup, validasi jumlah/total, rekonsiliasi, dan rencana rollback.
5. Uji RLS lintas organisasi/peran, kasus pengaju=penyetuju, akses portal klien, serta jejak audit sebelum rilis.
6. Cutover per modul dengan pemilik bisnis; pertahankan aplikasi lama sebagai read-only selama masa rekonsiliasi.

Fondasi ini tidak menggantikan nasihat hukum/pajak atau proses persetujuan kebijakan perusahaan.
