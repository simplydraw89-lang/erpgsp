# Status implementasi — 4 November 2026

## Lingkungan

- Checkout lokal: Next.js 16.4.3, server pengembangan `http://localhost:3000`.
- Konfigurasi aplikasi tetap project `cjxsdoxlrnpyhigkudha`; publishable key cocok dengan yang diberikan pengguna. Tidak dibuat staging atau akun Auth tambahan.
- Plugin Supabase masih menampilkan akun/project yang berbeda. Koneksi **CLI 2.122.0 yang sudah tertaut berhasil mengakses project aplikasi** dan digunakan untuk aktivasi. Setelah lanjutan daftar SPH/notifikasi 5 November, ledger remote memuat 16 migration sampai `20261105083655_sph_register_decisions_notifications`.
- Publishable key berfungsi untuk akses aplikasi di bawah RLS. Key ini tidak memberikan hak menjalankan DDL/migration, membaca daftar pengguna Auth, atau mengatur keanggotaan database.
- Verifikasi remote: satu akun Auth dan satu keanggotaan owner; pusat, Surabaya, Jogjakarta, Jakarta tersedia; RLS tabel pengajuan aktif; RPC bisnis memakai invoker wrapper, dapat dipanggil authenticated dan ditolak untuk anon; bucket procurement-documents privat dengan delapan restrictive guard.
- Probe HTTP ke tabel business_units dan RPC konfigurasi baru mengembalikan `401 / 42501` untuk akses anonim: endpoint sudah terpublikasi dan izin ditolak sebagaimana mestinya, bukan error schema hilang. Localhost/login merespons 200. Probe tidak membuat konfigurasi atau transaksi.
- Saat aktivasi pertama, COA, entitas pembukuan dan periode masih kosong. Revisi COA sudah dipasang dan diverifikasi: **98 node (7 akar, 34 kelompok dan 64 akun detail)**, nol induk tidak valid; akun Auth tetap satu, vendor/pengajuan/jurnal masih nol. Pemasangan dicatat sebagai `coa.migration_seeded`, sumber `authorized_cli_migration`, tanpa saldo awal. Tombol **Siapkan pembukuan pembelian** tetap muncul bila cabang/periode belum dipetakan: Super Admin memilih bulan dan menyiapkan satu induk serta tiga cabang pembukuan. Chart berjenjang yang sama dipakai bootstrap organisasi baru. Tidak membuat transaksi contoh.
- Snapshot pemulihan fungsi/policy/grant/ledger disimpan pada `.local-backups/` yang diabaikan Git sebelum penerapan. Ini snapshot schema, bukan backup seluruh data bisnis. Dry-run hanya memilih migration yang belum terpasang; tidak ada reset database, seed transaksi atau perubahan Vault.

## Perubahan yang disiapkan

### Lanjutan daftar SPH, keputusan dan notifikasi — 5 November 2026

Arahan terbaru dikonfirmasi pemilik: SPK dapat dipersiapkan setelah Direktur Keuangan menyetujui, tanpa tahap Accounting–Tax/Finance SPH. Ini menggantikan alur empat tahap pada catatan Klien/SPH sebelumnya di bawah.

- Menu SPH menampilkan daftar cabang, tombol Buat SPH membuka `/pengajuan/penjualan/sph/baru`. Simpan draft/submit kembali ke daftar dengan filter cabang. Daftar memakai RPC ringkasan terpisah, 50 baris per halaman, nomor urut tabel/nomor SPH/tanggal/inti judul/lingkup/nilai/status/posisi pemeriksa dan tombol Buat SPK. Nilai SPH diisi manual (IDR, maksimal dua desimal; wajib positif saat submit). Rekan satu cabang dapat melihat ringkasan tanpa akses detail, catatan, audit atau lampiran. RLS dan Storage memberi detail kepada pengaju yang masih berhak, pemeriksa tahap aktif dan Super Admin. Ruang Pengajuan saya tetap creator-only.
- Keputusan Setujui/Revisi/Tolak. Revisi/Tolak memerlukan alasan di UI dan RPC. Revisi dapat diedit/diajukan ulang dengan versi yang benar; Tolak mengunci dokumen sebagai keputusan akhir. Legacy boolean review negatif dipetakan ke Revisi. Fungsi base yang mempertahankan implementasi lama dicabut hak execute-nya dari klien sehingga tidak dapat melewati validasi baru.
- Notifikasi internal dinamis: Butuh persetujuan saya bagi Manager, berpindah ke Direktur setelah Manager setuju, dan SPH perlu tindak lanjut bagi pengaju setelah Direktur setuju/revisi/tolak dengan catatan. Ditampilkan pada lonceng header/dashboard dan tindak lanjut dashboard/Persetujuan. Refresh saat membuka lonceng, tab fokus, atau setiap 30 detik di tab terlihat; tidak ada email/WhatsApp, riwayat baca atau dismiss. Kegagalan koneksi tetap terlihat. Sumber status/penugasan terkini mengikuti pencabutan akses, tanpa akun penerima fiktif.
- Buat SPK hanya aktif untuk pengaju/Super Admin pada ready/accepted; menuju `/pengajuan/penjualan/spk/baru?sph=...` dengan konteks SPH terverifikasi. Menu SPK biasa membuka daftar tanpa form. Halaman persiapan belum memuat rincian form/kontrak SPK sesuai permintaan pemilik; tidak menganggap format SPK sudah selesai. Syarat penerimaan bilateral sebelum persiapan SPK diganti oleh persetujuan Direktur; bukti bilateral tetap informasi terpisah.

