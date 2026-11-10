"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Receipt,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  ArrowRight,
  Building2,
  CreditCard,
  Banknote,
  Send,
  Eye,
  Download,
  Calendar,
  Sparkles,
  Search,
  X,
  ExternalLink,
  Printer,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MoneyInput } from "@/components/ui/money-input"
import { SalesMenu } from "@/components/sales/sales-menu"
import { createSalesInvoiceAction, recordInvoicePaymentAction } from "@/app/(workspace)/pengajuan/penjualan/actions"
import { DocumentPrintModal } from "@/components/documents/document-print-modal"
import { PrintableInvoiceDocument } from "@/components/documents/printable-invoice"
import { PrintableReceiptDocument } from "@/components/documents/printable-receipt"

export type PaymentTerm = {
  id?: string
  index: number
  name: string
  percentage: number
  amount: number
  trigger: string
  estimated_date?: string
  status: "planned" | "invoiced" | "paid"
  invoice_id?: string
  invoice_number?: string
  receipt_number?: string
  paid_amount?: number
  paid_at?: string
  due_date?: string
  vat_amount?: number
  wht_amount?: number
  total_amount?: number
}

export type ProjectBillingItem = {
  id: string
  code: string
  name: string
  status: string
  approval_status: string
  branch_name: string
  branch_code: string
  client_name: string
  client_id: string
  contract_amount: number
  payment_terms: PaymentTerm[]
  invoices: Array<{
    id: string
    invoice_number: string
    term_name: string
    term_index: number
    percentage: number
    invoice_date: string
    due_date: string
    amount: number
    vat_amount: number
    wht_amount: number
    total_amount: number
    net_receivable: number
    status: "unpaid" | "paid" | "cancelled"
    paid_amount?: number
    paid_at?: string
    receipt_number?: string
    payment_method?: string
    bank_name?: string
    bank_reference?: string
    wht_proof_number?: string
    notes?: string
    invoice_journal_id?: string
    invoice_journal_number?: string
    invoice_journal_status?: string
    payment_journal_id?: string
    payment_journal_number?: string
    payment_journal_status?: string
  }>
}

