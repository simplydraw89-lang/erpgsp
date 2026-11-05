# Dasar pajak dan jurnal pengajuan pembelian

## Rekomendasi bagan akun berjenjang

Kode berikut rancangan internal perusahaan, bukan nomor akun yang diwajibkan PSAK/ISAK. Template aplikasi berisi 98 node, dengan kelompok non-posting dan akun detail posting. Accounting/Finance dapat menambahkan kelompok/akun melalui **Keuangan → Bagan Akun**. Nama/kode lama yang kompatibel dipertahankan, dan tidak ada saldo awal otomatis.

| Akar / kelompok | Kelompok dan contoh akun detail |
| --- | --- |
| 1 Aset | 10 Aset lancar; 1100 Kas dan setara kas → 1101 Kas, 1102 Bank operasional, 1103 Deposito yang memenuhi kriteria setara kas; 1120 Piutang usaha → 1121 Piutang klien, 1122 Retensi, 1129 Cadangan kerugian (kredit); 1190 Aset lancar lain → 1191 PPN masukan, 1192 Pajak dibayar di muka, 1193 Uang muka vendor, 1194 Beban dibayar di muka; 1200 Persediaan; 15 Aset tidak lancar → aset tetap, akumulasi penyusutan, aset hak guna dan aset takberwujud. |
| 2 Liabilitas | 20 Jangka pendek; 2100 Utang usaha → 2101 Utang vendor, 2111 Utang subkontraktor; 2120 Utang pajak → 2102 PPh 23, 2103 PPh final, 2104 PPh 21, 2121 PPN keluaran, 2122 Pajak penghasilan badan; 2130 Akrual, 2140 Liabilitas kontrak/uang muka klien; 22 Jangka panjang → pinjaman bank, sewa dan imbalan kerja. |
| 3 Ekuitas | 31 Modal → 3111 Modal saham, 3112 Tambahan modal disetor; 32 Saldo laba → 3211 Saldo laba, 3212 Laba tahun berjalan; 33 Akumulasi OCI → surplus revaluasi, pengukuran kembali imbalan pasti, nilai wajar melalui OCI. |
| 4 Penghasilan usaha | 41 Pendapatan jasa → 4111 Konsultansi, 4112 Survei, 4113 Jasa teknis/proyek; 42 Pengurang pendapatan → 4211 Potongan pendapatan (debit). Pengakuan mengikuti pemenuhan kewajiban pelaksanaan kontrak, bukan otomatis saat SPK diterima. |
| 5 Beban dan biaya | 50 Biaya langsung proyek → tenaga ahli/subkontraktor, material dan perjalanan; 5100 Beban operasi → 5101 Operasional, 5102 Jasa, 5103 Sewa, 5111 Pegawai, 5112 Utilitas, 5113 Penyusutan, 5114 Administrasi; 52 Biaya keuangan; 53 Beban lain; 54 Beban pajak kini/tangguhan. |
| 6 Penghasilan lain | 61 → 6111 Pendapatan bunga, 6112 Keuntungan pelepasan aset. Penempatan laporan perlu mengikuti sifat usaha dan standar yang berlaku pada periode. |
| 7 Penghasilan komprehensif lain | 71 Pos yang tidak direklasifikasi → revaluasi, pengukuran kembali imbalan pasti, pajak terkait; 72 Pos yang dapat direklasifikasi → instrumen utang FVOCI, selisih penjabaran dan pajak terkait. Akun mutasi OCI dan akumulasi OCI di ekuitas dibedakan; perlakuan akhir memerlukan jurnal penutupan yang disetujui. |

Setara kas hanya untuk instrumen yang memenuhi kriteria likuiditas, jangka pendek dan risiko perubahan nilai yang tidak signifikan; tidak semua deposito diperlakukan sebagai setara kas. Akun yang belum relevan tidak perlu dipakai. Aset, uang muka dan beban harus dibedakan berdasarkan substansi transaksi. Pusat dan tiga cabang memakai chart yang sama dengan dimensi cabang pada jurnal.