Migration `20261105083655_sph_register_decisions_notifications.sql` sudah dipasang ke Supabase aktif setelah preflight dan dry-run yang hanya memilih satu migration. Verifikasi read-only: ledger 16, kolom amount dan RLS aktif, empat RPC publik baru invoker/authenticated-only, fungsi base tidak bisa dieksekusi authenticated. Probe owner dapat membaca RPC daftar, notifikasi dan antrean. Jumlah data tetap Auth 1, klien 0, dokumen penjualan 0, pembelian 0, jurnal 0. Advisor keamanan tetap 23 WARN/0 ERROR tanpa temuan tambahan. Bukti lokal pada `.local-backups/sph-register-*` dan skrip `verify-sales-shared.sql` / `verify-sales-shared-owner.sql`.

Tes lokal: Sales 28 dan Procurement 17 lulus, termasuk ringkasan peer tanpa detail/audit, perpindahan notifikasi, alasan wajib, revisi versus tolak final, versi NULL/stale, SPK setelah Direktur tanpa penerimaan bilateral, serta redirect draft/submit/review ke daftar. Lint, typecheck dan build produksi terisolasi lulus. Tidak memasukkan transaksi pembelian, menyiapkan periode/cabang pembukuan atau membuat staging. Interaksi lintas akun pada browser nyata belum diverifikasi; tes lokal dan probe baca database kosong bukan bukti lifecycle akun nyata.

### Klien bersama dan pengajuan SPH — 5 November 2026

Arahan pemilik: transaksi/pengisian Pembelian dan mulai staging ditunda sampai konfirmasi. Pekerjaan ini hanya mengembangkan Klien/SPH; tidak menjalankan konfigurasi pembukuan, membuat akun Auth, atau memasukkan transaksi bisnis contoh ke project aktif.

- Klien menjadi master bersama perusahaan tanpa dropdown cabang. Isian terpisah nama, alamat, NPWP, nomor kontak, email, jenis usaha Mining/Migas/Industri/Umum dan informasi lainnya opsional. Semua internal aktif dapat mendaftar tanpa approval. Baca daftar lintas cabang hanya Super Admin, Direksi, Manager Cabang, Admin Cabang, Project Manager dan Marketing; role lain tetap dapat mendaftar tanpa menerima daftar. Pihak eksternal ditolak. Validasi format/kontak dan NPWP unik per perusahaan diterapkan di RPC termasuk jalur lama; NPWP tidak diverifikasi online.
- SPH memakai cabang sesuai penugasan, dropdown klien berpencarian dengan pengambilan 10 hasil dan scroll, judul, daerah pengerjaan, delapan checklist lingkup dalam dua baris desktop, bidang usaha dari klien, status deal, masa berlaku, catatan/arahan dan beberapa lampiran manual privat. Draft minimal cabang/klien/judul; submit memerlukan kelengkapan dan konfirmasi: Ya mengajukan, Tidak menyimpan draft. Kesalahan simpan SPH terlihat dan formulir dipertahankan.
- Pemeriksaan Manager Cabang → Direktur Keuangan → Accounting–Tax → Finance. Pengajuan Manager langsung ke Direktur Keuangan; PM tetap ke Manager. Antrean tersambung ke dashboard dan Persetujuan, detail SPH menampilkan catatan/riwayat, penolakan dapat direvisi pengaju, dokumen terkirim terkunci, NULL/versi stale ditolak. Super Admin dapat override dengan audit. Status deal dan selesai approval internal tidak menggantikan bukti/tanggal kesepakatan kedua pihak sebelum SPK; tidak membuat jurnal/pembayaran.
- Database/RLS dan Storage membatasi akses: Finance/Accounting pusat hanya memperoleh snapshot klien pada SPH yang diajukan beserta lampirannya, tanpa membuka master atau draft baru. Client FK memakai organisasi dan klien, sedangkan SPK tetap mensyaratkan SPH accepted pada klien/cabang yang sama. Urutan nomor SPH perusahaan tetap berkelanjutan. Lampiran maksimal 10 PDF/PNG/JPEG, masing-masing 10 MB, tanpa OCR otomatis; dibuka di tab baru sesuai izin.

