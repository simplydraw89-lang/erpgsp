# Pegangan pengembangan ERP GSP

Baseline kebutuhan disepakati melalui arahan pemilik sistem, 4 November 2026. Dokumen ini menjadi batas lingkup bagi pemilik dan pengembang. Perubahan kebutuhan dicatat di sini sebelum mengubah alur yang sudah disepakati.

## Pengelolaan dokumen dan sumber kebutuhan

- Format nominal 5 November: seluruh tampilan dan input uang memakai titik ribuan serta koma desimal, contoh 1.250.000,50. Pemisah muncul saat mengetik; nilai kiriman tetap desimal kanonis untuk database. Isian ambigu/tidak valid harus terlihat dan ditolak, bukan dibuang nolnya atau dianggap nol. Nomor dokumen, NPWP, rekening dan identitas tidak diformat sebagai uang. Perubahan ini tidak memulai pengisian Pembelian atau staging.
- Arahan navigasi 5 November 2026: pilihan modul pada dashboard membuka halaman di tab baru agar dashboard tetap tersedia, termasuk tujuan Klien/SPH/SPK dari popup Penjualan. Lampiran PDF/PNG/JPEG dibuka sebagai pratinjau di tab baru tanpa unduhan paksa. Endpoint tetap memverifikasi sesi dan akses database/Storage; bucket tidak dijadikan publik.
- Sebelum menulis dokumentasi, cari PRD, ERD dan aturan pengembangan yang sudah tersedia di repository. Revisi dokumen yang sesuai; jangan membuat salinan baru berdasarkan tanggal, sesi atau nama modul jika dokumen induknya sudah ada.
- Dokumen baru hanya dibuat bila jenis dokumen tersebut memang belum tersedia atau pemilik meminta artefak terpisah. Perubahan permintaan pengguna merupakan tambahan/revisi pada dokumen induk, bukan PRD/ERD tandingan.
- Dokumen induk kebutuhan: [PRD](PRD.md). Dokumen induk model data: [ERD](ERD.md). Dokumen ini adalah aturan pengembangan. Ketiganya harus konsisten dengan arahan terakhir pemilik dan status implementasi aktual.
- Catat perbedaan antara kebutuhan yang disepakati, kode yang tersedia, hasil pengujian, serta deployment. Dokumen status lama dipelihara sebagai riwayat dan tidak menggantikan PRD/ERD.
- Arahan terbaru 5 November: pengisian/pengujian transaksi pembelian ditunda sampai konfirmasi pemilik untuk tahap staging. Pekerjaan saat ini fokus Penjualan (Klien dan SPH). Jangan mulai staging, memasukkan transaksi pembelian atau menyiapkan periode/cabang pembukuan pada pekerjaan ini.

## Struktur perusahaan dan identitas

