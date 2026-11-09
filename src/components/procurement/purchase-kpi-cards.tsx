"use client"

import { useState } from "react"
import {
  FileText,
  Clock,
  Wallet,
  Search,
  X,
  ExternalLink,
  Building2,
  Calendar,
} from "lucide-react"
import {
  type BusinessUnit,
  type ProcurementVendor,
  type PurchaseRequest,
  purchaseStatusLabels,
  rupiah,
  formatDateID,
} from "@/lib/procurement-ui"

interface PurchaseKpiCardsProps {
  rows: PurchaseRequest[]
  pending: PurchaseRequest[]
  pendingValue: number
  branches: BusinessUnit[]
  vendorRows: ProcurementVendor[]
}

export function PurchaseKpiCards({
  rows,
  pending,
  pendingValue,
  branches,
  vendorRows,
}: PurchaseKpiCardsProps) {
  const [activeModal, setActiveModal] = useState<"all" | "pending" | "unpaid" | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const unpaidList = rows.filter((r) => !["draft", "rejected", "paid"].includes(r.status))

  // Determine current dataset for active modal
  const currentList =
    activeModal === "all"
      ? rows
      : activeModal === "pending"
      ? pending
      : activeModal === "unpaid"
      ? unpaidList
      : []

  const modalTitle =
    activeModal === "all"
      ? "Daftar Seluruh Pengajuan Pembelian"
      : activeModal === "pending"
      ? "Pengajuan Dalam Pemeriksaan & Siap Bayar"
      : "Rincian Tagihan Rencana Bayar Belum Lunas"

  const modalDesc =
    activeModal === "all"
      ? "Seluruh dokumen pengadaan barang & jasa yang ada dalam cakupan akses Anda."
      : activeModal === "pending"
      ? "Pengajuan yang sedang menunggu verifikasi Manager Cabang, Direktur Keuangan, Accounting, atau siap dibayar Kasir."
      : "Daftar tagihan vendor yang telah disetujui dan menunggu realisasi pembayaran tunai / transfer bank."

  const q = searchQuery.toLowerCase().trim()
  const filteredList = currentList.filter((r) => {
    if (!q) return true
    const vName = (
      vendorRows.find((v) => v.id === r.vendor_id)?.name ??
      r.vendor_snapshot?.name ??
      ""
    ).toLowerCase()
    const inv = (r.invoice_number ?? "").toLowerCase()
    const reqNum = (r.request_number ?? "").toLowerCase()
    const branch = (branches.find((b) => b.id === r.branch_id)?.name ?? "").toLowerCase()
    return vName.includes(q) || inv.includes(q) || reqNum.includes(q) || branch.includes(q)
  })

  const totalFilteredAmount = filteredList.reduce(
    (sum, r) => sum + Number(r.payable_amount || 0),
    0
  )

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        {/* 1. Pengajuan Terlihat */}
        <div
          onClick={() => {
            setActiveModal("all")
            setSearchQuery("")
          }}
          className="group cursor-pointer rounded-xl border border-line bg-white p-5 shadow-panel transition-all duration-150 hover:-translate-y-1 hover:shadow-lg hover:border-slate-400"
          title="Klik untuk melihat rincian seluruh pengajuan pembelian"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted">Pengajuan terlihat</span>
            <FileText className="size-5 text-slate-400 group-hover:text-brand transition-colors" />
          </div>
          <p className="mt-2 text-2xl font-bold text-ink">{rows.length}</p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
            <span>Total dokumen pembelian</span>
            <span className="font-semibold text-brand opacity-80 group-hover:opacity-100 flex items-center gap-0.5">
              Lihat detail &rarr;
            </span>
          </div>
        </div>

        {/* 2. Dalam Pemeriksaan / Pembayaran */}
        <div
          onClick={() => {
            setActiveModal("pending")
            setSearchQuery("")
          }}
          className="group cursor-pointer rounded-xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-panel transition-all duration-150 hover:-translate-y-1 hover:shadow-lg hover:border-indigo-400 hover:bg-indigo-50/70"
          title="Klik untuk melihat dokumen yang butuh tindakan / pemeriksaan"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted">Dalam pemeriksaan / pembayaran</span>
            <Clock className="size-5 text-indigo-400 group-hover:scale-110 transition-transform" />
          </div>
          <p className="mt-2 text-2xl font-bold text-indigo-700">{pending.length}</p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
            <span>Menunggu verifikasi / bayar</span>
            <span className="font-semibold text-indigo-700 opacity-80 group-hover:opacity-100 flex items-center gap-0.5">
              Lihat antrean &rarr;
            </span>
          </div>
        </div>

        {/* 3. Rencana Bayar Belum Lunas */}
        <div
          onClick={() => {
            setActiveModal("unpaid")
            setSearchQuery("")
          }}
          className="group cursor-pointer rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-panel transition-all duration-150 hover:-translate-y-1 hover:shadow-lg hover:border-amber-400 hover:bg-amber-50/70"
          title="Klik untuk melihat rincian nominal tagihan belum dibayar"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted">Rencana bayar belum lunas</span>
            <Wallet className="size-5 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-800">{rupiah(pendingValue)}</p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
            <span>Kewajiban vendor aktif</span>
            <span className="font-semibold text-amber-800 opacity-80 group-hover:opacity-100 flex items-center gap-0.5">
              Rincian angka &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* Drilldown Modal Dialog */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl border border-line">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-line p-5">
              <div>
                <h3 className="text-lg font-bold text-ink">{modalTitle}</h3>
                <p className="mt-1 text-xs text-muted max-w-xl">{modalDesc}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-ink transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Toolbar: Search & Total Stats */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-slate-50/80 p-4">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-2.5 size-4 text-muted" />
                <input
                  type="text"
                  placeholder="Cari nomor invoice, vendor, cabang..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-4 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="text-muted">
                  Total Data: <strong className="text-ink">{filteredList.length}</strong>
                </span>
                <span className="rounded-md bg-white border border-line px-2.5 py-1 text-slate-800">
                  Total Nilai: <strong className="text-brand font-bold">{rupiah(totalFilteredAmount)}</strong>
                </span>
              </div>
            </div>

            {/* Modal Content Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredList.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted">
                  Tidak ditemukan dokumen yang sesuai dengan pencarian &quot;{searchQuery}&quot;.
                </div>
              ) : (
                <div className="rounded-xl border border-line overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-canvas text-muted">
                      <tr>
                        <th className="p-3 font-semibold">No. Invoice / Permintaan</th>
                        <th className="p-3 font-semibold">Tanggal</th>
                        <th className="p-3 font-semibold">Vendor</th>
                        <th className="p-3 font-semibold">Cabang</th>
                        <th className="p-3 font-semibold">Status</th>
                        <th className="p-3 text-right font-semibold">Nominal (Rp)</th>
                        <th className="p-3 text-center font-semibold">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filteredList.map((r) => {
                        const vendorName =
                          vendorRows.find((v) => v.id === r.vendor_id)?.name ??
                          r.vendor_snapshot?.name ??
                          "Vendor"
                        const branchName =
                          branches.find((b) => b.id === r.branch_id)?.name ?? "Cabang"
                        const statusLabel = purchaseStatusLabels[r.status] ?? r.status

                        return (
                          <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-medium text-slate-900">
                              <div>{r.invoice_number || "-"}</div>
                              <div className="text-[10px] text-muted">{r.request_number}</div>
                            </td>
                            <td className="p-3 text-muted">
                              {r.invoice_date ? formatDateID(r.invoice_date) : "-"}
                            </td>
                            <td className="p-3 font-medium text-ink">{vendorName}</td>
                            <td className="p-3 text-muted">{branchName}</td>
                            <td className="p-3">
                              <span
                                className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                                  r.status === "paid"
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : r.status === "payment_ready"
                                    ? "bg-blue-50 text-blue-800 border border-blue-200"
                                    : r.status === "rejected"
                                    ? "bg-red-50 text-red-800 border border-red-200"
                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                                }`}
                              >
                                {statusLabel}
                              </span>
                            </td>
                            <td className="p-3 text-right font-bold text-ink">
                              {rupiah(Number(r.payable_amount || 0))}
                            </td>
                            <td className="p-3 text-center">
                              <a
                                href={`/pengajuan/${r.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-brand hover:text-white transition-colors"
                              >
                                Buka <ExternalLink className="size-3" />
                              </a>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-line bg-slate-50 p-4 text-xs text-muted">
              <span>
                Menampilkan {filteredList.length} dari {currentList.length} dokumen
              </span>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg border border-line bg-white px-4 py-1.5 text-xs font-semibold text-ink hover:bg-slate-100 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
