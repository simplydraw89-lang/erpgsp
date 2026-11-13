"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MoneyInput } from "@/components/ui/money-input"
import { formatCurrency } from "@/lib/money"
import {
  deleteFiscalAdjustmentAction,
  saveFiscalAdjustmentAction,
} from "@/app/(workspace)/modul/tax-actions"

export type PurchaseTaxRow = {
  id: string
  branch_id: string | null
  invoice_number: string
  invoice_date: string
  tax_invoice_number: string | null
  tax_invoice_date: string | null
  vendor_snapshot: { name?: string; npwp?: string } | null
  subtotal: number | string
  vat_amount: number | string
  vat_creditable: boolean
  withholding_code: string
  withholding_amount: number | string
  status: string
}

export type SalesTaxRow = {
  id: string
  branch_id: string | null
  invoice_number: string
  invoice_date: string
  amount: number | string
  vat_amount: number | string
  wht_amount: number | string
  wht_proof_number: string | null
  total_amount: number | string
  status: string
}

export type FiscalAdjustmentRow = {
  id: string
  fiscal_year: number
  adjustment_type: "positive" | "negative"
  difference_kind: "permanent" | "temporary"
  account_code: string | null
  description: string
  amount: number | string
  tax_rule_ref: string | null
}

type BranchOption = { id: string; code: string; name: string }

const withholdingLabels: Record<string, string> = {
  pph23_service: "PPh 23 Jasa",
  pph23_rental: "PPh 23 Sewa Non-Tanah/Bangunan",
  pph_final_rental: "PPh Final 4(2) Sewa Tanah/Bangunan",
  pph_final_construction: "PPh Final Jasa Konstruksi",
  pph21_nonemployee: "PPh 21 Bukan Pegawai",
}