- Satu badan usaha, satu pelaporan pajak. Pusat adalah tempat pengawasan dan penggabungan laporan, bukan unit usaha tersendiri.
- Unit operasional: Surabaya, Jogjakarta, Jakarta. Unit berbeda dari badan hukum; jangan membuat tiga wajib pajak atau tiga anak perusahaan untuk memodelkan lokasi ini.
- Satu akun Auth saat baseline adalah Super Admin/pemilik sistem. Key database `owner` dipertahankan. Akun ini dapat membaca, mengubah, meninjau dan memantau seluruh sistem. Tindakan istimewa tetap direkam, bukan menghapus jejak audit atau mengubah jurnal posted secara diam-diam.
- Akun pusat yang akan ditambahkan: Direktur Utama, Direktur Keuangan, Direktur Teknis, Finance, Accounting–Tax, SDM. Ini daftar jabatan, bukan instruksi membuat akun fiktif.
- Akun cabang: Manager Cabang, Admin, Project Manager/PIC, SDM, Support, lainnya. Satu orang dapat memegang lebih dari satu penugasan.
- Pisahkan hubungan individu (probation, kontrak, tetap, konsultan/vendor, klien) dari jabatan dan cakupan organisasi/cabang/proyek. Status kontrak tidak otomatis memberi akses keuangan.
- Pengguna pusat membaca lintas cabang menurut bidangnya: direksi memantau seluruhnya; Finance/Accounting–Tax keuangan; SDM kepegawaian. Pengguna cabang hanya cabangnya. Konsultan/vendor dan klien hanya data proyek/dokumen yang secara eksplisit diberikan.
- **Keterbukaan Data dan Pemantauan Direksi (Board Cross-Monitoring & Transparency):**
  - Seluruh jajaran Direksi (**Direktur Utama**, **Direktur Keuangan**, dan **Direktur Teknis**) memiliki visibilitas 360° lintas cabang untuk melihat, membaca, dan memantau seluruh dokumen transaksi dan operasional perusahaan (SPH, SPK, Pengajuan Pembelian, Proyek, RAB, Laporan Keuangan, serta seluruh berkas lampiran PDF/gambar yang diunggah).
  - Pembatasan tombol keputusan/persetujuan (decision authority) dipisahkan secara fungsional:
    - **Persetujuan SPK:** Langsung kepada Direktur Utama (`president`) dan Super Admin.
    - **Persetujuan SPH & Pengajuan Pembelian:** Kepada Direktur Keuangan (`finance_director`) dan Super Admin.
  - Direktur yang tidak memegang tombol persetujuan pada dokumen tertentu (misalnya Direktur Keuangan & Direktur Teknis pada SPK, atau Direktur Utama & Direktur Teknis pada SPH/Pembelian) tetap dapat membaca seluruh data, membuka berkas lampiran, dan meninjau riwayat audit, agar jajaran direksi tetap saling terhubung, terkoneksi, dan memiliki landasan data yang utuh.
- Data pribadi milik akun sendiri terpisah dari akses pekerjaan. Profil publik/direktori tidak boleh menjadi jalan membaca data SDM, NPWP, atau rekening vendor.
- Akses wajib diperiksa di database (RLS dan RPC), server, dan tampilan. `user_metadata`, kolom role dari formulir, URL cabang, dan mode pratinjau tidak menjadi sumber otorisasi.

## Urutan pengerjaan tetap

1. Struktur pusat/cabang, status individu, penugasan dan batas data.
2. Vendor → pengajuan pembelian → pemeriksaan berjenjang → utang/jurnal → pembayaran dan ringkasan.
3. Klien → SPH → persetujuan kedua pihak → SPK.
4. Sambungkan SPK yang sah ke proyek/pekerjaan operasional.
5. Portal proyek klien/konsultan: permintaan data, status, MoM, dokumen/surat dan tagihan setelah aturan berbagi disepakati.
6. Penyempurnaan laporan, SDM, pajak dan modul lain setelah alur sebelumnya dapat diuji.

Jangan mengembangkan payroll, absensi, perpajakan elektronik, kontrak lengkap, atau integrasi baru hanya karena ada dependensi potensial. Catat kebutuhan berikutnya pada daftar pekerjaan. Pekerjaan tetap lokal dan menggunakan project Supabase yang telah dipilih; belum membuat staging.

## Pengajuan pembelian

Pengaju internal memilih cabang yang memang ditugaskan kepadanya. Simpan invoice dan faktur pajak sebagai nomor dan tanggal terpisah, vendor/alamat, rincian lebih dari satu baris, COA tiap baris, nilai, pajak, jadwal/metode bayar dan bukti sumber. Nilai total dihitung ulang di server/database; nominal dari browser bukan sumber kebenaran.

Vendor baru diajukan ke Finance dengan nama, alamat, NPWP, pemilik rekening, nomor rekening dan metode pembayaran. Persetujuan vendor menghasilkan master vendor; **master vendor bukan akun login Auth**. Undangan login vendor adalah pekerjaan terpisah dan membutuhkan cakupan proyek yang jelas. Pengajuan pembayaran tidak bisa dikirim sebelum vendor disetujui. Data vendor yang digunakan disalin sebagai snapshot agar perubahan master tidak mengubah dokumen lama.

