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

const textBTP4 = `PT BUMI TEKNIK PRIMA
Jl. Gatot Subroto No. 45
Jakarta Selatan 12930
Telp: (021) 555-1234
NPWP: 01.234.567.8-901.000

INVOICE
No. Invoice: INV/BTP/2026/09/004
Tanggal: 12 September 2026
Jatuh Tempo: 27 September 2026

TAGIHAN KEPADA:
PT Air Murni Indonesia
Jl. Sudirman Kav. 52-53
Jakarta Pusat 12190
NPWP: 02.345.678.9-012.000

INFORMASI PROYEK:
Proyek: Sistem Penyulingan Air
Lokasi: Jawa Barat
No. SPK: SPK/AMI/2026/08/017
Periode: Agustus - September 2026

No Uraian Qty Harga Satuan Jumlah
1 Jasa Konstruksi instalasi unit penyulingan air 1 paket Rp 150.000.000 Rp 150.000.000

Subtotal (DPP) Rp 150.000.000
PPN 11% Rp 16.500.000
Total + PPN Rp 166.500.000
PPh Final 4(2) (2,65%) (Rp 3.975.000)
JUMLAH DIBAYAR Rp 162.525.000

Keterangan Pajak:
• PPN dihitung dengan tarif efektif 11%.
• PPh Final Pasal 4 ayat (2) 2.65% (kualifikasi menengah/besar) sesuai PP 9/2022.
• Pajak bersifat final dan tidak dapat dikreditkan.

Informasi Pembayaran:
Bank Central Asia (BCA)
No. Rekening: 123-456-7890
a.n. PT Bumi Teknik Prima
`;

console.log("=== BTP 004 TEST ===");
const res = parseInvoiceText(textBTP4);
console.log(JSON.stringify(res, null, 2));