function monthKey(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr.length < 7) return "Tanpa Tanggal"
  return dateStr.slice(0, 7)
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function TaxRecapView({
  purchases,
  salesInvoices,
  branches,
  fiscalAdjustments,
  commercialNetIncome,
  canEditFiscal,
}: {
  purchases: PurchaseTaxRow[]
  salesInvoices: SalesTaxRow[]
  branches: BranchOption[]
  fiscalAdjustments: FiscalAdjustmentRow[]
  commercialNetIncome: number
  canEditFiscal: boolean
}) {
  const [activeTab, setActiveTab] = useState<"ppn" | "pph" | "fiscal">("ppn")
  const [selectedBranch, setSelectedBranch] = useState<string>("")
  const [selectedPeriod, setSelectedPeriod] = useState<string>("")
  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear())
  const [taxRateMode, setTaxRateMode] = useState<"22" | "11">("22")

  const branchMap = useMemo(
    () => new Map(branches.map((b) => [b.id, `${b.code} · ${b.name}`])),
    [branches],
  )

  const validPurchases = useMemo(
    () =>
      purchases.filter((p) => {
        if (!["accounting_review", "payment_ready", "paid"].includes(p.status)) return false
        if (selectedBranch && p.branch_id !== selectedBranch) return false
        if (selectedPeriod && monthKey(p.tax_invoice_date || p.invoice_date) !== selectedPeriod)
          return false
        return true
      }),
    [purchases, selectedBranch, selectedPeriod],
  )

  const validSales = useMemo(
    () =>
      salesInvoices.filter((s) => {
        if (s.status === "cancelled") return false
        if (selectedBranch && s.branch_id !== selectedBranch) return false
        if (selectedPeriod && monthKey(s.invoice_date) !== selectedPeriod) return false
        return true
      }),
    [salesInvoices, selectedBranch, selectedPeriod],
  )

  const availablePeriods = useMemo(() => {
    const set = new Set<string>()
    for (const p of purchases) set.add(monthKey(p.tax_invoice_date || p.invoice_date))
    for (const s of salesInvoices) set.add(monthKey(s.invoice_date))
    set.delete("Tanpa Tanggal")
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [purchases, salesInvoices])

  const ppnMasukanCreditable = validPurchases
    .filter((p) => p.vat_creditable)
    .reduce((sum, p) => sum + Number(p.vat_amount ?? 0), 0)
  const ppnMasukanNonCreditable = validPurchases
    .filter((p) => !p.vat_creditable)
    .reduce((sum, p) => sum + Number(p.vat_amount ?? 0), 0)
  const ppnKeluaran = validSales.reduce((sum, s) => sum + Number(s.vat_amount ?? 0), 0)
  const netPpn = ppnKeluaran - ppnMasukanCreditable

  const pphByCode = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of validPurchases) {
      const amt = Number(p.withholding_amount ?? 0)
      if (amt <= 0 || p.withholding_code === "none") continue
      map.set(p.withholding_code, (map.get(p.withholding_code) ?? 0) + amt)
    }
    return Array.from(map.entries())
  }, [validPurchases])

  const totalPphDipotongPerusahaan = pphByCode.reduce((sum, [, v]) => sum + v, 0)
  const totalPph23KreditKlien = validSales.reduce((sum, s) => sum + Number(s.wht_amount ?? 0), 0)

  // Rekonsiliasi Fiskal berdasarkan Tahun Pajak
  const yearAdjustments = useMemo(
    () => fiscalAdjustments.filter((a) => a.fiscal_year === fiscalYear),
    [fiscalAdjustments, fiscalYear],
  )
  const totalPositiveAdj = yearAdjustments
    .filter((a) => a.adjustment_type === "positive")
    .reduce((s, a) => s + Number(a.amount ?? 0), 0)
  const totalNegativeAdj = yearAdjustments
    .filter((a) => a.adjustment_type === "negative")
    .reduce((s, a) => s + Number(a.amount ?? 0), 0)
  const fiscalIncome = commercialNetIncome + totalPositiveAdj - totalNegativeAdj
  const corporateTaxRate = taxRateMode === "22" ? 0.22 : 0.11
  const estimatedCorporateTax = fiscalIncome > 0 ? Math.round(fiscalIncome * corporateTaxRate) : 0
  const yearSalesCreditPph23 = salesInvoices
    .filter((s) => s.status !== "cancelled" && s.invoice_date.startsWith(String(fiscalYear)))
    .reduce((s, x) => s + Number(x.wht_amount ?? 0), 0)
  const netCorporateTaxPayable = estimatedCorporateTax - yearSalesCreditPph23

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "ppn", label: "PPN Masukan & Keluaran" },
            { key: "pph", label: "Rekap PPh & Bukti Potong" },
            { key: "fiscal", label: "Rekonsiliasi Fiskal (SPT Tahunan)" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as "ppn" | "pph" | "fiscal")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                activeTab === tab.key
                  ? "bg-brand text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab !== "fiscal" && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="h-9 rounded-md border border-border bg-white px-2 text-sm"
            >
              <option value="">Semua Cabang (1 Pelaporan)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.name}
                </option>
              ))}
            </select>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="h-9 rounded-md border border-border bg-white px-2 text-sm"
            >
              <option value="">Semua Masa Pajak</option>
              {availablePeriods.map((m) => (
                <option key={m} value={m}>
                  Masa {m}
                </option>
              ))}
            </select>
          </div>
        )}
      </Card>

      {activeTab === "ppn" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs text-muted">PPN Masukan (Dapat Dikreditkan)</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-emerald-700">
                {formatCurrency(ppnMasukanCreditable)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted">PPN Masukan (Non-Kredit)</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-slate-700">
                {formatCurrency(ppnMasukanNonCreditable)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted">PPN Keluaran (Penjualan)</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-blue-700">
                {formatCurrency(ppnKeluaran)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted">
                {netPpn >= 0 ? "PPN Kurang Bayar" : "PPN Lebih Bayar"}
              </p>
              <p
                className={`mt-2 text-xl font-bold tabular-nums ${
                  netPpn >= 0 ? "text-amber-700" : "text-emerald-700"
                }`}
              >
                {formatCurrency(Math.abs(netPpn))}
              </p>
            </Card>
          </div>

          <Card className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Rincian Faktur Pajak Masukan ({validPurchases.length})</h3>
              <Button
                type="button"
                variant="secondary"
                className="h-8 px-3 text-xs"
                onClick={() =>
                  downloadCsv(
                    `ppn-masukan-${selectedPeriod || "semua"}.csv`,
                    ["No Invoice", "No Faktur Pajak", "Tgl Faktur", "Vendor", "NPWP", "DPP", "PPN", "Dikreditkan"],
                    validPurchases.map((p) => [
                      p.invoice_number,
                      p.tax_invoice_number ?? "",
                      p.tax_invoice_date ?? p.invoice_date,
                      p.vendor_snapshot?.name ?? "",
                      p.vendor_snapshot?.npwp ?? "",
                      Number(p.subtotal ?? 0),
                      Number(p.vat_amount ?? 0),
                      p.vat_creditable ? "Ya" : "Tidak",
                    ]),
                  )
                }
              >
                Ekspor CSV Masukan
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">No. Faktur Pajak</th>
                    <th className="px-3 py-2">Tgl Faktur / Inv</th>
                    <th className="px-3 py-2">Vendor / NPWP</th>
                    <th className="px-3 py-2 text-right">DPP</th>
                    <th className="px-3 py-2 text-right">PPN</th>
                    <th className="px-3 py-2">Pengkreditan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {validPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-xs text-muted">
                        Belum ada transaksi pembelian terverifikasi pada filter ini.
                      </td>
                    </tr>
                  ) : (
                    validPurchases.map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2 font-mono text-xs">
                          {p.tax_invoice_number || `Inv: ${p.invoice_number}`}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          {p.tax_invoice_date || p.invoice_date}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <p className="font-medium">{p.vendor_snapshot?.name ?? "—"}</p>
                          <p className="text-muted">{p.vendor_snapshot?.npwp ?? "NPWP belum ada"}</p>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(p.subtotal)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(p.vat_amount)}</td>
                        <td className="px-3 py-2 text-xs">
                          <span
                            className={`rounded px-2 py-0.5 font-medium ${
                              p.vat_creditable
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {p.vat_creditable ? "Dapat Dikreditkan" : "Non-Kredit"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Rincian PPN Keluaran Penjualan ({validSales.length})</h3>
              <Button
                type="button"
                variant="secondary"
                className="h-8 px-3 text-xs"
                onClick={() =>
                  downloadCsv(
                    `ppn-keluaran-${selectedPeriod || "semua"}.csv`,
                    ["No Invoice", "Tanggal", "Cabang", "DPP", "PPN Keluaran", "Total", "Status"],
                    validSales.map((s) => [
                      s.invoice_number,
                      s.invoice_date,
                      (s.branch_id && branchMap.get(s.branch_id)) || "",
                      Number(s.amount ?? 0),
                      Number(s.vat_amount ?? 0),
                      Number(s.total_amount ?? 0),
                      s.status,
                    ]),
                  )
                }
              >
                Ekspor CSV Keluaran
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">No. Invoice</th>
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2">Cabang</th>
                    <th className="px-3 py-2 text-right">DPP</th>
                    <th className="px-3 py-2 text-right">PPN Keluaran</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {validSales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-xs text-muted">
                        Belum ada invoice penjualan pada filter ini.
                      </td>
                    </tr>
                  ) : (
                    validSales.map((s) => (
                      <tr key={s.id}>
                        <td className="px-3 py-2 font-mono text-xs">{s.invoice_number}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">{s.invoice_date}</td>
                        <td className="px-3 py-2 text-xs">
                          {(s.branch_id && branchMap.get(s.branch_id)) || "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(s.amount)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(s.vat_amount)}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">
                          {formatCurrency(s.total_amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "pph" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <p className="text-sm text-muted">Total PPh Dipotong Perusahaan (Utang PPh Pembelian)</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-amber-700">
                {formatCurrency(totalPphDipotongPerusahaan)}
              </p>
              <p className="mt-1 text-xs text-muted">Wajib disetor ke kas negara & dibuatkan e-Bupot</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted">Total PPh 23 Dipotong Klien (Kredit Pajak Penjualan)</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-700">
                {formatCurrency(totalPph23KreditKlien)}
              </p>
              <p className="mt-1 text-xs text-muted">Mengurangi PPh Badan pada SPT Tahunan</p>
            </Card>
          </div>

          <Card className="space-y-3 p-5">
            <h3 className="font-semibold">Rekap PPh Dipotong per Jenis</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {pphByCode.length === 0 ? (
                <p className="text-xs text-muted">Belum ada pemotongan PPh pada pembelian.</p>
              ) : (
                pphByCode.map(([code, amount]) => (
                  <div key={code} className="rounded-lg border border-border bg-slate-50 p-3">
                    <p className="text-xs text-muted">{withholdingLabels[code] ?? code}</p>
                    <p className="mt-1 font-semibold tabular-nums">{formatCurrency(amount)}</p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <h3 className="font-semibold">Daftar Bukti Potong PPh 23 dari Klien</h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">No. Invoice</th>
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2">No. Bukti Potong</th>
                    <th className="px-3 py-2 text-right">DPP</th>
                    <th className="px-3 py-2 text-right">PPh 23 Dipotong</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {validSales.filter((s) => Number(s.wht_amount ?? 0) > 0).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-xs text-muted">
                        Belum ada potongan PPh 23 pada invoice penjualan.
                      </td>
                    </tr>
                  ) : (
                    validSales
                      .filter((s) => Number(s.wht_amount ?? 0) > 0)
                      .map((s) => (
                        <tr key={s.id}>
                          <td className="px-3 py-2 font-mono text-xs">{s.invoice_number}</td>
                          <td className="px-3 py-2 text-xs">{s.invoice_date}</td>
                          <td className="px-3 py-2 text-xs">
                            {s.wht_proof_number || (
                              <span className="text-amber-700">Belum ada nomor bukti potong</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(s.amount)}</td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">
                            {formatCurrency(s.wht_amount)}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "fiscal" && (
        <div className="space-y-5">
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Rekonsiliasi Fiskal & Estimasi PPh Badan</h3>
                <p className="text-xs text-muted">
                  Menghitung Penghasilan Kena Pajak (Laba Fiskal) dari Laba Komersial ditambah koreksi positif dan dikurangi koreksi negatif.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(Number(e.target.value) || new Date().getFullYear())}
                  className="h-9 w-24 rounded-md border border-border bg-white px-2 text-sm"
                  aria-label="Tahun Pajak"
                />
                <select
                  value={taxRateMode}
                  onChange={(e) => setTaxRateMode(e.target.value as "22" | "11")}
                  className="h-9 rounded-md border border-border bg-white px-2 text-sm"
                >
                  <option value="22">Tarif Umum PPh Badan (22%)</option>
                  <option value="11">Fasilitas Pasal 31E (11%)</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border border-border bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs text-muted">1. Laba / (Rugi) Komersial (Buku Besar)</p>
                <p className="mt-1 text-base font-semibold tabular-nums">
                  {formatCurrency(commercialNetIncome)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">2. (+) Koreksi Fiskal Positif</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-amber-700">
                  + {formatCurrency(totalPositiveAdj)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">3. (−) Koreksi Fiskal Negatif</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-emerald-700">
                  − {formatCurrency(totalNegativeAdj)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">4. Laba Fiskal / Penghasilan Kena Pajak</p>
                <p className="mt-1 text-base font-bold tabular-nums">{formatCurrency(fiscalIncome)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">5. PPh Badan Terutang ({taxRateMode}%)</p>
                <p className="mt-1 text-base font-semibold tabular-nums">
                  {formatCurrency(estimatedCorporateTax)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">
                  6. Estimasi Kurang/(Lebih) Bayar (setelah Kredit PPh 23 {formatCurrency(yearSalesCreditPph23)})
                </p>
                <p
                  className={`mt-1 text-base font-bold tabular-nums ${
                    netCorporateTaxPayable >= 0 ? "text-red-700" : "text-emerald-700"
                  }`}
                >
                  {netCorporateTaxPayable >= 0
                    ? `Kurang Bayar ${formatCurrency(netCorporateTaxPayable)}`
                    : `Lebih Bayar ${formatCurrency(Math.abs(netCorporateTaxPayable))}`}
                </p>
              </div>
            </div>
          </Card>

          {canEditFiscal && (
            <Card className="space-y-3 p-5">
              <h4 className="font-semibold">Tambah Koreksi Fiskal ({fiscalYear})</h4>
              <form action={saveFiscalAdjustmentAction} className="grid gap-3 md:grid-cols-6">
                <input type="hidden" name="fiscal_year" value={fiscalYear} />
                <select
                  name="adjustment_type"
                  required
                  className="h-9 rounded-md border border-border bg-white px-2 text-sm"
                >
                  <option value="positive">Koreksi Positif (+)</option>
                  <option value="negative">Koreksi Negatif (−)</option>
                </select>
                <select
                  name="difference_kind"
                  required
                  className="h-9 rounded-md border border-border bg-white px-2 text-sm"
                >
                  <option value="permanent">Beda Tetap</option>
                  <option value="temporary">Beda Waktu</option>
                </select>
                <input
                  type="text"
                  name="account_code"
                  placeholder="Kode Akun (opsional)"
                  className="h-9 rounded-md border border-border bg-white px-2 text-sm"
                />
                <input
                  type="text"
                  name="description"
                  required
                  placeholder="Uraian (mis. Sanksi Pajak / Natura)"
                  className="h-9 rounded-md border border-border bg-white px-2 text-sm md:col-span-2"
                />
                <MoneyInput name="amount" placeholder="Nominal" required />
                <input
                  type="text"
                  name="tax_rule_ref"
                  placeholder="Dasar aturan (mis. Pasal 9 UU PPh)"
                  className="h-9 rounded-md border border-border bg-white px-2 text-sm md:col-span-5"
                />
                <Button type="submit" className="h-9">
                  Simpan Koreksi
                </Button>
              </form>
            </Card>
          )}

          <Card className="space-y-3 p-5">
            <h4 className="font-semibold">Daftar Koreksi Fiskal Tahun {fiscalYear}</h4>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">Jenis</th>
                    <th className="px-3 py-2">Sifat</th>
                    <th className="px-3 py-2">Akun</th>
                    <th className="px-3 py-2">Uraian & Dasar Aturan</th>
                    <th className="px-3 py-2 text-right">Nominal</th>
                    {canEditFiscal && <th className="px-3 py-2">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {yearAdjustments.length === 0 ? (
                    <tr>
                      <td colSpan={canEditFiscal ? 6 : 5} className="px-3 py-4 text-center text-xs text-muted">
                        Belum ada koreksi fiskal untuk tahun {fiscalYear}.
                      </td>
                    </tr>
                  ) : (
                    yearAdjustments.map((adj) => (
                      <tr key={adj.id}>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-medium ${
                              adj.adjustment_type === "positive"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {adj.adjustment_type === "positive" ? "Positif (+)" : "Negatif (−)"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {adj.difference_kind === "permanent" ? "Beda Tetap" : "Beda Waktu"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{adj.account_code ?? "—"}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium">{adj.description}</p>
                          {adj.tax_rule_ref && <p className="text-xs text-muted">{adj.tax_rule_ref}</p>}
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">
                          {formatCurrency(adj.amount)}
                        </td>
                        {canEditFiscal && (
                          <td className="px-3 py-2">
                            <form action={deleteFiscalAdjustmentAction}>
                              <input type="hidden" name="adjustment_id" value={adj.id} />
                              <button type="submit" className="text-xs text-red-700 underline">
                                Hapus
                              </button>
                            </form>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