Pengajuan vendor tersedia dari area vendor pada formulir pembelian agar pengaju tidak kehilangan draft invoice. Draft dapat disimpan saat vendor belum disetujui; tombol pengajuan pembayaran tetap memerlukan vendor terverifikasi pada cabang yang sama. Setelah persetujuan, muat ulang pilihan vendor dan pilih vendor tersebut sebelum mengirim pembelian.

Alur biasa: Pengaju → Manager Cabang → Direktur Keuangan → Accounting–Tax (COA/pajak) → Finance (catat pembayaran). Pengajuan oleh Manager Cabang atau Project Manager langsung ke Direktur Keuangan. Accounting–Tax dan Finance boleh satu orang; pemeriksaan dan pembayaran tetap dua peristiwa yang dapat diaudit. Pengguna biasa tidak boleh menyetujui pengajuan sendiri. Finance dapat mencatat pelunasan atas pengajuannya setelah semua persetujuan independen selesai; pelunasan adalah eksekusi, bukan persetujuan. Super Admin mempunyai kewenangan pemilik dengan jejak audit yang jelas.

Persetujuan tidak memindahkan uang. Tombol pembayaran mencatat transaksi dan bukti/referensi transfer yang telah dilakukan; integrasi bank tidak termasuk. Jurnal posted dikoreksi dengan reversal/koreksi yang terlacak, bukan edit saldo langsung. Posting utang dan pembayaran harus transaksional, berimbang dan idempotent. Jangan membuat jurnal kedua saat tombol diulang.

OCR membantu mengisi draft. Pengguna wajib memeriksa hasil terhadap dokumen. OCR tidak menentukan COA, persetujuan, keabsahan faktur pajak, atau pemotongan pajak. Simpan dokumen pada storage privat; jangan mengirim invoice ke layanan eksternal tanpa keputusan integrasi. Tampilkan kegagalan OCR secara jelas dan sediakan input manual.

## Penjualan dan operasional

Lanjutan arahan 5 November: setelah simpan/submit SPH, kembali ke daftar SPH cabang. Ringkasan seluruh pengaju satu cabang boleh terlihat, tetapi detail/berkas hanya pengaju, pemeriksa tahap aktif dan Super Admin. Daftar memuat urutan, nomor SPH, tanggal, inti keterangan, lingkup, nilai dan posisi/status. SPH selesai approval setelah Direktur Keuangan (menggantikan tahap Accounting–Tax/Finance untuk SPH). Keputusan Setujui/Revisi/Tolak; alasan wajib untuk Revisi/Tolak. Revisi dapat diajukan ulang, Tolak menutup pengajuan. Notifikasi internal bersumber dari tahap aktif: Butuh persetujuan saya untuk pemeriksa, SPH perlu tindak lanjut bagi pengaju sesudah approval Direktur/revisi/tolak, beserta catatan. Buat SPK tersedia bagi pengaju/Super Admin setelah approved; masuk persiapan form SPK dengan referensi SPH. Menu SPK biasa membuka daftar, tanpa form. Rincian form SPK menunggu arahan; belum membuat kontrak baru.

Revisi Klien/SPH 5 November: master klien bersama satu perusahaan, tidak terikat cabang. Daftar dapat dilihat Super Admin, Direksi, Manager Cabang, Admin Cabang, Project Manager dan Marketing. Pengguna internal lain tetap dapat mendaftarkan klien valid langsung tanpa approval, tetapi tidak mendapat akses daftar. Pihak eksternal tidak termasuk pemberian akses ini. Data wajib: nama, alamat, NPWP, nomor kontak, email, jenis usaha Mining/Migas/Industri/Umum; informasi lainnya opsional. Pembatasan role berlaku pada database/RPC dan jalur lama.