Untuk periode November 2026, rujukan penyajian tetap PSAK 201 sesuai kerangka SAK yang dipilih perusahaan. IAI telah mengesahkan PSAK 118 yang menggantikan PSAK 201 dan berlaku efektif **1 Januari 2027**; template ini tidak menyatakan penerapan dini. Penyesuaian penyajian 2027, pelaporan formal, instrumen keuangan, imbalan kerja dan pajak tangguhan tetap pekerjaan lanjutan sesuai transaksi nyata. Sumber: [IAI: pengesahan PSAK 118](https://web.iaiglobal.or.id/Berita-IAI/detail/pengesahan_psak_118_penyajian_dan_pengungkapan_dalam_laporan_keuangan), [IAI: DSAK Terkini Desember 2025](https://web.iaiglobal.or.id/Berita-IAI/detail/telah_terbit_dsak_terkini_edisi_desember_2025).

Ditinjau 4 November 2026 melalui sumber DJP dan IAI. Profil vendor, objek transaksi, tanggal, dokumen pajak dan ketentuan khusus menentukan hasil; pilihan tarif tidak menyatakan seluruh transaksi perusahaan sudah memenuhi aturan.

## PPN

PMK 131/2024 membedakan tarif 12% dan dasar pengenaannya. Untuk transaksi umum nonmewah yang tercakup ketentuan ini, PPN = 12% × 11/12 × harga/penggantian (efektif 11%). Untuk objek yang benar-benar menggunakan DPP penuh, hasilnya 12%. Transaksi tidak terutang/dibebaskan/tidak dipungut dan rezim besaran tertentu harus dibedakan dari tarif umum; jangan menganggap semua jasa memakai cara yang sama. Ketentuan DPP/besaran tertentu juga dirangkum dalam PMK 11/2025.

Sumber: [DJP: PMK 131/2024](https://pajak.go.id/node/113453), [DJP: DPP nilai lain dan besaran tertentu](https://stats.pajak.go.id/id/siaran-pers/pemerintah-terbitkan-aturan-dpp-nilai-lain-dan-besaran-tertentu-ppn).

## PPh

- PPh 23 jasa tertentu/sewa selain tanah dan bangunan: pilihan umum 2% dari dasar pemotongan yang sesuai. PPh 23 juga memiliki objek/tarif lain; tidak semua invoice vendor adalah objek 2%.
- PPh final sewa tanah/bangunan: 10% dari jumlah bruto yang relevan; jangan menggunakannya untuk semua kontraktor.
- Jasa konstruksi menurut PP 9/2022 berbeda menurut jenis dan sertifikat/kualifikasi: pekerjaan konstruksi 1,75%, 2,65% atau 4%; pekerjaan terintegrasi 2,65% atau 4%; konsultansi konstruksi 3,5% atau 6%. Verifikasi sertifikat dan objek sebelum memilih.
- Konsultan orang pribadi bukan pegawai: PMK 168/2023 menggunakan tarif Pasal 17 atas 50% penghasilan bruto yang relevan. Tarif progresif 5%, 15%, 25%, 30%, 35% memakai lapisan sampai Rp60 juta, Rp250 juta, Rp500 juta, Rp5 miliar, dan sisanya. Ini berbeda dari TER untuk penghasilan pegawai tertentu. Periksa komponen bruto, pengecualian dan kondisi penerima.
- Satu pilihan jenis pemotongan per draft invoice pada tahap ini. Jika invoice memuat beberapa objek PPh, pecah dokumen atau minta penyesuaian per baris; jangan menjumlahkan beberapa jenis PPh secara otomatis pada dasar yang sama.
- Tarif khusus, fasilitas, gross-up, vendor tanpa identitas pajak yang sesuai, PPh 26 dan payroll tidak boleh diperlakukan otomatis sebagai salah satu pilihan umum. Accounting–Tax harus mengklarifikasi sebelum persetujuan.

Sumber: [DJP: PPh 23](https://www.pajak.go.id/id/pemotongan-pajak-penghasilan-pasal-23), [DJP: sewa tanah/bangunan](https://www.pajak.go.id/id/pemotongan-pajak-penghasilan-pasal-4-ayat-2-3), [DJP: jasa konstruksi](https://pajak.go.id/id/artikel/penurunan-pajak-pada-usaha-jasa-konstruksi), [DJP: PMK 168/2023](https://pajak.go.id/id/peraturan/petunjuk-pelaksanaan-pemotongan-pajak-atas-penghasilan-sehubungan-dengan-pekerjaan-jasa-1).

## Jurnal

COA bukan otomatis beban: tagihan dapat berupa persediaan, aset, uang muka/prepaid atau beban sesuai substansi dan pengakuannya. Faktur bukan satu-satunya bukti bahwa beban sudah terjadi. PPN masukan hanya masuk akun pajak masukan jika memenuhi syarat pengkreditan; selain itu perlakuannya dialokasikan ke biaya/aset yang sesuai. Periksa apakah pengakuan PPh terutang sudah terjadi pada pengakuan utang, jatuh tempo atau pembayaran menurut objeknya.

Contoh sederhana tagihan jasa Rp1.000.000, PPN masukan yang dapat dikreditkan Rp110.000 dan pemotongan PPh 23 Rp20.000:

| Saat pengakuan utang dengan pemotongan diakui | Debit | Kredit |
| --- | ---: | ---: |
| Beban/aset sesuai COA | 1.000.000 | 0 |
| PPN masukan | 110.000 | 0 |
| Utang PPh 23 | 0 | 20.000 |
| Utang vendor | 0 | 1.090.000 |

Saat pembayaran: debit utang vendor Rp1.090.000; kredit bank Rp1.090.000. Jika pemotongan baru diakui pada tahap pembayaran, utang awal bruto Rp1.110.000 kemudian didebit sebesar itu dengan kredit bank Rp1.090.000 dan utang PPh Rp20.000. Pilih satu metode yang konsisten dengan saat terutang dan jangan membukukan PPh dua kali. Setoran PPh adalah transaksi terpisah, bukan pembayaran kedua ke vendor.

Jurnal harus mempunyai sumber invoice, cabang, vendor, pemeriksa, periode terbuka, tanggal pengakuan, dan bukti pembayaran. Alokasi pusat bukan cabang usaha keempat. Laporan gabungan satu entitas menjumlahkan cabang dan menyelesaikan transaksi internal; ini tidak otomatis menjadi konsolidasi beberapa badan hukum menurut PSAK.

Rujukan penomoran standar: [IAI: SAK Indonesia berlaku efektif](https://web.iaiglobal.or.id/Berita-IAI/detail/sak_indonesia_update_-_psak_berlaku_efektif_2024_dan_setelahnya), termasuk PSAK 201 penyajian, PSAK 109 instrumen keuangan, PSAK 216 aset tetap dan PSAK 115 pendapatan dari kontrak pelanggan sesuai relevansi. Implementasi jurnal berimbang bukan sertifikasi bahwa seluruh PSAK/ISAK perusahaan telah tercakup.