Migration `20261105070347_sales_shared_clients_and_sph_workflow.sql` sudah diterapkan lewat CLI, hanya satu migration baru terpilih saat push. Verifikasi read-only remote membuktikan ledger 15, delapan kolom SPH baru, cabang klien nullable, FK organisasi/klien, jabatan marketing, RLS aktif dan sembilan RPC baru invoker/authenticated-only (anon tidak memiliki execute). Probe authenticated owner berhasil membaca izin dan antrean. Jumlah sebelum/sesudah tetap Auth 1, klien 0, dokumen penjualan 0, pembelian 0, jurnal 0. Snapshot/fungsi/policy sebelum dan hasil verifikasi sesudah tersedia lokal di `.local-backups/` (diabaikan Git); skrip pemeriksaan berada pada `scripts/db/preflight-sales-shared.sql` dan `verify-sales-shared.sql`.

Pengujian lokal lulus: Sales 22, Procurement 17, COA 5, Access 6, Dashboard 4, Auth 5, Workflow 19 (total 78), lint dan build produksi terisolasi. Harness COA diperbaiki agar tidak mengasumsikan migration COA sebagai migration terakhir; bukan perubahan kebijakan/pemasangan akun keuangan aktif. Tes menggunakan fixture lokal, tidak membuat pengguna/transaksi produksi. Security advisor sebelum/sesudah: 23 WARN, 0 ERROR, tanpa temuan baru; temuan keamanan lama belum dianggap selesai. Localhost `/login` HTTP 200. Browser nyata tidak dapat dikendalikan alat pada sesi ini; pengisian/approval lintas akun nyata dan viewer browser belum dibuktikan end-to-end.

Temuan audit pembelian versi NULL, hak TRUNCATE empat tabel inti dan pengaturan keamanan Auth masih menjadi pekerjaan terpisah. Pembetulan harness COA di atas menutup kegagalan tes lokal yang tercatat pada audit sebelumnya; tidak menutup temuan audit lainnya atau membuktikan pipeline CI remote sudah berjalan.

Audit ulang 5 November selesai dan dicatat pada `AUDIT-2026-11-02.md` yang sama agar tidak membuat laporan duplikat. Temuan belum diperbaiki: parameter versi NULL dapat melewati pembandingan versi submit/review/pay pembelian (terkonfirmasi definisi remote dan reproduksi lokal), hak TRUNCATE berlebihan pada empat tabel inti, serta harness COA mengasumsikan migration terakhir sehingga gagal setelah penambahan migration SPH. MFA terverifikasi nol, leaked-password protection belum aktif; tiga cabang belum dipetakan dan periode terbuka nol. Audit tidak menulis transaksi produksi atau mengubah akses. Review terarah tidak menemukan indikasi backdoor disengaja; bukan jaminan bebas kompromi. Bukti: 64 pemeriksaan suite berjalan lulus, 1 induk COA gagal; typecheck/lint lulus; dependency produksi 0 advisory, seluruh dependency 8 moderate; advisor remote 47 WARN dan 0 ERROR. Rincian dampak, batas exploitability dan urutan pekerjaan ada pada laporan audit.

Penegasan ikon dashboard 5 November: kartu ikon aplikasi memakai tautan HTML langsung dengan `target="_blank"` dan `noopener noreferrer`. Tes render memeriksa secara eksplisit Pembelian, Cuti, Perjalanan dinas dan Pengajuan saya yang dilingkari pengguna, selain seluruh tujuan modul dan popup Penjualan. Sepuluh tes terkait, typecheck dan lint perubahan lulus. Localhost dimulai ulang dengan izin jaringan yang sama pada port 3000. Klik nyata pada browser pengguna belum diverifikasi oleh alat.

