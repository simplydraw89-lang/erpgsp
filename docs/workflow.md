# Workflow dokumen, Asset, dan Pembayaran

**Identitas sistem:** key `owner` adalah Super Admin pemilik sistem dengan akses penuh sesuai arahan 4 November 2026. Akun sistem terpisah dari direktori karyawan. Untuk alur pusat–cabang/pengajuan baru, baca [aturan pengembangan](aturan-pengembangan.md) dan [status implementasi](implementasi-2026-11-04.md). Dokumen di bawah mempertahankan penjelasan workflow lama; pembukaan akses pengguna perusahaan mengikuti migration pusat–cabang.

## Penerapan

Migration modul Pembayaran adalah `supabase/migrations/20261030101500_payment_module.sql`. Migration ini sudah diterapkan secara transaksional ke project aktif `cjxsdoxlrnpyhigkudha` dan diverifikasi: RLS aktif, policy organisasi tersedia, serta klien tidak memiliki hak tulis langsung.

Gunakan project yang sama dengan `NEXT_PUBLIC_SUPABASE_URL`. Periksa migration/schema aktif terlebih dahulu. Pada database yang sudah mempunyai foundation dan module MVP, terapkan `supabase/migrations/20261030035918_asset_document_workflow.sql` sebagai satu migration transaksional. Jangan mengulang migration lama pada data aktif tanpa memeriksa kondisinya.

Migration menambah tabel Asset, dokumen, kebijakan dan bukti eksekusi; menambah versi record pada enam tabel lama; serta mengganti jalur tulis langsung dengan RPC. Data lama dipertahankan. Data lama tidak diberi status seolah-olah telah disetujui oleh workflow baru.

Jika konektor Supabase menolak akses project, penerapan belum dapat dilakukan melalui konektor itu. URL project dan publishable/anon key hanya memberi akses aplikasi sesuai RLS; keduanya bukan izin mengubah schema. Otorisasi konektor dengan akun/organisasi yang mempunyai project tersebut. Jangan mengganti project aplikasi hanya untuk menyesuaikan akun konektor, dan jangan menaruh service-role key di browser.

## Pemakaian

Arahan 5 November: pengisian transaksi pembelian dan staging menunggu konfirmasi pemilik. Fokus saat ini Klien dan SPH; jangan menjalankan konfigurasi pembukuan sebagai bagian pengujian Penjualan.

Klik modul dari dashboard untuk membukanya di tab baru; dashboard tetap tersedia pada tab asal. Penjualan menampilkan popup pilihan terlebih dahulu, kemudian Klien/SPH/SPK yang dipilih dibuka di tab baru. Pilih **Buka dokumen** atau **Lihat dokumen di tab baru** untuk menampilkan PDF/gambar lampiran langsung di browser. Endpoint memeriksa sesi dan akses, lalu menyajikan berkas secara inline dari Storage privat tanpa unduhan paksa.

### Batas Pengajuan Pembelian dan Pengajuan Penjualan

**Label navigasi terbaru:** gunakan **Pembelian** dan **Penjualan**. Kelompok **Pekerjaan saya** menaungi Pengajuan saya, ruang kerja dan Persetujuan. Daftar Pengajuan saya hanya berisi data buatan akun aktif (filter organisasi dan pembuat pada setiap sumber), sedangkan permintaan pihak lain yang wajib diperiksa/dijalankan tampil di antrean kewenangan tersendiri. Popup Pengajuan saya yang sebelumnya berisi pintasan membuat pengajuan diganti halaman daftar pribadi. Tautan lama `/approvals?scope=mine` dialihkan ke `/pekerjaan-saya/pengajuan`.

