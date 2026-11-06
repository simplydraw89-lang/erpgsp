"use client"

import { useState } from "react"
import { formatCurrency } from "@/lib/money"
import { Building2, Layers } from "lucide-react"
import type { BranchFinancialSummary } from "@/lib/director-dashboard"

export function BranchReportView({
  consolidated,
  byBranch,
}: {
  consolidated: BranchFinancialSummary
  byBranch: BranchFinancialSummary[]
}) {
  const [selectedBranchId, setSelectedBranchId] = useState<string>("company-wide")

  const selectedData =
    selectedBranchId === "company-wide"
      ? consolidated
      : byBranch.find((b) => b.branchId === selectedBranchId) ?? consolidated

  return (
    <div className="space-y-6">
      {/* Selector Cabang vs Konsolidasi Perusahaan */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Ringkasan Laporan Keuangan</h2>
          <p className="mt-1 text-xs text-muted">
            Bandingkan performa keuangan antar cabang dan konsolidasi seluruh perusahaan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="branch-select" className="text-xs font-medium text-muted">
            Cakupan Laporan:
          </label>
          <select
            id="branch-select"
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink shadow-sm focus:border-brand focus:outline-none"
          >
            <option value="company-wide">🏢 Konsolidasi Perusahaan (Semua Cabang)</option>
            {byBranch.map((branch) => (
              <option key={branch.branchId} value={branch.branchId}>
                📍 Cabang {branch.branchName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Primary KPI Grid for Selected Scope */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Kas & Bank */}
        <div className="rounded-xl border border-line bg-white p-5 shadow-panel">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            Kas & Bank
          </span>
          <p className="mt-2 text-2xl font-bold text-ink">
            {formatCurrency(selectedData.cashBank)}
          </p>
          <p className="mt-1 text-xs text-muted">Likuiditas saldo operasional</p>
        </div>

        {/* Omzet / Pendapatan */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-panel">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Omzet (Pendapatan)
          </span>
          <p className="mt-2 text-2xl font-bold text-emerald-800">
            {formatCurrency(selectedData.omzet)}
          </p>
          <p className="mt-1 text-xs text-emerald-600">Realisasi SPH & SPK</p>
        </div>

        {/* Utang Usaha */}
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-5 shadow-panel">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
            Utang Usaha
          </span>
          <p className="mt-2 text-2xl font-bold text-rose-800">
            {formatCurrency(selectedData.utang)}
          </p>
          <p className="mt-1 text-xs text-rose-600">Kewajiban vendor belum dibayar</p>
        </div>

        {/* Piutang Usaha */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 shadow-panel">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Piutang Usaha
          </span>
          <p className="mt-2 text-2xl font-bold text-blue-800">
            {formatCurrency(selectedData.piutang)}
          </p>
          <p className="mt-1 text-xs text-blue-600">Tagihan klien berjalan</p>
        </div>
      </div>

      {/* Pajak Breakdown Card */}
      <div className="rounded-xl border border-line bg-white p-5 shadow-panel">
        <h3 className="font-semibold text-ink">Rincian Perpajakan ({selectedData.branchName})</h3>
        <p className="mt-1 text-xs text-muted">
          Pajak Pertambahan Nilai (PPN Masukan, PPN Keluaran) dan Pajak Penghasilan (PPh).
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-canvas p-4">
            <span className="text-xs font-medium text-muted">PPN Masukan</span>
            <p className="mt-1 text-lg font-bold text-ink">
              {formatCurrency(selectedData.pajak.ppnMasukan)}
            </p>
            <p className="mt-1 text-[11px] text-muted">Pajak masukan dari pembelian vendor</p>
          </div>

          <div className="rounded-lg border border-line bg-canvas p-4">
            <span className="text-xs font-medium text-muted">PPN Keluaran</span>
            <p className="mt-1 text-lg font-bold text-ink">
              {formatCurrency(selectedData.pajak.ppnKeluaran)}
            </p>
            <p className="mt-1 text-[11px] text-muted">Pajak keluaran atas penyerahan jasa</p>
          </div>

          <div className="rounded-lg border border-line bg-canvas p-4">
            <span className="text-xs font-medium text-muted">Pajak Penghasilan (PPh)</span>
            <p className="mt-1 text-lg font-bold text-ink">
              {formatCurrency(selectedData.pajak.pph)}
            </p>
            <p className="mt-1 text-[11px] text-muted">PPh 21, PPh 23, & PPh Final dipotong</p>
          </div>
        </div>
      </div>

      {/* Tabel Komparasi Antar Cabang */}
      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-panel">
        <div className="flex items-center gap-2 border-b border-line p-5">
          <Layers size={18} className="text-brand" />
          <div>
            <h3 className="font-semibold text-ink">Tabel Perbandingan Performa Finansial Cabang</h3>
            <p className="mt-0.5 text-xs text-muted">Komparasi langsung seluruh cabang usaha terdaftar.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas text-muted">
              <tr>
                <th scope="col" className="p-3.5 font-semibold">Cabang Usaha</th>
                <th scope="col" className="p-3.5 text-right font-semibold">Kas & Bank</th>
                <th scope="col" className="p-3.5 text-right font-semibold">Omzet</th>
                <th scope="col" className="p-3.5 text-right font-semibold">Utang</th>
                <th scope="col" className="p-3.5 text-right font-semibold">Piutang</th>
                <th scope="col" className="p-3.5 text-right font-semibold">PPN Masukan</th>
                <th scope="col" className="p-3.5 text-right font-semibold">PPN Keluaran</th>
                <th scope="col" className="p-3.5 text-right font-semibold">PPh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {byBranch.map((branch) => (
                <tr
                  key={branch.branchId}
                  className={selectedBranchId === branch.branchId ? "bg-brand-light/30" : "hover:bg-slate-50"}
                >
                  <th scope="row" className="p-3.5 font-medium text-ink">
                    {branch.branchName}
                  </th>
                  <td className="p-3.5 text-right font-medium">{formatCurrency(branch.cashBank)}</td>
                  <td className="p-3.5 text-right font-semibold text-emerald-700">
                    {formatCurrency(branch.omzet)}
                  </td>
                  <td className="p-3.5 text-right font-medium text-rose-700">
                    {formatCurrency(branch.utang)}
                  </td>
                  <td className="p-3.5 text-right font-medium text-blue-700">
                    {formatCurrency(branch.piutang)}
                  </td>
                  <td className="p-3.5 text-right">{formatCurrency(branch.pajak.ppnMasukan)}</td>
                  <td className="p-3.5 text-right">{formatCurrency(branch.pajak.ppnKeluaran)}</td>
                  <td className="p-3.5 text-right">{formatCurrency(branch.pajak.pph)}</td>
                </tr>
              ))}
              {/* Konsolidasi Row */}
              <tr className="bg-canvas font-bold text-ink">
                <th scope="row" className="p-3.5">
                  TOTAL KONSOLIDASI
                </th>
                <td className="p-3.5 text-right">{formatCurrency(consolidated.cashBank)}</td>
                <td className="p-3.5 text-right text-emerald-800">{formatCurrency(consolidated.omzet)}</td>
                <td className="p-3.5 text-right text-rose-800">{formatCurrency(consolidated.utang)}</td>
                <td className="p-3.5 text-right text-blue-800">{formatCurrency(consolidated.piutang)}</td>
                <td className="p-3.5 text-right">{formatCurrency(consolidated.pajak.ppnMasukan)}</td>
                <td className="p-3.5 text-right">{formatCurrency(consolidated.pajak.ppnKeluaran)}</td>
                <td className="p-3.5 text-right">{formatCurrency(consolidated.pajak.pph)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