Navigasi tab dan pratinjau dokumen 5 November: kartu modul pada dashboard serta tautan modul di menu/pencarian header membuka tab baru dengan `noopener noreferrer`. Popup Penjualan pada dashboard tetap tampil di tab asal; pilihan Klien/SPH/SPK membuka tab baru. Tautan lampiran pembelian/penjualan sudah menggunakan tab baru; ditambahkan tautan pratinjau segera setelah invoice diunggah. Endpoint GET lampiran mengganti redirect unduhan paksa dengan respons berkas inline (PDF/PNG/JPEG), MIME terverifikasi, cache privat/no-store dan pemeriksaan sesi, metadata RLS serta akses Storage. Kegagalan akses/Storage tetap terlihat; tidak membuat bucket publik atau mengubah schema. Sepuluh tes navigasi/unggah/pratinjau, typecheck dan lint lulus. Tes endpoint memakai Storage terisolasi; pembukaan viewer dengan sesi browser nyata belum diverifikasi pada revisi ini.

Penyesuaian contoh popup 5 November: Penjualan dari dashboard dan dock desktop membuka panel tiga ikon biru Klien/SPH/SPK, dengan panel putih membulat dan latar gelap/buram. Pilihan kartu yang sebelumnya ikut tampil di halaman utama dihapus. Setiap bagian kini mempunyai file route tersendiri; invalidasi cache mengikuti ketiga path tersebut. Nama perusahaan/peran pada topbar menjadi tautan `/dashboard`. Enam tes Penjualan lulus, termasuk render form/daftar terpisah, tujuan tautan popup dan tautan topbar; typecheck dan lint komponen lulus. Verifikasi visual melalui browser dicoba tetapi dihentikan alat karena URL Chrome tidak dapat dipastikan; hasil render otomatis bukan bukti interaksi pada sesi browser nyata. Tidak mengubah database atau penomoran.

Revisi Penjualan 5 November 2026: halaman utama membuka popup Klien, SPH dan SPK; masing-masing mempunyai halaman/form/daftar tersendiri. Tombol Menu Penjualan membuka pilihan kembali. Klien adalah calon mitra dan dasar identitas SPH. SPH memakai nomor urut otomatis perusahaan lintas cabang tanpa reset periode; draft memperoleh nomor sebelum dokumen manual diunggah. SPK perusahaan maupun SPK klien merujuk SPH yang sudah disepakati pada klien/cabang yang sama. SPH/SPK memakai unggah privat PDF/PNG/JPEG maksimal 10 MB, tanpa OCR otomatis. Lampiran dapat ditambahkan pada draft oleh pembuat/Super Admin, tidak dihapus atau mengganti lampiran yang sudah tersimpan. Penambahan memeriksa cabang/domain, mengunci baris, dan mencatat audit. Pengajuan saya menautkan jenis dokumen ke halaman yang sesuai.

Migration `20261105032021_sales_document_numbering.sql` sudah diterapkan ke project aktif melalui CLI setelah preflight dan dry-run. Sebelum penerapan, dokumen penjualan nol. Verifikasi remote mengonfirmasi ledger, bigint nomor, trigger aktif, indeks unik, RLS, counter privat tidak dapat dibaca authenticated, hak tulis langsung ditolak, serta RPC lampiran invoker hanya untuk authenticated. Tidak membuat dokumen atau akun uji di produksi. Snapshot schema dan advisor sebelum/sesudah tersimpan lokal; 23 temuan advisor yang sudah ada tidak bertambah dan tidak ada level ERROR. Ini bukan klaim seluruh sistem bebas temuan.

Pengujian lokal revisi: 17 pemeriksaan procurement/database, 3 unggah dokumen penjualan, 6 akses, typecheck, lint dan build lulus. Tes nomor mencakup kelanjutan lintas cabang sampai melewati 10, rollback tanpa nomor terbuang, penolakan nomor yang diedit/dihapus dan penolakan sumber SPH dari klien. Tes lampiran menolak dokumen pembelian, lintas cabang, pengubahan dokumen rekan, duplikasi, penghapusan lampiran tersimpan dan pengubahan dokumen disetujui. Tes API mengonfirmasi unggah manual tanpa OCR serta menjaga ekstraksi invoice lama. Uji PGlite tidak membuktikan kontensi multi-koneksi atau lifecycle akun nyata. Tampilan/popup dan unggah melalui sesi browser nyata belum diverifikasi.

Sambungan proyek berikutnya sudah ditetapkan pada PRD/rules/ERD: proyek berdasarkan SPK yang lengkap, manpower wajib pada draft, tampil di Pekerjaan saya pengguna yang ditugaskan, serta unggah dokumen manual RAB, teknis pekerjaan dan timesheet. Belum ada form proyek, pengaitan SPK, penugasan otomatis atau unggahan dokumen proyek tersebut pada revisi ini.

