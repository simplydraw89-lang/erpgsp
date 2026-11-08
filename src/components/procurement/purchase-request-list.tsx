"use client"

import { useState } from "react"
import Link from "next/link"
import { Zap, CheckCircle2, ArrowRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import {
  type BusinessUnit,
  type ProcurementVendor,
  type PurchaseRequest,
  purchaseStatusLabels,
  rupiah,
  formatDateID,
} from "@/lib/procurement-ui"

export function PurchaseRequestList({
  purchases,
  branches,
  vendorRows,
}: {
  purchases: PurchaseRequest[]
  branches: BusinessUnit[]
  vendorRows: ProcurementVendor[]
}) {
  const [tab, setTab] = useState<"active" | "completed">("active")

  // Status aktif: belum lunas / masih dalam alur verifikasi atau draft
  const isPurchaseActive = (status: string) => !["paid", "cancelled"].includes(status)

  const activeRows = purchases.filter((r) => isPurchaseActive(r.status))
  const completedRows = purchases.filter((r) => !isPurchaseActive(r.status))
  const displayRows = tab === "active" ? activeRows : completedRows

  return (
    <div className="space-y-4">
      {/* Tab Segmented Control */}
      <div className="flex border-b border-line gap-2">
        <button
          type="button"
          onClick={() => setTab("active")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            tab === "active"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Zap className="size-4 text-amber-500" />
          <span>Perlu Diproses / Aktif</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              tab === "active"
                ? "bg-amber-100 text-amber-900 border border-amber-300"
                : "bg-slate-100 text-muted"
            }`}
          >
            {activeRows.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("completed")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            tab === "completed"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <CheckCircle2 className="size-4 text-emerald-600" />
          <span>Riwayat Selesai & Lunas</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              tab === "completed"
                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                : "bg-slate-100 text-muted"
            }`}
          >
            {completedRows.length}
          </span>
        </button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas text-muted">
              <tr>
                {["No.", "No. Dokumen / Invoice", "Cabang", "Vendor", "Status", "Dibayar ke vendor", ""].map(
                  (t) => (
                    <th key={t} className="px-4 py-3 font-medium">
                      {t}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r, idx) => {
                const isUrgent = [
                  "director_review",
                  "branch_review",
                  "accounting_review",
                  "payment_ready",
                ].includes(r.status)
                return (
                  <tr key={r.id} className={`border-t border-line ${isUrgent ? "bg-amber-50/40" : ""}`}>
                    <td className="px-4 py-4 text-xs font-semibold text-muted">{idx + 1}</td>
                    <td className="px-4 py-4 font-medium">
                      {r.request_number ? (
                        <span className="block font-semibold text-brand text-xs">{r.request_number}</span>
                      ) : null}
                      <span className="text-sm">{r.invoice_number}</span>
                      <span className="mt-1 block text-xs text-muted">{formatDateID(r.invoice_date)}</span>
                    </td>
                    <td className="px-4 py-4">{branches.find((b) => b.id === r.branch_id)?.name ?? "Cabang"}</td>
                    <td className="px-4 py-4">
                      {vendorRows.find((v) => v.id === r.vendor_id)?.name ??
                        r.vendor_snapshot?.name ??
                        "Belum dipilih"}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          r.status === "director_review"
                            ? "bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                            : r.status === "branch_review"
                            ? "bg-blue-100 text-blue-900 border border-blue-200"
                            : r.status === "accounting_review"
                            ? "bg-purple-100 text-purple-900 border border-purple-200"
                            : r.status === "payment_ready"
                            ? "bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold"
                            : r.status === "paid"
                            ? "bg-slate-100 text-slate-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {isUrgent ? "⚡ " : ""}
                        {purchaseStatusLabels[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">{rupiah(r.payable_amount)}</td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/pengajuan/${r.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand hover:underline"
                      >
                        {isUrgent ? "Periksa & Proses →" : "Buka Detail →"}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!displayRows.length && (
          <p className="p-8 text-center text-sm text-muted">
            {tab === "active"
              ? "🎉 Tidak ada pengajuan pembelian yang perlu diproses saat ini. Semua berkas telah lunas atau selesai."
              : "Belum ada riwayat pengajuan pembelian yang selesai / lunas."}
          </p>
        )}
      </Card>
    </div>
  )
}