- **Pengajuan Pembelian** (`/pengajuan/pembelian`) sementara hanya berisi pembelian: daftar pembelian, verifikasi, utang dan pembayaran, tanpa submenu modul lain. Kelola COA melalui **Keuangan → Bagan Akun**. Pilihan COA pada rincian invoice tetap tersedia.
- **Vendor** (`/vendor`) merupakan satu menu mandiri pada kelompok Operasional, tanpa tab daftar vendor di Pembelian. Daftar menggabungkan kebutuhan proyek dan nonproyek, termasuk lab/subkon, mengikuti cakupan cabang dan verifikasi Finance. Tautan lama `/pengajuan/vendor` dialihkan sambil mempertahankan pesan proses. Form invoice tetap dapat mengusulkan vendor baru tanpa meninggalkan draft.
- **Cuti** dan **Perjalanan dinas** tersedia pada kelompok Pengajuan sebagai menu awal; formulir, penyimpanan dan persetujuan belum aktif sampai aturan lanjutannya ditentukan.
- **Pengajuan Penjualan** (`/pengajuan/penjualan`) membuka popup **Klien**, **SPH**, dan **SPK**. Masing-masing mempunyai halaman tersendiri; SPH dan SPK membuka daftar. Pilih **Buat SPH** untuk formulir baru. Setelah simpan/submit, kembali ke daftar SPH cabang. Sesudah Direktur Keuangan menyetujui, pengaju/Super Admin dapat memilih **Buat SPK** pada daftar untuk membuka persiapan form dengan referensi SPH. Rincian form SPK menunggu arahan. Surat dibuat manual dan diunggah sebagai PDF/PNG/JPEG maksimal 10 MB per berkas, privat tanpa OCR otomatis.
- Nomor SPH berurutan satu perusahaan lintas cabang mulai 1 tanpa reset periode. Kegagalan transaksi tidak menghabiskan nomor. Nomor tidak dapat diedit dan dokumen bernomor tidak dapat dihapus; akses cabang tetap membatasi nomor/dokumen yang terlihat bagi tiap pengguna.
- Tahap berikutnya: setelah dokumen penjualan lengkap, buat proyek berdasarkan SPK dengan manpower pada draft; proyek masuk Pekerjaan saya anggota yang ditugaskan. Dokumen RAB, teknis pekerjaan dan timesheet sementara dibuat manual lalu diunggah. Sambungan proyek/unggahan tersebut belum tersedia pada revisi pemisahan menu penjualan.
- Halaman, pengambilan data, formulir dan server actions penjualan dipisahkan dari pembelian. Infrastruktur identitas, pembatasan cabang dan lampiran privat dapat dipakai bersama. Penyesuaian penjualan tidak menambah formulir atau prasyarat ke pembelian.
- Tautan lama `/pengajuan?view=...` diarahkan ke halaman domain yang sesuai, dengan pesan berhasil/gagal dipertahankan. Pintasan pembelian dan penjualan tersedia terpisah pada navigasi aplikasi.

### Klien dan SPH — revisi 5 November

1. Daftarkan klien dengan nama, alamat, NPWP, nomor kontak, email dan jenis usaha Mining/Migas/Industri/Umum; informasi lainnya opsional. Tidak memilih cabang dan tidak membutuhkan persetujuan. Data menjadi master perusahaan bersama. Super Admin, Direksi, Manager Cabang, Admin Cabang, Project Manager dan Marketing dapat mencari/membaca daftar; pengguna internal lain dapat mendaftar tanpa melihat daftar. Identitas diperiksa formatnya, bukan validasi NPWP online.
2. Pada SPH, pilih cabang yang tersedia menurut penugasan, lalu cari klien dalam dropdown. Daftar memuat 10 hasil per pengambilan; scroll untuk hasil berikutnya. Isi judul, daerah pengerjaan, checklist lingkup, status deal dan masa berlaku. Bidang usaha mengikuti klien. Tambahkan catatan/arahan dan berkas manual melalui **+ Tambah lampiran**, maksimal 10 berkas PDF/PNG/JPEG, masing-masing 10 MB.
3. **Simpan ke draft** cukup memerlukan cabang, klien dan judul. **Submit SPH** memeriksa kelengkapan, termasuk nilai SPH positif, lalu meminta konfirmasi kebenaran data. **Ya** mengajukan; **Tidak** menyimpan draft. Keduanya kembali ke daftar SPH dengan filter cabang. Kegagalan terlihat dan data formulir SPH dipertahankan. Daftar menampilkan urutan, nomor, tanggal, inti judul/keterangan, lingkup, nilai dan posisi/status; rekan satu cabang melihat ringkasannya tanpa membuka detail, catatan atau lampiran. Pengajuan saya tetap hanya buatan akun aktif.
4. Antrean dashboard/Persetujuan dan lonceng menampilkan **Butuh persetujuan saya** untuk Manager Cabang, lalu Direktur Keuangan. Pengaju Manager langsung ke Direktur. Pilih **Setujui / Approve**, **Revisi**, atau **Tolak**. Alasan wajib untuk Revisi/Tolak. Revisi kembali untuk diperbaiki dan diajukan ulang, Tolak mengakhiri pengajuan. Dokumen terkirim/ditolak terkunci dan versi lama ditolak. Pengaju tidak memeriksa sendiri, selain override Super Admin yang diaudit. Detail hanya tersedia bagi pengaju, pemeriksa tahap aktif dan Super Admin; selesai memutuskan, pemeriksa kembali ke daftar.
5. Sesudah Direktur menyetujui, pengaju menerima **SPH perlu tindak lanjut** dan tombol **Buat SPK** tersedia. Accounting–Tax/Finance bukan tahap approval SPH terbaru. Revisi/Tolak juga muncul sebagai tindak lanjut dengan alasan verifikator. Lonceng diperbarui saat dibuka, saat tab fokus, dan tiap 30 detik selama tab terlihat. Notifikasi ini di dalam aplikasi, tanpa email/WhatsApp. Status deal atau approval tidak menganggap klien telah menyepakati; bukti bilateral tetap informasi tersendiri. Tidak membuat jurnal atau pembayaran. Lampiran privat dibuka di tab baru sesuai izin dokumen.