Penyederhanaan lanjutan 5 November 2026: submenu Daftar akun (COA) dan baris navigasi pendukung pada halaman Pembelian dihapus; sementara halaman ini hanya berisi pembelian. Pengelolaan COA tetap melalui Keuangan → Bagan Akun, sedangkan pilihan akun pada rincian transaksi tetap tersedia. Tidak ada perubahan schema, data atau hak akses. Typecheck dan ESLint pada kedua komponen yang diubah lulus; tampilan dengan sesi akun nyata belum diverifikasi.

Revisi navigasi 5 November 2026: Vendor menjadi menu mandiri pada kelompok Operasional (`/vendor`); kartu Vendor pada Pengajuan dan tab Daftar vendor pada Pembelian dihapus. Halaman Vendor menggunakan judul/deskripsi sendiri, tidak memuat daftar pembelian dan tidak menampilkan navigasi Pembelian. Daftar tetap memakai master yang sama untuk vendor proyek/nonproyek, termasuk lab dan subkon, dengan cakupan cabang dan verifikasi Finance yang sudah ada. Tidak menambah kategori vendor atau relasi proyek rinci ke schema pada revisi ini. Form invoice tetap dapat mengusulkan vendor tanpa meninggalkan draft. Tautan antrean, Pengajuan saya, redirect lama dan invalidasi cache diperbarui ke `/vendor`; pesan berhasil/gagal tetap diteruskan.

Menu Cuti dan Perjalanan dinas ditambahkan pada Pengajuan, masing-masing menuju halaman awal terlindungi yang menjelaskan fitur belum aktif. Belum ada form, saldo cuti, pencatatan biaya, penyimpanan atau workflow persetujuan baru; aturan lanjutannya menunggu arahan. Tidak mengubah database, akun Auth atau transaksi perusahaan. Typecheck, lint dan enam tes akses lulus. HTTP lokal `/login` menerima 200; `/vendor`, `/pengajuan/cuti` dan `/pengajuan/perjalanan-dinas` tanpa sesi menerima 307 menuju `/login`. Pemeriksaan visual dan alur dengan sesi akun nyata belum dilakukan untuk revisi ini.

Revisi ruang pribadi: label menu menjadi Pembelian/Penjualan; kelompok Pekerjaan saya menampung Pengajuan saya dan Persetujuan. Daftar pribadi mengagregasi enam sumber dengan filter organisasi + pembuat, termasuk untuk owner; pemeriksaan bisnis tetap terpisah dan ringkasan cabang tidak dimuat pada ruang pribadi. Popup pintasan lama dihapus; `/approvals?scope=mine` dialihkan ke daftar pribadi baru. Tes akses mencakup klien yang bisa membaca seluruh perusahaan tetapi daftar pribadi tetap menolak dokumen rekan dan organisasi lain. Tidak mengubah schema atau data produksi.

Revisi batas modul: pembelian dan vendor menggunakan ruang Pengajuan Pembelian; menu Daftar akun mengarah ke master COA bagi Super Admin/Accounting/Finance. Penjualan mempunyai halaman sendiri dengan query klien/dokumen, komponen `components/sales/sales-forms.tsx` dan actions `pengajuan/penjualan/actions.ts`. Klien/SPH/SPK dihapus dari navigasi dan query halaman pembelian. Pintasan pembelian/penjualan terpisah; URL query lama dialihkan sambil mempertahankan pesan. Tidak ada perubahan schema/database dalam revisi ini dan konfigurasi alur untuk perusahaan lain belum diimplementasikan.

Revisi lanjutan: menu **Keuangan → Bagan Akun** mengelola induk, detail, jenis, saldo normal, kelompok laporan, fungsi akun dan status; tersedia untuk Super Admin/Accounting/Finance pusat dengan audit dan pemeriksaan versi. Dropdown pembelian/jurnal hanya memuat detail aktif, pembayaran hanya kategori kas/bank. Pajak tampil horizontal bernomor. PDF digital memakai pembacaan teks lokal (`pdfjs-dist` 6.5.438); PDF pindai/gambar memakai Windows OCR dengan penyusunan baris berdasarkan posisi dan penyesuaian ukuran gambar. Lampiran dapat dibaca ulang tanpa unggah baru. Kolom tidak terbaca diberi peringatan dan tidak ditebak.

