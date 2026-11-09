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
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SalesMenu } from "@/components/sales/sales-menu"
import { createSalesInvoiceAction, recordInvoicePaymentAction } from "@/app/(workspace)/pengajuan/penjualan/actions"

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
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border-l-4 border-l-brand">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Nilai Kontrak SPK</p>
          <p className="mt-1.5 text-2xl font-bold text-ink">{rupiah(totalContractValue)}</p>
          <p className="mt-1 text-xs text-muted">{projects.length} Proyek Tercatat</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Telah Ditagihkan (DPP)</p>
          <p className="mt-1.5 text-2xl font-bold text-blue-700">{rupiah(totalInvoicedValue)}</p>
          <p className="mt-1 text-xs text-muted">
            {totalContractValue > 0
              ? `${((totalInvoicedValue / totalContractValue) * 100).toFixed(1)}% dari total kontrak`
              : "0%"}
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Kas Masuk (Lunas)</p>
          <p className="mt-1.5 text-2xl font-bold text-emerald-700">{rupiah(totalPaidValue)}</p>
          <p className="mt-1 text-xs text-muted">Kuitansi resmi diterbitkan</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Sisa Piutang Berjalan (AR)</p>
          <p className="mt-1.5 text-2xl font-bold text-amber-700">{rupiah(Math.max(0, outstandingReceivable))}</p>
          <p className="mt-1 text-xs text-muted">Invoice terbit menunggu pelunasan</p>
        </Card>
      </div>

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
                  <input
                    type="number"
                    name="paid_amount"
                    defaultValue={selectedInvoiceForPayment.invoice.net_receivable}
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

      {/* MODAL 3: Pratinjau Dokumen Resmi (Invoice atau Kuitansi) */}
      {viewDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-2xl space-y-6 max-h-[95vh] overflow-y-auto">
            {/* Header Dokumen */}
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand">PT. GLOBAL SOLUSI PRIMA</p>
                <h2 className="mt-1 text-2xl font-black text-ink">
                  {viewDocument.type === "invoice" ? "FAKTUR / INVOICE PENJUALAN" : "KUITANSI PEMBAYARAN RESMI"}
                </h2>
                <p className="font-mono text-sm font-semibold text-slate-700 mt-1">
                  {viewDocument.type === "invoice"
                    ? viewDocument.data.invoice_number
                    : viewDocument.data.receipt_number || "KWT/GSP/OFFICIAL"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewDocument(null)}
                className="rounded-lg border border-line px-3 py-1 text-xs font-semibold hover:bg-slate-100"
              >
                Tutup ✕
              </button>
            </div>

            {/* Info Klien & Proyek */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <p className="text-muted uppercase tracking-wider text-[10px] font-bold">Ditagihkan Kepada:</p>
                <p className="font-bold text-ink text-sm">{viewDocument.project.client_name}</p>
                <p className="text-muted">Proyek: {viewDocument.project.name}</p>
                <p className="font-mono text-muted">{viewDocument.project.code}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-muted uppercase tracking-wider text-[10px] font-bold">Tanggal Dokumen:</p>
                <p className="font-bold text-ink">
                  {formatDate(viewDocument.data.paid_at || viewDocument.data.invoice_date)}
                </p>
                {viewDocument.type === "invoice" && (
                  <p className="text-amber-800">Jatuh Tempo: {formatDate(viewDocument.data.due_date)}</p>
                )}
                <p className="text-muted">Cabang: {viewDocument.project.branch_name}</p>
              </div>
            </div>

            {/* Rincian Finansial */}
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-muted border-b border-line">
                  <tr>
                    <th className="py-2.5 px-4 text-left font-semibold">Deskripsi Tagihan / Termin</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Bobot</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Jumlah (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  <tr>
                    <td className="py-3 px-4 font-semibold text-ink">
                      {viewDocument.data.term_name}
                      <p className="text-[11px] font-normal text-muted mt-0.5">
                        Pekerjaan sesuai SPK No. {viewDocument.project.code}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right">{viewDocument.data.percentage}%</td>
                    <td className="py-3 px-4 text-right font-bold">{rupiah(viewDocument.data.amount)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="bg-slate-50/70 p-4 space-y-2 text-xs border-t border-line">
                <div className="flex justify-between">
                  <span className="text-muted">Dasar Pengenaan Pajak (DPP):</span>
                  <span className="font-semibold">{rupiah(viewDocument.data.amount)}</span>
                </div>
                <div className="flex justify-between text-blue-900">
                  <span>PPN (11%):</span>
                  <span className="font-semibold">{rupiah(viewDocument.data.vat_amount)}</span>
                </div>
                <div className="flex justify-between font-bold text-ink border-t border-line pt-2 text-sm">
                  <span>Total Tagihan:</span>
                  <span>{rupiah(viewDocument.data.total_amount)}</span>
                </div>
                {viewDocument.data.wht_amount > 0 && (
                  <div className="flex justify-between text-amber-800 text-[11px]">
                    <span>Potongan PPh 23 (2%):</span>
                    <span>- {rupiah(viewDocument.data.wht_amount)}</span>
                  </div>
                )}
                {viewDocument.type === "receipt" && (
                  <div className="flex justify-between font-extrabold text-emerald-800 border-t border-emerald-200 pt-2 text-base">
                    <span>Jumlah Dana Diterima:</span>
                    <span>{rupiah(viewDocument.data.paid_amount || viewDocument.data.net_receivable)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Posting Jurnal Akuntansi Otomatis */}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <Banknote className="size-3.5 text-indigo-600" />
                  Posting Jurnal Akuntansi (Otomatis ERP)
                </span>
                <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                  {viewDocument.type === "invoice"
                    ? viewDocument.data.invoice_journal_number || "JRN/INV/AUTO"
                    : viewDocument.data.payment_journal_number || "JRN/KWT/AUTO"} · Posted
                </span>
              </div>
              <div className="space-y-1 font-mono text-[11px] bg-white rounded-lg p-2.5 border border-indigo-100">
                {viewDocument.type === "invoice" ? (
                  <>
                    <div className="flex justify-between text-indigo-900">
                      <span>[D] 1121 - Piutang Klien ({viewDocument.project.client_name})</span>
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
                      <span>[D] 1102 - Bank Operasional</span>
                      <span className="font-semibold">
                        {rupiah(viewDocument.data.paid_amount || viewDocument.data.net_receivable)}
                      </span>
                    </div>
                    {viewDocument.data.wht_amount > 0 && (
                      <div className="flex justify-between text-amber-900">
                        <span>
                          [D] 1192 - Pajak Dibayar di Muka (PPh 23)
                          {viewDocument.data.wht_proof_number ? ` [Bupot: ${viewDocument.data.wht_proof_number}]` : ""}
                        </span>
                        <span className="font-semibold">{rupiah(viewDocument.data.wht_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-700 pl-4">
                      <span>[K] 1121 - Piutang Klien ({viewDocument.project.client_name})</span>
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

            {/* Footer Dokumen & Tanda Tangan Resmi */}
            <div className="flex items-end justify-between border-t border-line pt-4 text-xs text-muted">
              <div>
                <p className="font-semibold text-ink">PT. Global Solusi Prima</p>
                <p className="text-[11px]">Sistem Informasi Manajemen Keuangan & Proyek</p>
                <p className="text-[10px] italic mt-1 text-slate-400">
                  Dokumen ini diterbitkan secara otomatis dan sah melalui ERP GSP.
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-muted mb-8">Bagian Keuangan & Penagihan</p>
                <p className="font-bold text-ink underline">Finance & Billing Department</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => window.print()}
                className="gap-2 text-xs"
              >
                <Download className="size-3.5" /> Cetak / Unduh Dokumen Resmi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
