# Workflow dokumen, Asset, dan Pembayaran

**Identitas sistem:** key `owner` pada tabel dan contoh teknis di bawah merupakan alias lama Superuser, bukan owner perusahaan. Akun tersebut tidak ditampilkan di directory pengguna perusahaan. Role bisnis dan akun pemeriksa akan ditetapkan kemudian; deployment ini tidak membuat akun perusahaan baru.

## Penerapan

Migration modul Pembayaran adalah `supabase/migrations/20261030101500_payment_module.sql`. Migration ini sudah diterapkan secara transaksional ke project aktif `cjxsdoxlrnpyhigkudha` dan diverifikasi: RLS aktif, policy organisasi tersedia, serta klien tidak memiliki hak tulis langsung.

Gunakan project yang sama dengan `NEXT_PUBLIC_SUPABASE_URL`. Periksa migration/schema aktif terlebih dahulu. Pada database yang sudah mempunyai foundation dan module MVP, terapkan `supabase/migrations/20261030035918_asset_document_workflow.sql` sebagai satu migration transaksional. Jangan mengulang migration lama pada data aktif tanpa memeriksa kondisinya.

Migration menambah tabel Asset, dokumen, kebijakan dan bukti eksekusi; menambah versi record pada enam tabel lama; serta mengganti jalur tulis langsung dengan RPC. Data lama dipertahankan. Data lama tidak diberi status seolah-olah telah disetujui oleh workflow baru.

Jika konektor Supabase menolak akses project, penerapan belum dapat dilakukan melalui konektor itu. URL project dan publishable/anon key hanya memberi akses aplikasi sesuai RLS; keduanya bukan izin mengubah schema. Otorisasi konektor dengan akun/organisasi yang mempunyai project tersebut. Jangan mengganti project aplikasi hanya untuk menyesuaikan akun konektor, dan jangan menaruh service-role key di browser.

## Pemakaian

1. Buka modul, isi data lalu **Simpan draft**. Daftar resmi belum berubah.
2. Buka detail draft, periksa isi tersimpan. Gunakan **Edit draft** untuk perubahan; simpan sebelum mengajukan.
3. Pilih **Ajukan pemeriksaan**. Database memilih peran pemeriksa berdasarkan kebijakan dan nominal. Harus ada anggota lain dengan peran tersebut.
4. Pemeriksa membuka dokumen, membaca isi versi terkunci dan memberi catatan wajib sebelum menyetujui atau menolak. Pengaju tidak boleh memeriksa sendiri, termasuk jika berperan owner/direksi.
5. Setelah disetujui, pengaju yang masih berhak menulis, pemeriksa sesuai peran, atau owner dapat mengeksekusi. Setelah dieksekusi, record resmi muncul/berubah.
6. Dokumen ditolak dapat dibuka sebagai revisi oleh pembuatnya. Versi naik dan keputusan lama tidak berlaku untuk versi baru.
7. Perubahan record resmi dilakukan melalui **Usulkan perubahan**, termasuk perpindahan lokasi/penanggung jawab, perbaikan atau penonaktifan aset. Dokumen yang sudah dieksekusi tidak diedit ulang.

Untuk aset, nilai perolehan adalah nilai yang dicatat, bukan nilai buku setelah penyusutan. Penyusutan, jurnal pembelian, pemeliharaan berkala dan pelacakan QR belum termasuk implementasi ini.

## Kebijakan dan hak akses

Kebijakan awal untuk delapan jenis dokumen memakai peran `director`. Owner mengubahnya melalui `/pengaturan/persetujuan`. Penentuan ini adalah baseline yang dapat dikonfigurasi, bukan asumsi bahwa perusahaan sudah mengesahkan kebijakan tersebut.

| Jenis dokumen | Pembuat draft |
| --- | --- |
| Kontak | owner, director, operations, staff |
| Proyek | owner, director, operations |
| Pekerjaan | owner, director, operations, staff |
| Akun keuangan | owner, finance |
| Karyawan | owner, hr |
| Pajak | owner, finance |
| Asset | owner, finance, operations |
| Pembayaran | owner, finance |

