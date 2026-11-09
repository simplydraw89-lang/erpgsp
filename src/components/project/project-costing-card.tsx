"use client"

import { useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { rupiah, formatDateID } from "@/lib/procurement-ui"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Plane,
  AlertTriangle,
  CheckCircle2,
  PieChart,
  ArrowUpRight,
  PlusCircle,
  ExternalLink,
} from "lucide-react"

export type ProjectCostingData = {
  project_id: string
  contract_amount: number
  rab_total: number
  realized_purchases: number
  realized_advances: number
  total_realized: number
  remaining_budget: number
  budget_absorption_pct: number
  real_net_profit: number
  real_net_profit_pct: number
  purchases: Array<{
    id: string
    invoice_number: string
    invoice_date: string
    vendor_name: string
    total: number
    status: string
    created_at: string
  }>
  advances: Array<{
    id: string
    advance_number: string
    sppd_number?: string
    description: string
    amount: number
    status: string
    needed_on: string
    destination?: string
  }>
}

export function ProjectCostingCard({
  costing,
  canTransact = true,
}: {
  costing: ProjectCostingData
  canTransact?: boolean
}) {
  const [filterType, setFilterType] = useState<"all" | "purchase" | "advance">("all")

  const contract = Number(costing.contract_amount || 0)
  const rab = Number(costing.rab_total || 0)
  const realized = Number(costing.total_realized || 0)
  const remaining = Number(costing.remaining_budget || 0)
  const absorption = Number(costing.budget_absorption_pct || 0)
  const netProfit = Number(costing.real_net_profit || 0)
  const netProfitPct = Number(costing.real_net_profit_pct || 0)

  // Status serapan
  const isOverBudget = remaining < 0
  const isBudgetCritical = !isOverBudget && absorption >= 85
  const isBudgetWarning = !isOverBudget && absorption >= 70 && absorption < 85

  const allTransactions = [
    ...(costing.purchases || []).map(p => ({
      type: "purchase" as const,
      id: p.id,
      docNumber: p.invoice_number,
      secondaryNumber: null,
      title: p.vendor_name ? `Tagihan Vendor: ${p.vendor_name}` : "Pembelian Barang/Jasa",
      date: p.invoice_date,
      amount: Number(p.total || 0),
      status: p.status,
      href: `/pengajuan/${p.id}`,
    })),
    ...(costing.advances || []).map(a => ({
      type: "advance" as const,
      id: a.id,
      docNumber: a.sppd_number || a.advance_number,
      secondaryNumber: a.sppd_number ? a.advance_number : null,
      title: a.description || "Kasbon Perjalanan Dinas SPPD",
      date: a.needed_on,
      amount: Number(a.amount || 0),
      status: a.status,
      href: `/pengajuan/perjalanan-dinas`,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const filteredTransactions = allTransactions.filter(t => {
    if (filterType === "purchase") return t.type === "purchase"
    if (filterType === "advance") return t.type === "advance"
    return true
  })

  return (
    <Card className="p-5 md:p-6 space-y-6 border-slate-200">
      {/* Header Realisasi & Tombol Transaksi */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <PieChart className="size-4" />
            </span>
            <h2 className="text-lg font-bold text-ink">Project Costing & Realisasi RAB Riil</h2>
          </div>
          <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed">
            Realisasi biaya lapangan memotong pagu RAB yang telah disahkan Direktur Utama. Sistem menghitung serapan anggaran aktual dan laba bersih riil berjalan.
          </p>
        </div>

        {canTransact && (
          <div className="flex items-center gap-2">
            <Link
              href="/pengajuan/pembelian/baru"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              <PlusCircle className="size-3.5 text-brand" /> + Pembelian Vendor
            </Link>
            <Link
              href="/pengajuan/perjalanan-dinas"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand/90 transition shadow-sm"
            >
              <Plane className="size-3.5" /> + SPPD Kasbon
            </Link>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Pagu Anggaran RAB */}
        <div className="rounded-xl border border-line bg-canvas/60 p-4 space-y-1">
          <p className="text-xs font-medium text-muted">Pagu Anggaran RAB (ACC Dirut)</p>
          <p className="text-lg font-bold text-ink">{rupiah(rab)}</p>
          <div className="text-[11px] text-muted flex items-center justify-between pt-1">
            <span>Nilai Kontrak SPK:</span>
            <span className="font-semibold text-slate-800">{rupiah(contract)}</span>
          </div>
        </div>

        {/* 2. Total Realisasi Biaya */}
        <div className="rounded-xl border border-line bg-canvas/60 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted">Realisasi Biaya Riil</p>
            <span className="font-mono text-[11px] font-bold text-brand">
              {absorption.toFixed(1)}% Terpakai
            </span>
          </div>
          <p className="text-lg font-bold text-brand">{rupiah(realized)}</p>
          <div className="flex items-center justify-between text-[11px] text-muted pt-1">
            <span>Pembelian: {rupiah(Number(costing.realized_purchases || 0))}</span>
            <span>Kasbon: {rupiah(Number(costing.realized_advances || 0))}</span>
          </div>
        </div>

        {/* 3. Sisa Pagu Anggaran */}
        <div className={`rounded-xl border p-4 space-y-1 ${
          isOverBudget
            ? "border-red-300 bg-red-50 text-red-950"
            : isBudgetCritical
            ? "border-amber-300 bg-amber-50 text-amber-950"
            : "border-line bg-canvas/60"
        }`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted">Sisa Pagu Anggaran</p>
            {isOverBudget && (
              <span className="flex items-center gap-1 rounded bg-red-200 px-1.5 py-0.5 text-[10px] font-bold text-red-800">
                <AlertTriangle className="size-3" /> Over Budget
              </span>
            )}
          </div>
          <p className={`text-lg font-bold ${
            isOverBudget ? "text-red-600" : isBudgetCritical ? "text-amber-700" : "text-emerald-700"
          }`}>
            {rupiah(remaining)}
          </p>
          <p className="text-[11px] text-muted">
            {isOverBudget
              ? "Realisasi melebihi pagu yang di-ACC!"
              : `${(100 - absorption).toFixed(1)}% anggaran masih tersedia`}
          </p>
        </div>

        {/* 4. Laba Bersih Riil Proyek */}
        <div className="rounded-xl border border-line bg-canvas/60 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted">Laba Bersih Riil (Net Profit)</p>
            <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
              netProfit >= 0 ? "text-emerald-700" : "text-red-600"
            }`}>
              {netProfit >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {netProfitPct.toFixed(1)}%
            </span>
          </div>
          <p className={`text-lg font-bold ${netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {rupiah(netProfit)}
          </p>
          <p className="text-[11px] text-muted">
            Kontrak ({rupiah(contract)}) - Realisasi ({rupiah(realized)})
          </p>
        </div>
      </div>

      {/* Progress Bar Serapan Anggaran */}
      <div className="space-y-2 rounded-xl bg-slate-50 p-4 border border-line">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
            <span>Persentase Serapan Pagu RAB Proyek</span>
            {isOverBudget ? (
              <span className="text-red-600 font-bold">(Melebihi Anggaran)</span>
            ) : isBudgetCritical ? (
              <span className="text-amber-600 font-bold">(Kritis &gt; 85%)</span>
            ) : isBudgetWarning ? (
              <span className="text-amber-600 font-bold">(Waspada &gt; 70%)</span>
            ) : (
              <span className="text-emerald-600 font-semibold">(Sehat)</span>
            )}
          </span>
          <span className="font-mono font-bold text-slate-900">
            {absorption.toFixed(2)}% dari {rupiah(rab)}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isOverBudget
                ? "bg-red-600"
                : isBudgetCritical
                ? "bg-amber-600"
                : isBudgetWarning
                ? "bg-amber-500"
                : "bg-emerald-600"
            }`}
            style={{ width: `${Math.min(absorption, 100)}%` }}
          />
        </div>
      </div>

      {/* Rincian Transaksi Realisasi Biaya */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-brand" />
            <h3 className="text-sm font-bold text-ink">Buku Rincian Biaya Riil (Pembelian & SPPD)</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-muted font-medium">
              {allTransactions.length} transaksi
            </span>
          </div>

          <div className="flex rounded-lg border border-line bg-white p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                filterType === "all" ? "bg-brand text-white shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              Semua ({allTransactions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("purchase")}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                filterType === "purchase" ? "bg-brand text-white shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              Pembelian ({costing.purchases?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("advance")}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                filterType === "advance" ? "bg-brand text-white shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              SPPD Kasbon ({costing.advances?.length || 0})
            </button>
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-muted">
            Belum ada realisasi biaya yang tercatat untuk kategori ini. Pengeluaran pembelian vendor atau kasbon SPPD yang terhubung ke proyek ini akan muncul di sini secara otomatis.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-canvas text-slate-700">
                <tr>
                  <th className="p-3">Jenis</th>
                  <th className="p-3">No. Dokumen / Invoice</th>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Keterangan / Vendor</th>
                  <th className="p-3 text-right">Nominal</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-white">
                {filteredTransactions.map((tx, idx) => (
                  <tr key={`${tx.type}-${tx.id}-${idx}`} className="hover:bg-slate-50/70">
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                        tx.type === "purchase"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-purple-100 text-purple-800"
                      }`}>
                        {tx.type === "purchase" ? <Receipt className="size-3" /> : <Plane className="size-3" />}
                        {tx.type === "purchase" ? "Pembelian" : "SPPD Kasbon"}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-ink">
                      {tx.docNumber}
                      {tx.secondaryNumber && (
                        <span className="block text-[10px] font-normal text-muted">
                          KB: {tx.secondaryNumber}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-700 whitespace-nowrap">
                      {formatDateID(tx.date)}
                    </td>
                    <td className="p-3 max-w-[250px] truncate text-slate-800" title={tx.title}>
                      {tx.title}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-ink">
                      {rupiah(tx.amount)}
                    </td>
                    <td className="p-3 text-center">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 uppercase">
                        {tx.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <Link
                        href={tx.href}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
                      >
                        Buka <ArrowUpRight className="size-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  )
}