function rupiah(num: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num || 0)
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "-"
  try {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

export function BillingWorkspace({
  projects = [],
  disabled = false,
}: {
  projects: ProjectBillingItem[]
  disabled?: boolean
}) {
  const [filterTab, setFilterTab] = useState<"actionable" | "paid" | "all">("actionable")
  const [searchQuery, setSearchQuery] = useState("")

  // Modal State: Terbitkan Invoice
  const [selectedTermForInvoice, setSelectedTermForInvoice] = useState<{
    project: ProjectBillingItem
    term: PaymentTerm
  } | null>(null)

  // Modal State: Catat Pembayaran
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<{
    project: ProjectBillingItem
    invoice: ProjectBillingItem["invoices"][0]
  } | null>(null)

  // Modal State: Pratinjau Kuitansi / Invoice
  const [viewDocument, setViewDocument] = useState<{
    type: "invoice" | "receipt"
    data: any
    project: ProjectBillingItem
  } | null>(null)

  // Modal State: Drilldown KPI Box
  const [kpiModal, setKpiModal] = useState<"contract" | "invoiced" | "paid" | "receivable" | null>(null)
  const [kpiSearch, setKpiSearch] = useState("")

  // Perhitungan Ringkasan Keuangan
  let totalContractValue = 0
  let totalInvoicedValue = 0
  let totalPaidValue = 0

  for (const p of projects) {
    totalContractValue += Number(p.contract_amount || 0)
    for (const inv of p.invoices) {
      if (inv.status !== "cancelled") {
        totalInvoicedValue += Number(inv.amount || 0)
      }
      if (inv.status === "paid") {
        totalPaidValue += Number(inv.paid_amount || inv.net_receivable || 0)
      }
    }
  }

  const outstandingReceivable = totalInvoicedValue - totalPaidValue

  // Flattened items for drilldowns
  const allInvoices = projects.flatMap((p) =>
    p.invoices.map((inv) => ({
      ...inv,
      project: p,
    }))
  )
  const paidInvoices = allInvoices.filter((inv) => inv.status === "paid")
  const unpaidInvoices = allInvoices.filter((inv) => inv.status === "unpaid")

  const kq = kpiSearch.toLowerCase().trim()
  const filteredProjectsForKpi = projects.filter(
    (p) =>
      !kq ||
      p.code.toLowerCase().includes(kq) ||
      p.name.toLowerCase().includes(kq) ||
      p.client_name.toLowerCase().includes(kq) ||
      p.branch_name.toLowerCase().includes(kq)
  )

  const filteredInvoicesForKpi = allInvoices.filter(
    (inv) =>
      !kq ||
      inv.invoice_number.toLowerCase().includes(kq) ||
      inv.project.name.toLowerCase().includes(kq) ||
      inv.project.client_name.toLowerCase().includes(kq) ||
      inv.term_name.toLowerCase().includes(kq)
  )

  const filteredPaidForKpi = paidInvoices.filter(
    (inv) =>
      !kq ||
      (inv.receipt_number || "").toLowerCase().includes(kq) ||
      inv.invoice_number.toLowerCase().includes(kq) ||
      inv.project.name.toLowerCase().includes(kq) ||
      inv.project.client_name.toLowerCase().includes(kq)
  )

  const filteredUnpaidForKpi = unpaidInvoices.filter(
    (inv) =>
      !kq ||
      inv.invoice_number.toLowerCase().includes(kq) ||
      inv.project.name.toLowerCase().includes(kq) ||
      inv.project.client_name.toLowerCase().includes(kq)
  )

  // Filter projects by search
  const filteredProjects = projects.filter((p) => {
    const matchSearch =
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.client_name.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchSearch) return false

    if (filterTab === "actionable") {
      // Ada termin yang belum ditagih atau ada invoice belum lunas
      const hasUninvoicedTerm = p.payment_terms.some((t) => t.status !== "paid")
      const hasUnpaidInvoice = p.invoices.some((inv) => inv.status === "unpaid")
      return hasUninvoicedTerm || hasUnpaidInvoice
    }
    if (filterTab === "paid") {
      return p.invoices.some((inv) => inv.status === "paid")
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* KPI Cards (Interactive Clickable Drilldowns) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          onClick={() => {
            setKpiModal("contract")
            setKpiSearch("")
          }}
          className="group cursor-pointer rounded-xl border border-line border-l-4 border-l-brand bg-white p-4 shadow-panel transition-all duration-150 hover:-translate-y-1 hover:shadow-lg hover:border-brand/40"
          title="Klik untuk melihat rincian seluruh proyek & nilai kontrak SPK"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Nilai Kontrak SPK</p>
            <span className="text-[10px] font-semibold text-brand opacity-80 group-hover:opacity-100 transition-opacity">
              Rincian &rarr;
            </span>
          </div>
          <p className="mt-1.5 text-2xl font-bold text-ink">{rupiah(totalContractValue)}</p>
          <p className="mt-1 text-xs text-muted">{projects.length} Proyek Tercatat</p>
        </div>

        <div
          onClick={() => {
            setKpiModal("invoiced")
            setKpiSearch("")
          }}
          className="group cursor-pointer rounded-xl border border-line border-l-4 border-l-blue-500 bg-white p-4 shadow-panel transition-all duration-150 hover:-translate-y-1 hover:shadow-lg hover:border-blue-300"
          title="Klik untuk melihat rincian seluruh invoice termin penagihan"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Telah Ditagihkan (DPP)</p>
            <span className="text-[10px] font-semibold text-blue-600 opacity-80 group-hover:opacity-100 transition-opacity">
              Rincian &rarr;
            </span>
          </div>
          <p className="mt-1.5 text-2xl font-bold text-blue-700">{rupiah(totalInvoicedValue)}</p>
          <p className="mt-1 text-xs text-muted">
            {totalContractValue > 0
              ? `${((totalInvoicedValue / totalContractValue) * 100).toFixed(1)}% dari total kontrak`
              : "0%"}
          </p>
        </div>

        <div
          onClick={() => {
            setKpiModal("paid")
            setKpiSearch("")
          }}
          className="group cursor-pointer rounded-xl border border-line border-l-4 border-l-emerald-500 bg-white p-4 shadow-panel transition-all duration-150 hover:-translate-y-1 hover:shadow-lg hover:border-emerald-300"
          title="Klik untuk melihat rincian kas masuk & kuitansi resmi"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Kas Masuk (Lunas)</p>
            <span className="text-[10px] font-semibold text-emerald-600 opacity-80 group-hover:opacity-100 transition-opacity">
              Rincian &rarr;
            </span>
          </div>
          <p className="mt-1.5 text-2xl font-bold text-emerald-700">{rupiah(totalPaidValue)}</p>
          <p className="mt-1 text-xs text-muted">Kuitansi resmi diterbitkan</p>
        </div>

        <div
          onClick={() => {
            setKpiModal("receivable")
            setKpiSearch("")
          }}
          className="group cursor-pointer rounded-xl border border-line border-l-4 border-l-amber-500 bg-white p-4 shadow-panel transition-all duration-150 hover:-translate-y-1 hover:shadow-lg hover:border-amber-300"
          title="Klik untuk melihat rincian piutang usaha berjalan yang belum lunas"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Sisa Piutang Berjalan (AR)</p>
            <span className="text-[10px] font-semibold text-amber-700 opacity-80 group-hover:opacity-100 transition-opacity">
              Rincian &rarr;
            </span>
          </div>
          <p className="mt-1.5 text-2xl font-bold text-amber-700">{rupiah(Math.max(0, outstandingReceivable))}</p>
          <p className="mt-1 text-xs text-muted">Invoice terbit menunggu pelunasan</p>
        </div>
      </div>

      {/* KPI Drilldown Modal */}
      {kpiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl border border-line">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-line p-5">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  {kpiModal === "contract" && "Rincian Nilai Kontrak Seluruh Proyek SPK"}
                  {kpiModal === "invoiced" && "Rincian Invoice Penagihan (DPP Telah Ditagihkan)"}
                  {kpiModal === "paid" && "Rincian Pembayaran Lunas & Kas Masuk"}
                  {kpiModal === "receivable" && "Rincian Sisa Piutang Berjalan (Invoice Belum Lunas)"}
                </h3>
                <p className="mt-1 text-xs text-muted max-w-xl">
                  {kpiModal === "contract" && "Daftar seluruh proyek dengan SPK aktif beserta nilai kontrak yang telah disepakati."}
                  {kpiModal === "invoiced" && "Daftar invoice resmi yang telah diterbitkan untuk penagihan termin kepada klien."}
                  {kpiModal === "paid" && "Daftar penerimaan dana pembayaran termin dan kuitansi pelunasan resmi."}
                  {kpiModal === "receivable" && "Daftar invoice yang masih berstatus belum lunas (menunggu pembayaran dari klien)."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setKpiModal(null)}
                className="rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-ink transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Search Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-slate-50/80 p-4">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-2.5 size-4 text-muted" />
                <input
                  type="text"
                  placeholder="Cari nomor dokumen, nama proyek, atau klien..."
                  value={kpiSearch}
                  onChange={(e) => setKpiSearch(e.target.value)}
                  className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-4 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="text-xs font-semibold text-slate-800">
                {kpiModal === "contract" && `Total Kontrak: ${rupiah(filteredProjectsForKpi.reduce((s, p) => s + Number(p.contract_amount || 0), 0))}`}
                {kpiModal === "invoiced" && `Total Tagihan: ${rupiah(filteredInvoicesForKpi.reduce((s, inv) => s + Number(inv.amount || 0), 0))}`}
                {kpiModal === "paid" && `Total Masuk: ${rupiah(filteredPaidForKpi.reduce((s, inv) => s + Number(inv.paid_amount || inv.net_receivable || 0), 0))}`}
                {kpiModal === "receivable" && `Total Piutang: ${rupiah(filteredUnpaidForKpi.reduce((s, inv) => s + Number(inv.net_receivable || 0), 0))}`}
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {kpiModal === "contract" && (
                <div className="rounded-xl border border-line overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-canvas text-muted">
                      <tr>
                        <th className="p-3 font-semibold">Kode Proyek</th>
                        <th className="p-3 font-semibold">Nama Proyek</th>
                        <th className="p-3 font-semibold">Klien / Mitra</th>
                        <th className="p-3 font-semibold">Cabang</th>
                        <th className="p-3 font-semibold">Status</th>
                        <th className="p-3 text-right font-semibold">Nilai Kontrak SPK</th>
                        <th className="p-3 text-center font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filteredProjectsForKpi.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-medium text-brand">{p.code}</td>
                          <td className="p-3 font-medium text-ink">{p.name}</td>
                          <td className="p-3 text-muted">{p.client_name}</td>
                          <td className="p-3 text-muted">{p.branch_name}</td>
                          <td className="p-3">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                              {p.status}
                            </span>
                          </td>
                          <td className="p-3 text-right font-bold text-ink">{rupiah(p.contract_amount)}</td>
                          <td className="p-3 text-center">
                            <a
                              href={`/proyek/${p.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-brand hover:bg-brand hover:text-white transition-colors"
                            >
                              Detail <ExternalLink className="size-3" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {kpiModal === "invoiced" && (
                <div className="rounded-xl border border-line overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-canvas text-muted">
                      <tr>
                        <th className="p-3 font-semibold">No. Invoice</th>
                        <th className="p-3 font-semibold">Tanggal</th>
                        <th className="p-3 font-semibold">Proyek & Klien</th>
                        <th className="p-3 font-semibold">Termin</th>
                        <th className="p-3 text-right font-semibold">DPP (Rp)</th>
                        <th className="p-3 text-right font-semibold">Total Tagihan (Rp)</th>
                        <th className="p-3 font-semibold">Status</th>
                        <th className="p-3 text-center font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filteredInvoicesForKpi.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-900">{inv.invoice_number}</td>
                          <td className="p-3 text-muted">{formatDate(inv.invoice_date)}</td>
                          <td className="p-3">
                            <div className="font-medium text-ink">{inv.project.name}</div>
                            <div className="text-[10px] text-muted">{inv.project.client_name}</div>
                          </td>
                          <td className="p-3 text-muted">{inv.term_name}</td>
                          <td className="p-3 text-right font-medium">{rupiah(inv.amount)}</td>
                          <td className="p-3 text-right font-bold text-brand">{rupiah(inv.total_amount)}</td>
                          <td className="p-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              inv.status === "paid"
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-amber-50 text-amber-800"
                            }`}>
                              {inv.status === "paid" ? "Lunas" : "Belum Lunas"}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setViewDocument({ type: "invoice", data: inv, project: inv.project })
                                setKpiModal(null)
                              }}
                              className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-brand hover:bg-brand hover:text-white transition-colors"
                            >
                              Lihat
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {kpiModal === "paid" && (
                <div className="rounded-xl border border-line overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-canvas text-muted">
                      <tr>
                        <th className="p-3 font-semibold">No. Kuitansi</th>
                        <th className="p-3 font-semibold">Tgl Lunas</th>
                        <th className="p-3 font-semibold">No. Invoice Ref</th>
                        <th className="p-3 font-semibold">Proyek & Klien</th>
                        <th className="p-3 font-semibold">Metode / Bank</th>
                        <th className="p-3 text-right font-semibold">Jumlah Dana Diterima</th>
                        <th className="p-3 text-center font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filteredPaidForKpi.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-emerald-700">{inv.receipt_number || "KWT/..."}</td>
                          <td className="p-3 text-muted">{formatDate(inv.paid_at)}</td>
                          <td className="p-3 font-mono text-muted">{inv.invoice_number}</td>
                          <td className="p-3">
                            <div className="font-medium text-ink">{inv.project.name}</div>
                            <div className="text-[10px] text-muted">{inv.project.client_name}</div>
                          </td>
                          <td className="p-3 text-muted">{inv.bank_name || inv.payment_method || "Transfer Bank"}</td>
                          <td className="p-3 text-right font-bold text-emerald-700">
                            {rupiah(inv.paid_amount || inv.net_receivable)}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setViewDocument({ type: "receipt", data: inv, project: inv.project })
                                setKpiModal(null)
                              }}
                              className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors"
                            >
                              Kuitansi
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {kpiModal === "receivable" && (
                <div className="rounded-xl border border-line overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-canvas text-muted">
                      <tr>
                        <th className="p-3 font-semibold">No. Invoice</th>
                        <th className="p-3 font-semibold">Jatuh Tempo</th>
                        <th className="p-3 font-semibold">Proyek & Klien</th>
                        <th className="p-3 font-semibold">Termin</th>
                        <th className="p-3 text-right font-semibold">Sisa Piutang (Rp)</th>
                        <th className="p-3 text-center font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filteredUnpaidForKpi.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-900">{inv.invoice_number}</td>
                          <td className="p-3 text-muted">{formatDate(inv.due_date)}</td>
                          <td className="p-3">
                            <div className="font-medium text-ink">{inv.project.name}</div>
                            <div className="text-[10px] text-muted">{inv.project.client_name}</div>
                          </td>
                          <td className="p-3 text-muted">{inv.term_name}</td>
                          <td className="p-3 text-right font-bold text-amber-700">{rupiah(inv.net_receivable)}</td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setViewDocument({ type: "invoice", data: inv, project: inv.project })
                                setKpiModal(null)
                              }}
                              className="inline-flex items-center gap-1 rounded bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-600 hover:text-white transition-colors"
                            >
                              Periksa Invoice
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-line bg-slate-50 p-4 text-xs text-muted">
              <span>
                {kpiModal === "contract" && `Menampilkan ${filteredProjectsForKpi.length} dari ${projects.length} proyek SPK`}
                {kpiModal === "invoiced" && `Menampilkan ${filteredInvoicesForKpi.length} dari ${allInvoices.length} invoice`}
                {kpiModal === "paid" && `Menampilkan ${filteredPaidForKpi.length} dari ${paidInvoices.length} pembayaran lunas`}
                {kpiModal === "receivable" && `Menampilkan ${filteredUnpaidForKpi.length} dari ${unpaidInvoices.length} piutang belum lunas`}
              </span>
              <button
                type="button"
                onClick={() => setKpiModal(null)}
                className="rounded-lg border border-line bg-white px-4 py-1.5 text-xs font-semibold text-ink hover:bg-slate-100 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Control Bar: Filter Tabs & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div className="flex gap-2 border-b border-line sm:border-0 pb-2 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterTab("actionable")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition ${
              filterTab === "actionable" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <Clock className="size-4" />
            <span>⚡ Perlu Diproses / Belum Lunas</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("paid")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition ${
              filterTab === "paid" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <CheckCircle2 className="size-4 text-emerald-600" />
            <span>✓ Riwayat Pembayaran Lunas</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("all")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition ${
              filterTab === "all" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <span>📋 Semua Proyek ({projects.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 size-4 text-muted" />
          <input
            type="text"
            placeholder="Cari proyek, SPK, klien..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-4 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      {/* Daftar Proyek & Jadwal Termin */}
      <div className="space-y-6">
        {filteredProjects.map((project) => {
          const totalInvoiced = project.invoices
            .filter((i) => i.status !== "cancelled")
            .reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
          const totalPaid = project.invoices
            .filter((i) => i.status === "paid")
            .reduce((acc, curr) => acc + Number(curr.paid_amount || curr.net_receivable || 0), 0)

          const progressPercent =
            project.contract_amount > 0
              ? Math.min(100, Math.round((totalPaid / project.contract_amount) * 100))
              : 0

          return (
            <Card key={project.id} className="p-5 border-line space-y-4">
              {/* Project Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                      Cabang {project.branch_name}
                    </span>
                    <span className="text-xs font-mono text-muted">{project.code}</span>
                  </div>
                  <h3 className="mt-1 text-base font-bold text-ink">{project.name}</h3>
                  <p className="text-xs text-muted">Klien: {project.client_name}</p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-muted">Nilai Kontrak (SPK)</p>
                  <p className="text-lg font-bold text-brand">{rupiah(project.contract_amount)}</p>
                  <div className="mt-1 flex items-center gap-2 justify-end text-xs text-muted">
                    <span>Kas Masuk: {rupiah(totalPaid)}</span>
                    <span className="font-semibold text-emerald-600">({progressPercent}% Lunas)</span>
                  </div>
                </div>
              </div>

              {/* Progress Bar Pelunasan */}
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Table / List of Milestones & Invoices */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Rencana Termin & Tagihan Proyek
                </h4>

                {project.payment_terms.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-4 text-center">
                    <p className="text-xs text-amber-900">
                      Rencana termin pembayaran belum ditentukan pada perencanaan proyek ini.
                    </p>
                    <Link
                      href={`/proyek/${project.id}`}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
                    >
                      Buka Perencanaan Proyek untuk Melengkapi Jadwal Termin →
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {project.payment_terms.map((term, idx) => {
                      // Cek apakah invoice sudah terbit untuk termin ini
                      const matchingInvoice = project.invoices.find(
                        (inv) => inv.term_index === term.index || inv.term_name === term.name
                      )
                      const isPaid = matchingInvoice?.status === "paid" || term.status === "paid"
                      const isInvoiced = Boolean(matchingInvoice) || term.status === "invoiced"

                      return (
                        <div
                          key={term.id || idx}
                          className={`flex flex-col justify-between rounded-xl border p-3.5 text-xs transition ${
                            isPaid
                              ? "border-emerald-200 bg-emerald-50/40"
                              : isInvoiced
                              ? "border-blue-200 bg-blue-50/40"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-ink">{term.name}</span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  isPaid
                                    ? "bg-emerald-100 text-emerald-800"
                                    : isInvoiced
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {isPaid ? "✓ Lunas" : isInvoiced ? "⚡ Invoice Terbit" : "Rencana"}
                              </span>
                            </div>

                            <p className="text-sm font-extrabold text-ink">
                              {rupiah(term.amount)}{" "}
                              <span className="text-[11px] font-normal text-muted">({term.percentage}%)</span>
                            </p>

                            <p className="text-[11px] text-muted italic">Pemicu: {term.trigger || "Sesuai SPK"}</p>

                            {matchingInvoice && (
                              <div className="mt-2 rounded-lg bg-white/80 border border-line/60 p-2 space-y-1 font-mono text-[11px]">
                                <p className="font-semibold text-blue-900">{matchingInvoice.invoice_number}</p>
                                <p className="text-[10px] text-muted">
                                  Tgl: {formatDate(matchingInvoice.invoice_date)} · Jatuh Tempo:{" "}
                                  {formatDate(matchingInvoice.due_date)}
                                </p>
                                {matchingInvoice.receipt_number && (
                                  <p className="font-semibold text-emerald-800">
                                    KWT: {matchingInvoice.receipt_number}
                                  </p>
                                )}
                                {matchingInvoice.invoice_journal_number && (
                                  <div className="flex items-center justify-between text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200/60 rounded px-1.5 py-0.5">
                                    <span>Jurnal Piutang:</span>
                                    <span className="font-bold">{matchingInvoice.invoice_journal_number}</span>
                                  </div>
                                )}
                                {matchingInvoice.payment_journal_number && (
                                  <div className="flex items-center justify-between text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200/60 rounded px-1.5 py-0.5">
                                    <span>Jurnal Kas/PPh:</span>
                                    <span className="font-bold">{matchingInvoice.payment_journal_number}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5">
                            {isPaid && matchingInvoice ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  setViewDocument({
                                    type: "receipt",
                                    data: matchingInvoice,
                                    project,
                                  })
                                }
                                className="w-full gap-1.5 text-[11px] border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-100"
                              >
                                <Receipt className="size-3.5 text-emerald-600" /> Lihat Kuitansi Resmi
                              </Button>
                            ) : isInvoiced && matchingInvoice ? (
                              <div className="flex w-full gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    setViewDocument({
                                      type: "invoice",
                                      data: matchingInvoice,
                                      project,
                                    })
                                  }
                                  className="flex-1 text-[11px] border-blue-200 bg-white text-blue-800"
                                >
                                  <Eye className="size-3 text-blue-600" /> Invoice
                                </Button>
                                {!disabled && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                      setSelectedInvoiceForPayment({
                                        project,
                                        invoice: matchingInvoice,
                                      })
                                    }
                                    className="flex-1 gap-1 text-[11px] bg-emerald-600 text-white hover:bg-emerald-700"
                                  >
                                    <CreditCard className="size-3" /> Catat Bayar
                                  </Button>
                                )}
                              </div>
                            ) : (
                              !disabled && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => setSelectedTermForInvoice({ project, term })}
                                  className="w-full gap-1 text-[11px] bg-brand text-white hover:bg-brand/90"
                                >
                                  <Send className="size-3" /> Terbitkan Invoice
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </Card>
          )
        })}

        {filteredProjects.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted">
            Tidak ada proyek atau invoice yang sesuai dengan kriteria pencarian.
          </Card>
        )}
      </div>

      {/* MODAL 1: Terbitkan Invoice Resmi */}
      {selectedTermForInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <p className="text-xs font-semibold text-brand uppercase tracking-wider">Penerbitan Invoice Penjualan</p>
                <h3 className="text-base font-bold text-ink">
                  {selectedTermForInvoice.term.name} ({selectedTermForInvoice.term.percentage}%)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTermForInvoice(null)}
                className="text-muted hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 space-y-1 text-xs">
              <p>
                <strong>Proyek:</strong> {selectedTermForInvoice.project.code} · {selectedTermForInvoice.project.name}
              </p>
              <p>
                <strong>Klien:</strong> {selectedTermForInvoice.project.client_name}
              </p>
              <p>
                <strong>Cabang:</strong> {selectedTermForInvoice.project.branch_name}
              </p>
            </div>

            {/* Perhitungan Pajak Otomatis */}
            {(() => {
              const dpp = Number(selectedTermForInvoice.term.amount || 0)
              const ppn = Math.round(dpp * 0.11)
              const pph23 = Math.round(dpp * 0.02)
              const totalTagihan = dpp + ppn
              const netKasMasuk = totalTagihan - pph23

              return (
                <form action={createSalesInvoiceAction} className="space-y-4">
                  <input type="hidden" name="project_id" value={selectedTermForInvoice.project.id} />
                  <input type="hidden" name="term_index" value={selectedTermForInvoice.term.index} />
                  <input type="hidden" name="term_name" value={selectedTermForInvoice.term.name} />
                  <input type="hidden" name="percentage" value={selectedTermForInvoice.term.percentage} />
                  <input type="hidden" name="amount" value={dpp} />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Tanggal Invoice
                      <input
                        type="date"
                        name="invoice_date"
                        defaultValue={new Date().toISOString().slice(0, 10)}
                        required
                        className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs"
                      />
                    </label>
                    <label className="block text-xs font-medium text-slate-700">
                      Jatuh Tempo Pembayaran
                      <input
                        type="date"
                        name="due_date"
                        defaultValue={
                          new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
                        }
                        required
                        className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs"
                      />
                    </label>
                  </div>

                  {/* Ringkasan Kalkulasi Pajak */}
                  <div className="rounded-xl border border-line bg-slate-50/80 p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted">Dasar Pengenaan Pajak (DPP):</span>
                      <span className="font-semibold text-ink">{rupiah(dpp)}</span>
                    </div>
                    <div className="flex justify-between text-blue-900">
                      <span>PPN (11%):</span>
                      <span className="font-semibold">{rupiah(ppn)}</span>
                    </div>
                    <div className="flex justify-between border-t border-line pt-1 font-bold text-ink">
                      <span>Total Tagihan (Invoice Klien):</span>
                      <span>{rupiah(totalTagihan)}</span>
                    </div>
                    <div className="flex justify-between text-amber-800 text-[11px] pt-1 border-t border-dashed border-line">
                      <span>Estimasi Bukti Potong PPh 23 (2%):</span>
                      <span>- {rupiah(pph23)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-800">
                      <span>Estimasi Bersih Kas Diterima:</span>
                      <span>{rupiah(netKasMasuk)}</span>
                    </div>
                  </div>

                  <label className="block text-xs font-medium text-slate-700">
                    Catatan / Instruksi Pembayaran (Rekening Bank)
                    <textarea
                      name="notes"
                      rows={3}
                      defaultValue={`Mohon pembayaran ditransfer ke rekening PT. Global Solusi Prima:\nBank Mandiri No. Rek: 123-00-9876543-2\nBukti transfer & Bukti Potong PPh 23 mohon dikonfirmasi melalui portal klien.`}
                      className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs"
                    />
                  </label>

                  <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setSelectedTermForInvoice(null)}
                      className="text-xs"
                    >
                      Batal
                    </Button>
                    <Button type="submit" className="gap-2 bg-brand text-white text-xs">
                      <Send className="size-3.5" /> Terbitkan & Kirim ke Portal Klien
                    </Button>
                  </div>
                </form>
              )
            })()}
          </div>
        </div>
      )}

      {/* MODAL 2: Catat Pembayaran & Terbitkan Kuitansi */}
      {selectedInvoiceForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                  Catat Penerimaan Pembayaran & Kuitansi
                </p>
                <h3 className="text-base font-bold text-ink">
                  {selectedInvoiceForPayment.invoice.invoice_number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoiceForPayment(null)}
                className="text-muted hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 space-y-1 text-xs">
              <p>
                <strong>Proyek:</strong> {selectedInvoiceForPayment.project.name}
              </p>
              <p>
                <strong>Termin:</strong> {selectedInvoiceForPayment.invoice.term_name}
              </p>
              <p>
                <strong>Total Tagihan:</strong> {rupiah(selectedInvoiceForPayment.invoice.total_amount)}
              </p>
              <p>
                <strong>Estimasi Bersih Diterima:</strong>{" "}
                {rupiah(selectedInvoiceForPayment.invoice.net_receivable)}
              </p>
            </div>

            <form action={recordInvoicePaymentAction} className="space-y-4">
              <input type="hidden" name="invoice_id" value={selectedInvoiceForPayment.invoice.id} />
              <input type="hidden" name="project_id" value={selectedInvoiceForPayment.project.id} />

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-slate-700">
                  Tanggal Dana Masuk
                  <input
                    type="date"
                    name="paid_at"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  Metode Pembayaran
                  <select
                    name="payment_method"
                    defaultValue="bank_transfer"
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs"
                  >
                    <option value="bank_transfer">Transfer Bank</option>
                    <option value="giro">Bilyet Giro / Cek</option>
                    <option value="cash">Kas Tunai</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-slate-700">
                  Bank Penerima
                  <input
                    name="bank_name"
                    required
                    defaultValue="Bank Mandiri"
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  Nomor Referensi Bank / Mutasi
                  <input
                    name="bank_reference"
                    required
                    placeholder="e.g. TRF/MDR/20261109012"
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-slate-700">
                  Nominal Riil Dana Masuk (Rp)
                  <MoneyInput
                    name="paid_amount"
                    defaultValue={selectedInvoiceForPayment.invoice.net_receivable}
                    min="0"
                    required
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs font-bold"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  Nomor Bukti Potong PPh 23 (Jika Ada)
                  <input
                    name="wht_proof_number"
                    placeholder="e.g. BP/PPh23/2026/00192"
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs"
                  />
                </label>
              </div>

              <label className="block text-xs font-medium text-slate-700">
                Catatan Verifikasi Keuangan
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Catatan rekening koran atau rekonsiliasi kas masuk..."
                  className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs"
                />
              </label>

              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-950 flex items-start gap-2">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>
                  Sistem akan otomatis menerbitkan <strong>Kuitansi Resmi (KWT/GSP-...)</strong> dan menandai status
                  termin menjadi <strong>Lunas</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSelectedInvoiceForPayment(null)}
                  className="text-xs"
                >
                  Batal
                </Button>
                <Button type="submit" className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 text-xs">
                  <Receipt className="size-3.5" /> Simpan & Terbitkan Kuitansi
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Pratinjau Dokumen Resmi Standar PT. GSP (PDF Kop Surat, Stempel, & QR Code) */}
      {viewDocument && (
        <DocumentPrintModal
          isOpen={Boolean(viewDocument)}
          onClose={() => setViewDocument(null)}
          title={viewDocument.type === "invoice" ? "Dokumen Resmi: Invoice Penagihan" : "Dokumen Resmi: Kuitansi Pembayaran"}
          documentNumber={
            viewDocument.type === "invoice"
              ? viewDocument.data.invoice_number
              : viewDocument.data.receipt_number || `KWT-${viewDocument.data.invoice_number?.replace("INV/", "")}`
          }
        >
          <div className="space-y-6">
            {viewDocument.type === "invoice" ? (
              <PrintableInvoiceDocument
                invoice={{
                  id: viewDocument.data.id,
                  invoice_number: viewDocument.data.invoice_number,
                  invoice_date: viewDocument.data.invoice_date,
                  due_date: viewDocument.data.due_date,
                  term_name: viewDocument.data.term_name,
                  percentage: viewDocument.data.percentage,
                  amount: viewDocument.data.amount,
                  vat_amount: viewDocument.data.vat_amount,
                  wht_amount: viewDocument.data.wht_amount,
                  total_amount: viewDocument.data.total_amount,
                  net_receivable: viewDocument.data.net_receivable,
                  notes: viewDocument.data.notes,
                  invoice_journal_number: viewDocument.data.invoice_journal_number,
                }}
                project={{
                  code: viewDocument.project.code,
                  name: viewDocument.project.name,
                  client_name: viewDocument.project.client_name,
                  branch_name: viewDocument.project.branch_name,
                }}
              />
            ) : (
              <PrintableReceiptDocument
                receipt={{
                  receipt_number: viewDocument.data.receipt_number || `KWT-${viewDocument.data.invoice_number?.replace("INV/", "")}`,
                  invoice_number: viewDocument.data.invoice_number,
                  paid_at: viewDocument.data.paid_at,
                  paid_amount: viewDocument.data.paid_amount || viewDocument.data.net_receivable,
                  payment_method: viewDocument.data.payment_method,
                  bank_name: viewDocument.data.bank_name,
                  bank_reference: viewDocument.data.bank_reference,
                  term_name: viewDocument.data.term_name,
                  notes: viewDocument.data.notes,
                  payment_journal_number: viewDocument.data.payment_journal_number,
                }}
                project={{
                  code: viewDocument.project.code,
                  name: viewDocument.project.name,
                  client_name: viewDocument.project.client_name,
                  branch_name: viewDocument.project.branch_name,
                }}
              />
            )}

            {/* Posting Jurnal Akuntansi Otomatis (Terekam di ERP, tersembunyi saat cetak fisik) */}
            <div className="max-w-[210mm] mx-auto rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 space-y-2 text-xs print:hidden shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <Banknote className="size-4 text-indigo-600" />
                  Posting Jurnal Akuntansi Otomatis (Sistem ERP PT. Global Solusi Prima)
                </span>
                <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded border border-indigo-200">
                  {viewDocument.type === "invoice"
                    ? viewDocument.data.invoice_journal_number || "JRN/INV/AUTO"
                    : viewDocument.data.payment_journal_number || "JRN/KWT/AUTO"} · Posted
                </span>
              </div>
              <p className="text-[11px] text-indigo-900/80">
                Dokumen ini telah membukukan jurnal akuntansi otomatis pada buku besar perusahaan:
              </p>
              <div className="space-y-1 font-mono text-[11px] bg-white rounded-lg p-3 border border-indigo-100">
                {viewDocument.type === "invoice" ? (
                  <>
                    <div className="flex justify-between text-indigo-900">
                      <span>[D] 1121 - Piutang Usaha Klien ({viewDocument.project.client_name})</span>
                      <span className="font-semibold">{rupiah(viewDocument.data.total_amount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-700 pl-4">
                      <span>[K] 4111 - Pendapatan Jasa Konsultansi & Proyek</span>
                      <span className="font-semibold">{rupiah(viewDocument.data.amount)}</span>
                    </div>
                    {viewDocument.data.vat_amount > 0 && (
                      <div className="flex justify-between text-slate-700 pl-4">
                        <span>[K] 2121 - Utang PPN Keluaran (11%)</span>
                        <span className="font-semibold">{rupiah(viewDocument.data.vat_amount)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-emerald-900">
                      <span>[D] 1102 - Kas & Bank Operasional ({viewDocument.data.bank_name || "Bank"})</span>
                      <span className="font-semibold">
                        {rupiah(viewDocument.data.paid_amount || viewDocument.data.net_receivable)}
                      </span>
                    </div>
                    {viewDocument.data.wht_amount > 0 && (
                      <div className="flex justify-between text-amber-900">
                        <span>
                          [D] 1192 - Uang Muka PPh Pasal 23 (2%)
                          {viewDocument.data.wht_proof_number ? ` [Bupot: ${viewDocument.data.wht_proof_number}]` : ""}
                        </span>
                        <span className="font-semibold">{rupiah(viewDocument.data.wht_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-700 pl-4">
                      <span>[K] 1121 - Piutang Usaha Klien ({viewDocument.project.client_name})</span>
                      <span className="font-semibold">
                        {rupiah(
                          (viewDocument.data.paid_amount || viewDocument.data.net_receivable) +
                            (viewDocument.data.wht_amount || 0)
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </DocumentPrintModal>
      )}
    </div>
  )
}