Pengujian revisi: COA 5 pemeriksaan, procurement 16, dokumen 3, akses 4 lulus; typecheck, lint dan build lulus. Tes mencakup pemasangan template pada organisasi yang sudah ada, izin Finance/Accounting, konflik versi, induk/siklus, penguncian akun terpakai, pemisahan cabang, jurnal berimbang, OCR gambar dan PDF pindai tanpa lapisan teks serta ekstraksi PDF digital. Localhost `/login` mengembalikan HTTP 200. Pemeriksaan baca transaksi rollback pada database remote sebagai `authenticated` milik owner berhasil memuat tiga cabang, 64 akun detail dan hak pengelolaan COA; vendor disetujui/periode terbuka masih nol. Pembuktian interaksi form dengan sesi pengguna di browser belum lengkap karena kontrol browser tidak tersedia; jangan menyatakan seluruh lifecycle akun nyata sudah diuji.

Advisor keamanan masih menampilkan temuan fungsi legacy security-definer dan pengaturan leaked-password protection yang sudah ada. Dua RPC COA baru adalah invoker dan anon tidak memiliki execute; tidak dinyatakan seluruh sistem bebas temuan advisor.

Pengujian ulang lampiran nyata yang sudah diunggah menghasilkan teks dan sebagian rincian nominal. Nomor invoice, tanggal invoice dan nama vendor pada lampiran tersebut **belum terbaca pasti**, sehingga parser tidak mengisinya dan menampilkan peringatan kolom yang harus dilengkapi. Hasil lengkap disimpan hanya pada direktori lokal yang diabaikan Git. Ini batas pembacaan dokumen tersebut, bukan bukti bahwa seluruh invoice pindai dapat terisi penuh otomatis. Endpoint baca ulang tanpa sesi diarahkan ke `/login` (307); klien mendeteksi pengalihan dan meminta masuk kembali.

| Bagian | Implementasi lokal |
| --- | --- |
| Pusat dan lokasi | `business_units`, pusat nonoperasional dan tiga cabang per organisasi |
| Individu dan jabatan | `person_profiles`, beberapa `work_assignments` per akun; pemberian/pencabutan oleh Super Admin, audit, pembacaan profil sendiri |
| Navigasi | Menggabungkan jabatan pengguna; Accounting–Tax, Finance dan SDM tidak saling menghapus akses menu. Otorisasi tetap di database |
| Vendor | Usulan vendor, verifikasi Finance pusat, snapshot informasi pada pembelian, master vendor terpisah dari akun Auth |
| Dokumen | Unggah privat invoice/SPH/SPK PDF/PNG/JPEG, lampiran tersimpan dan pratinjau inline di tab baru dengan pemeriksaan akses; OCR invoice mengisi draft untuk diperiksa pengguna, dokumen penjualan manual disimpan tanpa OCR otomatis |
| Pembelian | Draft multi-baris, COA, invoice/faktur pajak terpisah, PPN, satu jenis PPh, tanggal rencana bayar, tahap Manager → Direktur Keuangan → Accounting–Tax → Finance |
| Jurnal | Posting utang dan pelunasan ke tabel akuntansi yang sudah ada, periode terbuka, mapping cabang eksplisit, jurnal berimbang, version check dan row lock |
| Ringkasan | Antrean yang benar-benar dapat ditindak, laporan utang/pembayaran per cabang di beranda, pekerjaan saya, dan manajemen |
| Penjualan | Master klien bersama berbatas role → draft SPH bercabang → Manager/Direktur Keuangan → tindak lanjut pengaju dan persiapan SPK; ringkasan cabang terpisah dari akses detail, notifikasi mengikuti tahap aktif |
| Portal proyek dasar | Super Admin menetapkan proyek/cabang dan akses klien/konsultan/vendor; informasi internal atau dibagikan, status, MoM, referensi dokumen/surat/tagihan; pihak eksternal mengirim permintaan jika diizinkan |

Migration utama: `supabase/migrations/20261104044243_branch_procurement_foundation.sql`.
Dokumen privat dan Storage: `supabase/migrations/20261104051705_procurement_documents.sql`, diterapkan setelah migration utama.
Pengaman pemetaan unik: `supabase/migrations/20261104075321_unique_branch_accounting_mapping.sql`. Ketiganya sudah diterapkan melalui CLI dan ledger terverifikasi.

Pengakuan PPh dapat dipilih pada invoice atau pembayaran sesuai objek, diperiksa Accounting–Tax. Pemotongan hanya diposting sekali. Accounting dapat mengoreksi COA/pajak; nominal dan rincian yang disetujui direksi tidak boleh diubah lewat pemeriksaan tanpa revisi pengajuan. Jurnal sumber pembelian tidak menerima reversal generik yang meninggalkan status utang/pembayaran tidak sinkron; workflow koreksi sumber perlu disusun tersendiri.

