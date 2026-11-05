export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense"
export type CoaAccount = {
  id: string; code: string; name: string; account_type: AccountType; normal_balance: string;
  parent_account_id: string | null; is_postable: boolean; is_active: boolean;
  report_section: string; posting_category: string; row_version: number;
}
export const sectionLabels: Record<string, string> = {
  asset: "Aset", liability: "Liabilitas", equity: "Ekuitas", revenue: "Penghasilan usaha",
  expense: "Beban dan biaya", other_income: "Penghasilan lain", oci: "Penghasilan komprehensif lain",
}
export const categoryLabels: Record<string, string> = {
  general: "Kelompok / umum", cash_bank: "Kas / bank / setara kas", receivable: "Piutang usaha",
  trade_payable: "Utang usaha", input_vat: "PPN masukan", output_vat: "PPN keluaran",
  withholding_tax: "Utang PPh", inventory: "Persediaan", fixed_asset: "Aset tetap / aset lain",
  equity: "Ekuitas", revenue: "Penghasilan", expense: "Beban / biaya", oci: "OCI",
}
// The codes are a company template, not codes mandated by PSAK. The twelve
// original posting codes are retained to preserve existing references.
const template = `
1||ASET|asset|debit|false|asset|general
10|1|Aset Lancar|asset|debit|false|asset|general
1100|10|Kas dan Setara Kas|asset|debit|false|asset|general
1101|1100|Kas|asset|debit|true|asset|cash_bank
1102|1100|Bank Operasional|asset|debit|true|asset|cash_bank
1103|1100|Deposito yang Memenuhi Kriteria Setara Kas|asset|debit|true|asset|cash_bank
1120|10|Piutang Usaha|asset|debit|false|asset|general
1121|1120|Piutang Klien|asset|debit|true|asset|receivable
1122|1120|Piutang Retensi|asset|debit|true|asset|receivable
1129|1120|Cadangan Kerugian Kredit Piutang|asset|credit|true|asset|receivable
1190|10|Pajak Dibayar di Muka dan Aset Lancar Lain|asset|debit|false|asset|general
1191|1190|PPN Masukan|asset|debit|true|asset|input_vat
1192|1190|Pajak Penghasilan Dibayar di Muka|asset|debit|true|asset|general
1193|1190|Uang Muka Vendor|asset|debit|true|asset|general
1194|1190|Biaya Dibayar di Muka|asset|debit|true|asset|general
1200|10|Persediaan|asset|debit|false|asset|general
1201|1200|Persediaan|asset|debit|true|asset|inventory
15|1|Aset Tidak Lancar|asset|debit|false|asset|general
1500|15|Aset Tetap dan Akumulasi Penyusutan|asset|debit|false|asset|general
1501|1500|Aset Tetap|asset|debit|true|asset|fixed_asset
1502|1500|Peralatan Survei dan Teknis|asset|debit|true|asset|fixed_asset
1503|1500|Kendaraan|asset|debit|true|asset|fixed_asset
1509|1500|Akumulasi Penyusutan Aset Tetap|asset|credit|true|asset|fixed_asset
1590|15|Aset Tidak Lancar Lain|asset|debit|false|asset|general
1591|1590|Aset Hak Guna|asset|debit|true|asset|fixed_asset
1592|1590|Aset Takberwujud|asset|debit|true|asset|fixed_asset
2||LIABILITAS|liability|credit|false|liability|general
20|2|Liabilitas Jangka Pendek|liability|credit|false|liability|general
2100|20|Utang Usaha|liability|credit|false|liability|general
2101|2100|Utang Usaha|liability|credit|true|liability|trade_payable
2111|2100|Utang Subkontraktor dan Tenaga Ahli|liability|credit|true|liability|trade_payable
2120|20|Utang Pajak|liability|credit|false|liability|general
2102|2120|Utang PPh 23|liability|credit|true|liability|withholding_tax
2103|2120|Utang PPh Final|liability|credit|true|liability|withholding_tax
2104|2120|Utang PPh 21|liability|credit|true|liability|withholding_tax
2121|2120|PPN Keluaran|liability|credit|true|liability|output_vat
2122|2120|Utang PPh Badan|liability|credit|true|liability|withholding_tax
2130|20|Akrual dan Utang Lain|liability|credit|false|liability|general
2131|2130|Beban Masih Harus Dibayar|liability|credit|true|liability|general
2132|2130|Utang Gaji dan Tunjangan|liability|credit|true|liability|general
2140|20|Liabilitas Kontrak dan Uang Muka Klien|liability|credit|false|liability|general
2141|2140|Uang Muka Klien|liability|credit|true|liability|general
22|2|Liabilitas Jangka Panjang|liability|credit|false|liability|general
2211|22|Utang Bank Jangka Panjang|liability|credit|true|liability|general
2212|22|Liabilitas Sewa|liability|credit|true|liability|general
2213|22|Liabilitas Imbalan Kerja|liability|credit|true|liability|general
3||EKUITAS|equity|credit|false|equity|general
31|3|Modal Saham dan Tambahan Modal|equity|credit|false|equity|general
3111|31|Modal Saham Ditempatkan dan Disetor|equity|credit|true|equity|equity
3112|31|Tambahan Modal Disetor|equity|credit|true|equity|equity
32|3|Saldo Laba|equity|credit|false|equity|general
3211|32|Saldo Laba Ditahan|equity|credit|true|equity|equity
3212|32|Laba Rugi Tahun Berjalan|equity|credit|true|equity|equity
33|3|Akumulasi Penghasilan Komprehensif Lain|equity|credit|false|equity|general
3311|33|Surplus Revaluasi Aset|equity|credit|true|equity|equity
3312|33|Akumulasi Pengukuran Kembali Imbalan Pasti|equity|credit|true|equity|equity
3313|33|Cadangan Nilai Wajar melalui OCI|equity|credit|true|equity|equity
4||PENGHASILAN USAHA|revenue|credit|false|revenue|general
41|4|Pendapatan Jasa dan Proyek|revenue|credit|false|revenue|general
4111|41|Pendapatan Jasa Konsultansi|revenue|credit|true|revenue|revenue
4112|41|Pendapatan Survei dan Pengujian|revenue|credit|true|revenue|revenue
4113|41|Pendapatan Proyek Teknis|revenue|credit|true|revenue|revenue
42|4|Pengurang Pendapatan|revenue|debit|false|revenue|general
4211|42|Potongan dan Koreksi Pendapatan|revenue|debit|true|revenue|revenue
5||BEBAN DAN BIAYA|expense|debit|false|expense|general
50|5|Biaya Langsung Proyek|expense|debit|false|expense|general
5011|50|Biaya Tenaga Ahli dan Subkontraktor|expense|debit|true|expense|expense
5012|50|Biaya Material Proyek|expense|debit|true|expense|expense
5013|50|Biaya Perjalanan Proyek|expense|debit|true|expense|expense
5100|5|Beban Usaha dan Administrasi|expense|debit|false|expense|general
5101|5100|Beban Operasional|expense|debit|true|expense|expense
5102|5100|Beban Jasa|expense|debit|true|expense|expense
5103|5100|Beban Sewa|expense|debit|true|expense|expense
5111|5100|Beban Gaji dan Tunjangan|expense|debit|true|expense|expense
5112|5100|Beban Utilitas dan Komunikasi|expense|debit|true|expense|expense
5113|5100|Beban Penyusutan dan Amortisasi|expense|debit|true|expense|expense
5114|5100|Beban Administrasi Umum|expense|debit|true|expense|expense
52|5|Beban Pendanaan|expense|debit|false|expense|general
5211|52|Beban Bunga|expense|debit|true|expense|expense
5212|52|Beban Administrasi Bank|expense|debit|true|expense|expense
53|5|Beban Lain|expense|debit|false|expense|general
5311|53|Rugi Pelepasan Aset|expense|debit|true|expense|expense
54|5|Beban Pajak Penghasilan|expense|debit|false|expense|general
5411|54|Beban Pajak Kini|expense|debit|true|expense|expense
5412|54|Beban Pajak Tangguhan|expense|debit|true|expense|expense
6||PENGHASILAN LAIN|revenue|credit|false|other_income|general
61|6|Penghasilan di Luar Usaha Utama|revenue|credit|false|other_income|general
6111|61|Pendapatan Bunga|revenue|credit|true|other_income|revenue
6112|61|Laba Pelepasan Aset|revenue|credit|true|other_income|revenue
7||PENGHASILAN KOMPREHENSIF LAIN|equity|credit|false|oci|general
71|7|OCI Tidak Direklasifikasi ke Laba Rugi|equity|credit|false|oci|general
7111|71|Selisih Revaluasi Aset Tetap Periode Berjalan|equity|credit|true|oci|oci
7112|71|Pengukuran Kembali Imbalan Pasti Periode Berjalan|equity|credit|true|oci|oci
7113|71|Pajak atas OCI Tidak Direklasifikasi|equity|debit|true|oci|oci
72|7|OCI Dapat Direklasifikasi ke Laba Rugi|equity|credit|false|oci|general
7211|72|Perubahan Nilai Wajar Instrumen Utang FVOCI|equity|credit|true|oci|oci
7212|72|Selisih Kurs Penjabaran Operasi Luar Negeri|equity|credit|true|oci|oci
7213|72|Pajak atas OCI Dapat Direklasifikasi|equity|debit|true|oci|oci
`
export const recommendedCoa = template.trim().split("\n").map(row => {
  const [code, parent, name, type, normal, posting, section, category] = row.split("|")
  return { code, parent: parent || null, name, type: type as AccountType, normal, posting: posting === "true", section, category }
})

export function flattenCoa(accounts: CoaAccount[]) {
  const result: { account: CoaAccount; depth: number }[] = []
  const seen = new Set<string>()
  const walk = (parent: string | null, depth: number) => {
    for (const account of accounts.filter(row => row.parent_account_id === parent).sort((a, b) => a.code.localeCompare(b.code, "id", { numeric: true }))) {
      if (seen.has(account.id)) continue
      seen.add(account.id); result.push({ account, depth }); walk(account.id, depth + 1)
    }
  }
  walk(null, 0)
  for (const account of accounts) if (!seen.has(account.id)) result.push({ account, depth: 0 })
  return result
}