SPH tetap bercabang: dropdown hanya berisi cabang yang dapat digunakan pengaju sesuai penugasan (Super Admin/direksi pusat mengikuti kewenangan lintas cabang). Klien dipilih dari master bersama melalui dropdown berpencarian dan area gulir maksimal sepuluh baris. SPH mencatat judul, daerah pengerjaan, checklist Pertek/UKL-UPL/Amdal/DELH/DPLH/Andalalin/LB 3/Lainnya, bidang usaha dari klien, sudah/belum deal, tanggal akhir masa berlaku, informasi tambahan dan beberapa lampiran manual. Status deal bukan bukti persetujuan kedua pihak.

Simpan draft tidak membutuhkan approval. Submit menampilkan konfirmasi kebenaran data: Ya mengajukan, Tidak menyimpan draft. Jalur SPH terbaru berurutan Manager Cabang → Direktur Keuangan → pengaju untuk tindak lanjut; pengajuan Manager langsung ke Direktur Keuangan. Accounting–Tax/Finance tetap pada alur pembelian, bukan tahap persetujuan SPH. Approval internal tidak mencatat pembayaran, jurnal atau penerimaan klien otomatis. SPK dapat dipersiapkan sesudah persetujuan Direktur Keuangan. Form/draft dapat diedit pembuat/Super Admin sebelum diajukan atau saat diminta revisi; dokumen terkirim/ditolak dikunci dan perubahan memakai versi.

Klien harus tersimpan sebelum SPH: nama badan usaha, alamat, NPWP, kontak dan bidang usaha. SPK umumnya berarti Surat Perintah Kerja; label/nomor dokumen asli klien tetap dicatat. SPK dapat berasal dari perusahaan atau klien, manual atau impor dokumen. SPK merujuk SPH klien/cabang yang sama dan telah disetujui Direktur Keuangan. Persetujuan klien tetap bukti tersendiri, tidak dianggap terjadi karena draft tersimpan atau approval internal selesai.

Arahan 5 November 2026: Penjualan membuka popup pilihan Klien, SPH dan SPK, masing-masing dengan halaman/form/daftar tersendiri. Klien adalah calon mitra beserta identitas PT/kontak dan dasar penawaran. SPH wajib merujuk klien yang benar dan bernomor urut berkelanjutan satu perusahaan lintas cabang, mulai 1 tanpa reset bulanan/tahunan. Nomor diberikan transaksional saat draft tersimpan, tidak dapat dipilih ulang, diubah atau dihapus sehingga kegagalan simpan tidak memakan nomor.

Penegasan tampilan: popup Penjualan mengikuti contoh panel putih bersudut bulat dengan tiga ikon Klien/SPH/SPK dan latar halaman digelapkan/diburamkan. Klik Penjualan dari dashboard atau dock desktop langsung membuka popup. Setiap ikon membuka halaman tersendiri, tanpa form klien dan SPH/SPK yang digabung. Area nama perusahaan beserta peran di kiri atas halaman modul dapat diklik untuk kembali ke `/dashboard`.

Dokumen dibuat manual dan diunggah terlebih dahulu; jangan membuat format surat, klausul atau perhitungan otomatis tanpa arahan. SPK tetap dua sumber: perusahaan atau klien, merujuk SPH terkait yang telah disetujui Direktur Keuangan. Master klien tidak membuat akun Auth. Setelah penjualan lengkap, proyek dibuat berdasarkan SPK tersebut, dengan manpower wajib pada form/draft. Proyek ditampilkan pada Pekerjaan saya bagi pengguna yang ditugaskan; dokumen RAB, teknis pekerjaan dan timesheet dibuat manual lalu diunggah. Menu proyek berikutnya dapat ditambahkan bertahap. Sambungan proyek ini harus dibangun dengan cakupan cabang/proyek di database, bukan menampilkan semua proyek kepada semua akun.

Jangan mengakui pendapatan hanya karena SPH/SPK dibuat. Hak akses portal klien dibatasi proyek aktif dan dokumen yang boleh dibagikan; akun klien tidak boleh membaca daftar vendor, buku besar atau data cabang.

## Cara menyelesaikan setiap perubahan