Pengkreditan PPN memerlukan nomor/tanggal faktur pajak dan pemeriksaan Accounting–Tax; keberadaan nomor saja tidak menyatakan faktur sah secara online. Tanggal pelunasan tidak boleh mendahului invoice. Pembelian dengan pembayaran lebih dahulu menggunakan alur uang muka/kasbon tersendiri, bukan tanggal pembayaran invoice yang dipaksakan.

## Batas akses dan transisi data lama

Data lama belum mempunyai pemetaan cabang yang dapat dipercaya. Migration tidak menebak cabang berdasarkan pembuat data. Super Admin tetap membaca/mengubah melalui modul lama. Jalur data lama untuk pengguna lain ditutup melalui restrictive RLS, guard tulis, dan guard RPC. Pengecualian yang sengaja dibuka: COA bersama serta jurnal/periode dari unit akuntansi yang secara eksplisit dipetakan ke cabang yang boleh diakses.

Ini berarti modul lama SDM, aset, kasbon dan operasional belum menjadi modul cabang penuh. Pembelian/penjualan baru memakai model yang sudah bercakupan cabang. Integrasi dan pemetaan modul lainnya mengikuti urutan [aturan pengembangan](aturan-pengembangan.md), bukan dibuka sekaligus dengan akses seluruh organisasi.

## Aktivasi dan langkah awal penggunaan

1. Selesai: CLI terhubung ke `cjxsdoxlrnpyhigkudha`, sembilan migration awal dicocokkan, snapshot schema disimpan dan tiga migration baru diterapkan tanpa menjalankan ulang migration lama.
2. Selesai: tabel, RLS, grants RPC, bucket privat, jumlah akun dan ledger diverifikasi secara read-only; advisors dijalankan sebelum/sesudah.
3. Buka `/pengajuan/pembelian/baru` sebagai Super Admin. Jika COA kosong, tinjau konfigurasi awal, pilih bulan dan tekan **Siapkan pembukuan pembelian**. COA awal dapat diperiksa di Akuntansi. Pemetaan cabang dan periode disiapkan transaksional; pusat tetap bukan cabang usaha keempat.
4. Isi invoice manual/OCR. Untuk vendor baru, buka **Vendor belum terdaftar? Ajukan ke Finance** di formulir; pengajuan vendor tidak menghapus isian invoice. Simpan draft, periksa vendor melalui Daftar vendor, muat ulang status dan ajukan pembayaran setelah disetujui.
5. Gunakan bukti transaksi yang memang ada untuk verifikasi alur produksi. Jangan memasukkan vendor, invoice atau pembayaran fiktif ke database perusahaan. Uji lifecycle lengkap dengan data sintetis tetap dilakukan di PGlite terisolasi.
6. Tambahkan akun nyata dan penugasan saat identitas siap; uji cabang/pusat pada sesi terpisah sebelum digunakan sehari-hari.

## Batas pengembangan berikutnya

- Dokumen SPH/SPK dibuat manual dan diunggah sesuai arahan 5 November; tidak membangun format surat, klausul atau pencetakan otomatis pada tahap ini.
- SPK belum otomatis membuat proyek, pendapatan, invoice penjualan atau pekerjaan operasional.
- Portal klien/konsultan tahap ini berupa catatan dan referensi teks dengan penerima internal/eksternal; permintaan dan tanggapan tercatat per proyek. Unggah dokumen portal, notifikasi, percakapan berutas, tanda tangan dan penerbitan invoice penjualan otomatis belum ditambahkan. Akses eksternal ditolak secara default; dibuka hanya melalui penugasan proyek aktif yang eksplisit. Super Admin dapat mengatur cabang proyek tanpa menunggu akun eksternal.
- Payroll/TER pegawai, pelaporan pajak elektronik, transfer bank otomatis, termin/cicilan pembayaran, fasilitas pajak khusus, dan rekonsiliasi bank satu per satu belum termasuk alur baru ini.
- Satu jenis PPh per pengajuan. Rincian beberapa objek pajak perlu dipisah atau disepakati perhitungan per baris pada sesi berikutnya.
- Kebenaran OCR tidak menggantikan pemeriksaan manusia; jangan menyetujui pajak/COA atau memposting jurnal dari OCR secara otomatis.
- OCR sesi ini memakai mesin lokal Windows yang tersedia pada komputer pengguna, termasuk render PDF maksimal lima halaman. Dokumen tidak dikirim ke penyedia OCR eksternal. Server selain Windows atau mesin tanpa bahasa OCR mengembalikan penjelasan dan tetap mendukung input manual/lampiran. Mesin terverifikasi di komputer ini memiliki bahasa `en-US`; istilah Indonesia dan kualitas pemindaian tetap memerlukan koreksi manusia. Pemilihan OCR lintas platform untuk hosting berikutnya adalah pekerjaan terpisah.

