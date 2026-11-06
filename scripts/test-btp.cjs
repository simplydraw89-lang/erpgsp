const ts = require("typescript");
const fs = require("fs");
const path = require("path");
const Module = require("module");

const source = path.resolve("C:/Users/ardie/Desktop/Project Ardie/erpgsp/src/app/api/invoice-documents/extract.ts");
const compiled = ts.transpileModule(fs.readFileSync(source, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText;

const mod = new Module(source, module);
mod.filename = source;
mod.paths = module.paths;
mod._compile(compiled, source);
const { parseInvoiceText } = mod.exports;

const textBTP = `PT BUMI TEKNIK PRIMA
Jl. Gatot Subroto No. 45, Jakarta Selatan 12930
Telp: (021) 555-1234 | Email: billing@bumiteknik.id
NPWP: 01.234.567.8-901.000

INVOICE
No. Invoice: INV/BTP/2026/09/001
Tanggal: 12 September 2026
Jatuh Tempo: 27 September 2026

TAGIHAN KEPADA:
PT Air Murni Indonesia
Jl. Sudirman Kav. 52-53
Jakarta Pusat 12190
NPWP: 02.345.678.9-012.000
Kontak: Bapak Andi Wijaya (Procurement)

INFORMASI PROYEK:
Proyek: Penyediaan Sistem Penyulingan Air & Pemetaan Lahan
Lokasi: Area Pengembangan, Jawa Barat
Referensi SPK: SPK/AMI/2026/08/017
Periode Pekerjaan: Agustus – September 2026

No Uraian Jasa / Pekerjaan Nilai (Rp)
1 Jasa Pemetaan Lahan Rp 150.000.000
Survei topografi, pengukuran batas lahan, pembuatan peta digital (CAD/GIS), dan laporan hasil pemetaan untuk area pengembangan sistem penyulingan air.
2 Jasa Konsultan Teknik Rp 150.000.000
Konsultasi perancangan teknis, review desain proses, analisis kelayakan teknis, dan penyusunan dokumen engineering untuk sistem penyulingan air.
3 Jasa Konstruksi terkait Penyulingan Air Rp 150.000.000
Pekerjaan konstruksi sipil dan mekanikal untuk instalasi unit penyulingan air, termasuk pondasi, piping, dan instalasi peralatan pendukung sesuai spesifikasi teknis.

Subtotal (DPP) Rp 450.000.000
PPN 11% (efektif) Rp 49.500.000
Total Tagihan (termasuk PPN) Rp 499.500.000
Potongan PPh Pasal 23 (2%) – Pemetaan (Rp 3.000.000)
Potongan PPh Pasal 23 (2%) – Konsultan (Rp 3.000.000)
Potongan PPh Final 4(2) (2,65%) – Konstruksi (Rp 3.975.000)
JUMLAH YANG HARUS DIBAYAR Rp 489.525.000

Keterangan Pajak:
• PPN dihitung dengan tarif efektif 11% (sesuai ketentuan PMK terkait DPP Nilai Lain).
• PPh Pasal 23 sebesar 2% dari DPP (untuk jasa pemetaan & konsultan teknik) dipotong oleh pemberi kerja.
• PPh Final Pasal 4 ayat (2) sebesar 2,65% dari DPP (untuk jasa konstruksi, kualifikasi menengah/besar) dipotong oleh pemberi kerja sesuai PP 9/2022.

INFORMASI PEMBAYARAN
Silakan transfer ke rekening berikut:
Bank Central Asia (BCA)
No. Rekening: 123-456-7890
Atas Nama: PT Bumi Teknik Prima
`;

console.log("=== BTP OCR TEXT TEST ===");
const res = parseInvoiceText(textBTP);
console.log(JSON.stringify(res, null, 2));