1. Baca baseline ini, AGENTS.md, kode dan dokumentasi Next.js versi terpasang.
2. Nyatakan lingkup, dependensi dan kriteria selesai yang dapat diuji.
3. Jaga perubahan pengguna yang belum di-commit. Jangan reset atau mengganti modul lama tanpa alasan yang disepakati.
4. Tambahkan migration yang ditelusuri; cocokkan riwayat database aktif sebelum penerapan. Jangan mengasumsikan migration di repository sudah terpasang.
5. Uji batas cabang, lintas organisasi, role salah, akun eksternal, manipulasi payload, pengulangan/concurrency, jurnal seimbang dan kegagalan transaksional. Gunakan data uji terisolasi.
6. Jalankan typecheck, pemeriksaan kode dan pengujian yang relevan; tinjau tampilan bila akses browser tersedia.
7. Catat terpisah: kode selesai, diuji lokal, terpasang di Supabase, dan terverifikasi melalui akun nyata. Jangan menyebut integrasi selesai ketika hanya mock atau tes lokal yang lulus.
8. Perbarui status implementasi dan backlog. Lanjut ke sambungan berikutnya setelah masalah alur saat ini ditangani.

## Kriteria penerimaan sesi ini

- Model pusat/tiga cabang dan penugasan tersimpan dengan RLS; tidak ada akun tambahan otomatis.
- Vendor dan pembelian dapat disimpan, diajukan, diperiksa sesuai urutan dan dicatat pembayarannya.
- COA/pajak yang belum valid menghalangi posting; jurnal terkait dapat ditelusuri dan pengulangan tidak menggandakan jurnal.
- Antrean pekerjaan, ringkasan dan laporan menghormati cakupan cabang/role.
- Klien, draft SPH dan draft SPK memiliki prasyarat urutan yang dipaksakan di database.
- Batas OCR, status penerapan database, dan bagian yang menunggu rincian SPH/SPK ditulis secara terbuka.

Lihat [dasar pajak dan jurnal](pajak-dan-jurnal-pembelian.md) serta [status implementasi sesi](implementasi-2026-11-04.md).

## Aturan tambahan COA, akun nyata dan pembacaan dokumen

- Gunakan label **Pembelian** dan **Penjualan** di kelompok Pengajuan. Tempatkan Pengajuan saya pada kelompok Pekerjaan saya. Setiap sumber data daftar pribadi wajib memfilter organisasi dan pembuat akun aktif; jangan menghapus filter pembuat bagi Super Admin. Pertahankan antrean verifikasi/pelaksanaan secara terpisah berdasarkan kewenangan. Modul baru perlu menghubungkan data buatan pengguna ke ruang pribadinya.

- Pisahkan domain Pengajuan Pembelian dan Pengajuan Penjualan pada halaman, formulir, pengambilan data dan server actions. Menu pengadaan berada dalam pembelian; klien/SPH/SPK berada dalam penjualan. Jangan memuat data penjualan untuk menampilkan pembelian atau sebaliknya.
- Revisi 5 November 2026: Vendor menjadi satu menu mandiri di kelompok Operasional (`/vendor`), dikeluarkan dari kelompok Pengajuan dan tab Pembelian. Vendor proyek dan nonproyek memakai daftar/master yang sama, termasuk lab dan subkon; cakupan cabang, verifikasi Finance dan snapshot vendor tetap berlaku. Konteks proyek/nonproyek merupakan dimensi transaksi, bukan alasan menggandakan master vendor. Form invoice tetap dapat mengusulkan vendor tanpa kehilangan draft.
- Menu Cuti dan Perjalanan dinas ditambahkan ke Pengajuan sebagai halaman awal. Form, saldo/ketentuan cuti, biaya perjalanan dan urutan persetujuan menunggu arahan; jangan mengarang aturan atau menampilkan pengajuan seolah-olah sudah dapat dikirim.
- Penjualan mencakup kegiatan penghasil pendapatan sesuai barang/jasa dan model usaha perusahaan. Alur klien–SPH–SPK adalah kebutuhan GSP saat ini; perubahan untuk perusahaan lain harus mengikuti kebutuhan perusahaannya dan tidak mengubah pembelian. Jangan menyatakan konfigurasi lintas perusahaan sudah tersedia hanya karena modul dipisahkan.
- Gunakan master COA, identitas, cabang dan penyimpanan privat bersama sesuai izin. Revisi 5 November 2026: Pembelian sementara hanya berisi pembelian, tanpa submenu Vendor, Daftar akun (COA) atau navigasi modul lain. Pengelolaan COA melalui Keuangan → Bagan Akun; pilihan COA pada rincian transaksi tetap memakai master yang sama. Menu baru harus ditempatkan berdasarkan domain bisnisnya; hindari tab gabungan pembelian/penjualan.