## Verifikasi

### Pemeriksaan localhost, 5 November 2026

Server Next.js dijalankan pada `http://localhost:3000` dengan izin jaringan di luar sandbox. Probe Node di dalam sandbox gagal ke Supabase dengan `fetch failed` / `EACCES`; probe yang sama di luar sandbox menerima HTTP 200 dari `/auth/v1/settings` project `cjxsdoxlrnpyhigkudha`. Ini membuktikan keterjangkauan Auth dan menunjukkan pembatasan jaringan proses sebagai penyebab kegagalan probe, bukan bukti login akun berhasil. Server untuk penggunaan lokal harus mempunyai akses jaringan tersebut.

Pemeriksaan HTTP server: `/login` menerima 200; `/dashboard`, `/pengajuan/pembelian/baru`, `/pengajuan/vendor`, `/pekerjaan-saya/pengajuan` dan `/approvals` tanpa sesi menerima 307 menuju `/login`. Cookie sesi sengaja tidak valid ditolak dengan 307 menuju `/login?error=session_verification`; log server yang diamati tidak menampilkan `fetch failed`. Tes Auth lokal lulus 5 pemeriksaan dan typecheck lulus. Tidak membuat akun, mengubah schema atau menulis transaksi perusahaan.

Pemeriksaan browser belum selesai: host browser tidak tersedia dan percobaan Chrome melalui computer-use dihentikan karena alat tidak dapat memastikan URL browser. Karena itu login Super Admin, refresh sesi akun nyata, pengambilan data dashboard dan kelengkapan formulir setelah login **belum terverifikasi pada pemeriksaan ini**. Hasil HTTP tanpa sesi dan tes lokal tidak menggantikan pemeriksaan tersebut atau menjamin jaringan tidak akan pernah gagal.

Pemeriksaan HTTP akhir: `http://localhost:3000/login` dan endpoint konfigurasi Supabase Auth sama-sama merespons **200**. Koneksi Supabase diuji dari proses yang memperoleh akses jaringan; sandbox tanpa izin jaringan mengembalikan `EACCES`. Server localhost yang sudah berjalan tetap digunakan.

Pemeriksaan fondasi sebelumnya lulus 50 tes. Setelah penambahan konfigurasi awal, suite procurement lulus **16 tes**, termasuk owner-only, pemanggilan ulang tanpa duplikasi, mempertahankan COA, dan indeks pemetaan unik. TypeScript, ESLint dan build Next.js lulus. OCR sebelumnya diuji dengan PNG invoice dan PDF nyata yang dibuat khusus sebagai fixture; nominal ambigu menghasilkan peringatan koreksi manual, bukan angka tebakan.

Tes database lokal memakai PostgreSQL/PGlite sementara; tidak menulis data project Supabase. Suite workflow lama mempertahankan baseline sampai migration 2 November, sedangkan suite procurement memasang seluruh migration dan menguji penutupan akses lama serta alur penggantinya. Fixture Storage sengaja mempunyai policy lama yang membuka semua objek; restrictive policy baru tetap menolak akses cabang lain, pihak eksternal/anonim, perubahan berkas, dan perubahan bucket menjadi publik. Uji juga memastikan lampiran penjualan tidak disisipkan ke pembelian dan sebaliknya.

Aktivasi schema remote **sudah selesai**, sedangkan pengisian invoice nyata sampai pembayaran belum dilakukan karena tidak ada bukti transaksi yang diberikan. Build dan tes lokal tidak menggantikan verifikasi transaksi nyata. Security advisors sesudah penerapan tidak melaporkan level ERROR; masih ada peringatan fungsi legacy privileged dan perlindungan password bocor yang belum aktif. Temuan lama tersebut perlu ditinjau terpisah; laporan mentah tersimpan lokal. Rujukan: [privileged functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Perintah pemeriksaan dari PowerShell:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:auth
npm.cmd run test:dashboard
npm.cmd run test:access
npm.cmd run test:workflow
npm.cmd run test:procurement
npm.cmd run test:coa
npm.cmd run test:documents
npm.cmd run test:sales
npm.cmd run build
```
