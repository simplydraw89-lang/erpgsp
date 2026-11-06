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

const textFP1 = `Faktur Pajak
Kode dan Nomor Seri Faktur Pajak: 07002500012345678

Pengusaha Kena Pajak:
Nama : ABC MOTOR DEALER
Alamat : JALAN GATOT SUBROTO NO. 40A, RT 005, RW 003, SENAYAN, KEBAYORAN BARU, JAKARTA SELATAN 12910
NPWP : 0012345678012000

Pembeli Barang Kena Pajak/Penerima Jasa Kena Pajak:
Nama : BATAM AYU BAHARI
Alamat : JALAN KUDA LAUT NO. 1, RT 001, RW 002, SUNGAI JODOH, BATU AMPAR, BATAM 29444
NPWP : 0023456789217000

No. Kode Barang/Jasa Nama Barang Kena Pajak/Jasa Kena Pajak Harga Jual/Penggantian/Uang Muka/Termin (Rp)
1. 870300 Mobil 1.500 cc 300.000.000,00

Harga Jual/Penggantian/Uang Muka/Termin 300.000.000,00
Dikurangi Potongan Harga 0,00
Dikurangi Uang Muka yang telah diterima 0,00
Dasar Pengenaan Pajak 300.000.000,00
Jumlah PPN (Pajak Pertambahan Nilai) 36.000.000,00
Jumlah PPnBM (Pajak Penjualan atas Barang Mewah) 0,00

Tempat dan Tanggal: JAKARTA SELATAN, 01 JULI 2025
(Referensi: Invoice 123/ABC/VII/2025)
`;

console.log("=== FAKTUR PAJAK 1 ===");
console.log(JSON.stringify(parseInvoiceText(textFP1), null, 2));