- Revisi dokumen induk yang sudah ada; jangan membuat PRD, ERD, rules atau catatan status duplikat untuk setiap fitur. Dokumen baru hanya jika jenis dokumen tersebut belum tersedia.
- Jangan membuat akun Auth pegawai/pemeriksa fiktif untuk mengatasi belum adanya penugasan. Satu orang satu identitas; beberapa jabatan pada orang yang sama berupa beberapa penugasan. Master vendor bukan akun login.
- COA harus memakai master `finance_accounts` yang sama dengan jurnal dan pembelian. Kelompok tidak dapat diposting; akun detail aktif saja tersedia pada pilihan transaksi. Jangan menyimpulkan akun kas/bank hanya dari `account_type=asset`.
- Hak perubahan COA berada pada Super Admin dan Accounting/Finance pusat; gunakan RPC dengan versi, audit dan validasi induk/cakupan. Akun yang digunakan jurnal tidak dapat dipindah klasifikasi atau diubah kodenya.
- Rekomendasi chart tidak berarti seluruh PSAK/ISAK telah diterapkan. Kode akun merupakan rancangan perusahaan. Pisahkan OCI dari penghasilan laba rugi dan periksa tanggal efektif standar. Saldo awal memerlukan proses tersendiri yang disetujui.
- Pemasangan master COA tidak membuat invoice, vendor, transaksi, saldo, atau pengguna contoh pada produksi. Migration harus diuji pada organisasi yang sudah ada dan diverifikasi sesudah pemasangan.
- Pembacaan dokumen tidak boleh menebak kolom yang tidak terbaca, menyetujui pajak/COA, atau mengirim berkas ke penyedia eksternal tanpa keputusan terpisah. Sediakan teks hasil, peringatan bagian yang kosong, input manual dan baca ulang tanpa unggah ganda.
- Susun rincian pajak sebagai tabel horizontal bernomor; pertahankan satu pilihan jenis PPh dan perhitungan final di database.


## Prinsip Invarian: Master Rekanan Bersama vs Isolasi Dokumen Transaksional

1. **Master Rekanan (Klien & Vendor) Adalah Master Bersama Lintas Cabang:**
   - Rekanan (Klien maupun Vendor) adalah aset calon mitra dan vendor milik perusahaan (organization_id), **bukan milik eksklusif cabang tertentu**.
   - Siapa pun internal cabang yang mendaftarkan (misal Cabang Surabaya), begitu rekanan tersimpan (Klien) atau disetujui Finance (Vendor), data tersebut **dapat dilihat dan dipilih oleh seluruh cabang (Jakarta, Jogja, Surabaya, Pusat)** untuk pengajuan dokumen mereka.
   - Dilarang keras menambahkan pembatasan hak akses cabang (can_access_business(..., p_branch)) atau filter branch_id pada query/pendaftaran master Klien & Vendor yang sah.
2. **Isolasi Cabang Hanya Berlaku Pada Dokumen Transaksional:**
   - Dokumen pengajuan (SPH, SPK, Pengajuan Pembelian / Invoice, Proyek / RAB) adalah objek transaksional yang **terikat pada cabang pengaju (branch_id)**.
   - Pengguna cabang hanya dapat melihat dan menindaklanjuti dokumen transaksi milik cabangnya sendiri dan hierarki reviewer-nya.
   - Super Admin dan Direksi memiliki akses pengawasan global lintas cabang.