### Workflow dokumen lama

Bagian berikut mendokumentasikan workflow dokumen lama; Klien/SPH mengikuti alur khusus di atas dan [PRD](PRD.md).

1. Buka modul, isi data lalu **Simpan draft**. Daftar resmi belum berubah.
2. Buka detail draft, periksa isi tersimpan. Gunakan **Edit draft** untuk perubahan; simpan sebelum mengajukan.
3. Pilih **Ajukan pemeriksaan**. Database memilih peran pemeriksa berdasarkan kebijakan dan nominal. Harus ada anggota lain dengan peran tersebut.
4. Pemeriksa membuka dokumen, membaca isi versi terkunci dan memberi catatan wajib sebelum menyetujui atau menolak. Pengaju tidak boleh memeriksa sendiri, termasuk jika berperan owner/direksi.
5. Setelah disetujui, pengaju yang masih berhak menulis, pemeriksa sesuai peran, atau owner dapat mengeksekusi. Setelah dieksekusi, record resmi muncul/berubah.
6. Dokumen ditolak dapat dibuka sebagai revisi oleh pembuatnya. Versi naik dan keputusan lama tidak berlaku untuk versi baru.
7. Perubahan record resmi dilakukan melalui **Usulkan perubahan**, termasuk perpindahan lokasi/penanggung jawab, perbaikan atau penonaktifan aset. Dokumen yang sudah dieksekusi tidak diedit ulang.

Untuk aset, nilai perolehan adalah nilai yang dicatat, bukan nilai buku setelah penyusutan. Penyusutan, jurnal pembelian, pemeliharaan berkala dan pelacakan QR belum termasuk implementasi ini.

## Akuntansi dan pertanggungjawaban kasbon

Migration tambahan bertanggal 2 November menambahkan administrasi entitas/keanggotaan, periode, jurnal double-entry, reversal, rekonsiliasi saldo, dan settlement kasbon. Terapkan hanya sesudah membandingkan schema environment; lihat [status rilis migration](deployment-2026-11-02.md).

- Pengelola yang berwenang membuat entitas induk dahulu, kemudian anak/cabang, dan memberi keanggotaan entitas. Membuat periode menolak rentang yang tumpang tindih. Periode dengan jurnal draft tidak dapat ditutup; periode tertutup tidak dapat dipakai untuk jurnal baru.
- Finance/Superuser membuat jurnal manual dengan dua hingga enam baris pada UI. Database menolak jurnal tidak seimbang, akun nonaktif, dan tanggal di luar periode terbuka. Draft dapat diposting atau dibatalkan. Jurnal posted tidak dapat diedit; reversal membuat draft pembalik, dan jurnal sumber ditandai `reversed` hanya setelah jurnal pembalik berhasil diposting.
- Rekonsiliasi saat ini membandingkan saldo rekening koran yang diinput dengan total saldo buku besar sampai tanggal tersebut. Selisih disimpan sebagai `variance` untuk investigasi. Ini adalah pemeriksaan saldo, **belum** pencocokan transaksi/mutasi rekening satu per satu atau impor rekening koran.
- Kasbon memerlukan persetujuan Manager lalu Finance. Setelah pencairan tagihan dicatat lunas, pengaju mengirim total pengeluaran, uang yang dikembalikan, dan/atau tambahan yang perlu dibayar. Rumus wajib `biaya aktual + pengembalian = uang muka + tambahan`; Finance lain menyetujui atau menolak. Approval menutup kasbon; jika ada tambahan, sistem membuat kewajiban pembayaran belum lunas dengan tanggal jatuh tempo yang diberikan.
- Referensi kuitansi dapat dicatat, tetapi upload dan storage bukti privat belum tersedia. Finance yang mengajukan pertanggungjawaban tidak dapat menyetujui sendiri.
- Auditor hanya-baca, termasuk untuk kasbon; keputusan tetap ditegakkan di RPC/database, bukan hanya dengan menyembunyikan tombol.

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