Pemeriksa dipilih dari peran yang dapat membaca modul terkait. Aset memakai `purchase_cost`, pajak memakai `tax_amount`, dan pembayaran memakai `amount` untuk eskalasi nominal. Nominal ≥ batas menggunakan peran eskalasi; batas kosong menonaktifkan eskalasi. Perubahan kebijakan berlaku untuk pengajuan berikutnya. Pengajuan berjalan mempertahankan snapshot kebijakan saat diajukan.

Modul Pembayaran tahap awal mencatat kewajiban/tagihan keluar. Record baru selalu dimulai sebagai `unpaid`. Perubahan menjadi `paid` harus dibuat sebagai proposal update, disertai tanggal dan metode pembayaran, lalu melalui approval dan eksekusi. Pembayaran yang sudah lunas dikunci dari perubahan UI maupun RPC. Tagihan terlambat dihitung dari `due_on` dan status belum lunas. Modul ini belum mengunggah invoice/bukti bayar, membuat jurnal, mengirim pembayaran ke bank, atau melakukan rekonsiliasi.

## Jaminan database

- RPC `save_workflow_draft` memeriksa membership, hak jenis dokumen, whitelist field, nilai, relasi satu organisasi, versi formulir/draft dan kepemilikan draft. ID organisasi/pembuat tidak berasal dari payload klien.
- `submit_workflow_document` mengunci dokumen, memeriksa versi dan target, menyimpan snapshot, menentukan pemeriksa dari kebijakan, serta mencegah pengajuan ganda untuk versi yang sama.
- `review_approval_request` mengunci dokumen dan request dengan urutan konsisten; memeriksa peran, larangan review sendiri, organisasi, ID target, isi dan versi. Persetujuan juga memeriksa versi record resmi.
- `execute_workflow_document` hanya menerapkan versi disetujui yang snapshot-nya cocok. Perubahan target memakai row lock dan optimistic version. Record berubah, bukti eksekusi, status dokumen dan audit ditulis dalam satu transaksi.
- Eksekusi ulang yang sah mengembalikan ID hasil yang sama. Primary key pada bukti eksekusi dan row lock mencegah efek bisnis kedua.
- Hak tulis langsung, termasuk TRUNCATE, dicabut dari `PUBLIC`, `anon`, `authenticated` pada tabel bisnis dan workflow. Klien hanya menerima SELECT dengan RLS dan EXECUTE pada RPC yang diperlukan. Fungsi internal berada di schema privat dengan hak eksekusi dicabut.
- RLS tetap memeriksa membership terkini; pengaju yang keluar dari organisasi tidak mempertahankan hak baca melalui `requested_by`.
- Service role/administrator database tetap merupakan akses tepercaya yang dapat melewati RLS. Tidak ada service role pada alur aplikasi ini.

Jika record resmi telah berubah sejak formulir atau usulan dibuat, sistem menolak versi lama. Buat usulan baru dari record terbaru; sistem tidak menggabungkan perubahan secara diam-diam.

## Pengujian

`npm run test:workflow` menjalankan migration asli di PostgreSQL lokal melalui PGlite, dengan stub minimal `auth.users`/`auth.uid()` dan role `anon`/`authenticated`. Pengujian memeriksa lifecycle semua jenis record, RLS lintas organisasi, pencabutan membership, larangan review sendiri, versi stale, snapshot yang diubah, kebijakan/eskalasi, rollback atomik dan idempotensi.

`node scripts/verify-workflow-ui.cjs` memerlukan Playwright pada module search path dan Chrome terpasang. Harness memakai database lokal dan endpoint Supabase-compatible pada port 54329, lalu Next.js terisolasi pada port 3100. Browser dan server memakai fixture tersebut; tidak ada akun/data produksi yang digunakan. Tes mencakup pembuatan aset, penyimpanan edit sebelum pengajuan, pemeriksa berbeda, eksekusi, serta penolakan–revisi–pengajuan ulang–eksekusi perubahan aset. Port 3000 tetap dipakai aplikasi utama.

PGlite memiliki satu koneksi eksekusi; tes ini tidak menggantikan pengujian kontensi multi-koneksi pada PostgreSQL deployment. Row lock, unique constraints dan transaksi tersedia di migration; pengujian deployment/advisor tetap perlu dilakukan setelah akses project aktif tersedia.
