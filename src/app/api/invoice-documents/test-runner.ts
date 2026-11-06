import { parseInvoiceText } from "./extract"

const tests = [
  // 1. Indonesian variations of invoice number
  "No. Inv: INV/2026/XI/0092\nTanggal: 05-11-2026\nVendor: PT Sinar Teknik",
  "No Tagihan : 2026/X/SP-041\nTgl : 28 Oktober 2026\nNama Supplier : UD Sumber Makmur",
  "FAKTUR TAGIHAN\nInvoice Number: INV-88219-JKT\nDate: 02/11/2026\nDari: CV. Makmur Sejahtera",
  "DEBIT NOTE # DN-9912\nTanggal: 12/10/2026\nPerusahaan: PT Indo Perkasa",
  "Nomor : INV.2026.0112\nTanggal : 15 Nov 2026\nKepada: PT ABC\nDari : PT Global Sarana",
  "Bill To: PT ABC\nInvoice: 998822\nDate: 2026-11-01\nVendor: Telkomsel",

  // 2. Overlapping period line cases
  `INVOICE
No Inv: INV-01
Tanggal: 01/11/2026
Vendor: PT Prima
Periode Tagihan: Oktober 2026
1. Jasa Konsultasi Pajak Rp 5.000.000
2. Sewa Server Periode 2026 Rp 1.500.000
Subtotal: Rp 6.500.000`,

  `FAKTUR
No: 12345
Tanggal: 10/11/2026
Supplier: CV Mitra
1. Langganan Periode Januari - Maret 2026
2. Biaya Bandwidth Internet Rp 2.000.000
Total Rp 2.000.000`
]

for (const t of tests) {
  console.log("-----------------------------------------")
  const res = parseInvoiceText(t)
  console.log("Number:", res.invoice_number)
  console.log("Date:", res.invoice_date)
  console.log("Vendor:", res.vendor_name)
  console.log("Lines:", res.lines)
}
