# GSP — Gema Sinergi Peradaban

Fondasi workspace ERP modular untuk menyatukan akses ke sistem perusahaan dengan prinsip **check and balance**. Aplikasi baru ini memakai Next.js App Router, TypeScript, Tailwind CSS, komponen bergaya shadcn/ui, Supabase Auth, PostgreSQL, dan Row Level Security.

## Status modul

Repository dan project Supabase ini merupakan ERP baru. Modul pada tahap awal menyimpan catatan langsung di database ERP; belum ada sinkronisasi otomatis dengan repository atau aplikasi eksternal.

| Modul | Kemampuan MVP tahap 1 |
| --- | --- |
| CRM & Proyek | Pencatatan kontak/prospek dan proyek |
| Operasional | Daftar pekerjaan, prioritas, dan tenggat |
| Keuangan | Bagan akun; jurnal dan posting akuntansi belum tersedia |
| SDM | Data dasar karyawan; payroll belum tersedia |
| Perpajakan | Pencatatan masa, jenis, dasar, dan nilai pajak; kalkulasi/pelaporan resmi belum tersedia |
| Manajemen & Laporan | Jumlah catatan per modul, dibatasi untuk owner/direksi |

Integrasi sistem eksternal memerlukan URL API/repository sumber, kontrak data, pemetaan identitas, kredensial server yang disimpan dengan aman, dan persetujuan sebelum sinkronisasi atau migrasi data.

## Check and balance

- Perusahaan dibatasi melalui `organization_id` dan Supabase RLS.
- Pengaju tidak dapat menyetujui permintaannya sendiri.
- Persetujuan hanya melalui RPC transaksional `review_approval_request`; klien tidak memperoleh izin untuk mengubah status secara langsung.
- Keputusan merekam pemeriksa, waktu, alasan, dan peristiwa audit.
- Peran auditor hanya-baca untuk jejak audit; kredensial service role tidak dipakai di browser atau disimpan dalam registri integrasi.
- Perubahan data modul tahap awal direkam ke jejak audit melalui trigger database.
- RLS membatasi data berdasarkan organisasi dan peran, termasuk data sensitif SDM dan keuangan.

## Menjalankan lokal

```powershell
npm install
Copy-Item .env.example .env.local
# Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Jalankan migration berikut secara berurutan pada project Supabase baru:

1. `supabase/migrations/202610290001_foundation.sql`
2. `supabase/migrations/202610290002_module_mvp.sql`

Setelah migration pertama, buat organisasi dan keanggotaan owner lewat Supabase SQL Editor dengan user Auth yang sudah dibuat. Migration kedua menambahkan tabel modul, kebijakan RLS, dan audit otomatis:

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

## Batas tahap awal

1. Tahap ini tidak membuat jurnal atau posting akuntansi.
2. Tahap ini tidak menghitung, merekonsiliasi, atau mengirim pelaporan pajak.
3. Tahap ini tidak mencakup payroll, absensi, quotation/invoice, atau portal klien.
4. Data diinput manual; tidak ada sinkronisasi dengan sistem eksternal.
5. Sebelum transaksi produksi, lengkapi alur bisnis, validasi, rekonsiliasi, dan pengujian RLS per peran.

Fondasi ini tidak menggantikan nasihat hukum/pajak atau proses persetujuan kebijakan perusahaan.
