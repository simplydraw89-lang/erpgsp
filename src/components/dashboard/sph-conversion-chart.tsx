"use client"

import { useState } from "react"
import { TrendingUp, FileText, CheckCircle2, Building2, Award, ArrowUpRight, BarChart3 } from "lucide-react"
import type { SphConversionSummary } from "@/lib/director-dashboard"

export function SphConversionChart({ summary }: { summary: SphConversionSummary }) {
  // Selected branch: "all" for consolidated, or branchId
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all")

  // Determine current active dataset based on branch selection
  const selectedBranch = selectedBranchId === "all"
    ? null
    : summary.branches.find((b) => b.branchId === selectedBranchId)

  const activeYearlyData = selectedBranch
    ? selectedBranch.yearlyData
    : summary.yearlyData

  const activeTitle = selectedBranch
    ? `Kurva Nilai Penawaran & Deal — Cabang ${selectedBranch.branchName}`
    : "Kurva Berdasarkan Nilai Penawaran (Konsolidasi Semua Cabang)"

  const activePenawaran = selectedBranch
    ? selectedBranch.penawaranNominal
    : summary.allTimeConversion.penawaranNominal

  const activeDeal = selectedBranch
    ? selectedBranch.dealNominal
    : summary.allTimeConversion.dealNominal

  const activePct = selectedBranch
    ? selectedBranch.percentageDeal
    : summary.allTimeConversion.percentageDeal

  const activePenawaranCount = selectedBranch
    ? selectedBranch.penawaranCount
    : summary.allTimeConversion.penawaranCount

  const activeDealCount = selectedBranch
    ? selectedBranch.dealCount
    : summary.allTimeConversion.dealCount

  // Determine max value for Y axis scaling dynamically
  const maxNominal = Math.max(
    ...activeYearlyData.map((d) => Math.max(d.penawaranNominal, d.dealNominal)),
    10000000000
  )
  // Round up to nearest nice interval
  const yNominalMax = Math.ceil(maxNominal / 20000000000) * 20000000000 || 80000000000

  // Chart SVG coordinates
  const svgWidth = 840
  const svgHeight = 320
  const padLeft = 100
  const padRight = 60
  const padTop = 35
  const padBottom = 40
  const plotWidth = svgWidth - padLeft - padRight
  const plotHeight = svgHeight - padTop - padBottom

  const groupWidth = plotWidth / activeYearlyData.length
  const barWidth = Math.min(groupWidth * 0.28, 48)
  const barGap = 6

  // Coordinates for the line points
  const linePoints = activeYearlyData.map((item, index) => {
    const xGroupCenter = padLeft + index * groupWidth + groupWidth / 2
    const pct = Math.min(Math.max(item.percentageDeal, 0), 100)
    const y = padTop + plotHeight - (pct / 100) * plotHeight
    return { x: xGroupCenter, y, pct: item.percentageDeal, year: item.year }
  })

  function formatShortRp(val: number) {
    if (val === 0) return "Rp 0"
    if (val >= 1000000000) {
      const bio = val / 1000000000
      return `Rp ${bio.toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`
    }
    return `Rp ${(val / 1000000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} Jt`
  }

  function formatFullRp(val: number) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val)
  }

  const polylinePoints = linePoints.map((p) => `${p.x},${p.y}`).join(" ")

  return (
    <div className="space-y-6">
      {/* MAIN CONTAINER */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:shadow-md md:p-6">
        {/* Header Section */}
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <TrendingUp size={16} />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                Analitik Eksekutif Direksi & Super Admin
              </span>
            </div>
            <h2 className="mt-1.5 text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              {activeTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-500 md:text-sm">
              Analisis nilai SPH yang diajukan, realisasi Deal Project (SPK disetujui), dan persentase efektivitas closing proyek.
            </p>
          </div>

          {/* Quick Stat Highlights */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Penawaran</p>
              <p className="text-sm font-bold text-slate-900">{formatShortRp(activePenawaran)}</p>
            </div>
            <div className="rounded-xl border border-purple-100 bg-purple-50/70 px-3.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-600">Total Deal Project</p>
              <p className="text-sm font-bold text-purple-900">{formatShortRp(activeDeal)}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-3.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Rasio Deal</p>
              <p className="text-sm font-bold text-emerald-700">
                {activePct.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%
              </p>
            </div>
          </div>
        </div>

        {/* Branch Filter Tabs */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-1">
            <button
              type="button"
              onClick={() => setSelectedBranchId("all")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                selectedBranchId === "all"
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200/70"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 size={13} />
              <span>Semua Cabang (Konsolidasi)</span>
            </button>

            {summary.branches.map((b) => (
              <button
                key={b.branchId}
                type="button"
                onClick={() => setSelectedBranchId(b.branchId)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  selectedBranchId === b.branchId
                    ? "bg-white text-blue-700 shadow-sm border border-slate-200/70"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>{b.branchName}</span>
                <span className="rounded bg-slate-200/70 px-1 py-0.2 text-[10px] font-mono text-slate-600">
                  {b.branchCode}
                </span>
              </button>
            ))}
          </div>

          {/* Legend Items */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-[#9bd183] border border-[#86c46b]" />
              <span className="font-medium text-slate-700">Nilai Penawaran</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-[#c49cff] border border-[#af80fa]" />
              <span className="font-medium text-slate-700">Deal Project</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1 w-4 rounded-full bg-slate-500" />
              <span className="font-medium text-slate-700">Persentase Nilai Deal (%)</span>
            </div>
          </div>
        </div>

        {/* SVG Combination Chart */}
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[680px]">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-auto w-full select-none">
              {/* Gridlines & Y-Axis Labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = padTop + plotHeight - ratio * plotHeight
                const nominalVal = ratio * yNominalMax
                const percentVal = Math.round(ratio * 100)

                return (
                  <g key={ratio}>
                    <line
                      x1={padLeft - 8}
                      y1={y}
                      x2={svgWidth - padRight + 8}
                      y2={y}
                      stroke="#f1f5f9"
                      strokeDasharray={ratio === 0 ? "0" : "4 4"}
                      strokeWidth="1.2"
                    />
                    <text
                      x={padLeft - 14}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-400 font-mono text-[11px]"
                    >
                      {formatShortRp(nominalVal)}
                    </text>
                    <text
                      x={svgWidth - padRight + 14}
                      y={y + 4}
                      textAnchor="start"
                      className="fill-slate-400 font-mono text-[11px]"
                    >
                      {percentVal},00%
                    </text>
                  </g>
                )
              })}

              {/* Bars for Each Year */}
              {activeYearlyData.map((item, index) => {
                const xGroupCenter = padLeft + index * groupWidth + groupWidth / 2
                const xPenawaran = xGroupCenter - barWidth - barGap / 2
                const xDeal = xGroupCenter + barGap / 2

                const penawaranHeight = Math.min((item.penawaranNominal / yNominalMax) * plotHeight, plotHeight)
                const yPenawaran = padTop + plotHeight - penawaranHeight

                const dealHeight = Math.min((item.dealNominal / yNominalMax) * plotHeight, plotHeight)
                const yDeal = padTop + plotHeight - dealHeight

                return (
                  <g key={item.year} className="transition-all duration-300">
                    {/* Penawaran Bar (Green) */}
                    <rect
                      x={xPenawaran}
                      y={yPenawaran}
                      width={barWidth}
                      height={Math.max(penawaranHeight, 2)}
                      rx="4"
                      fill="#9bd183"
                      className="opacity-90 hover:opacity-100 transition"
                    >
                      <title>{`${item.year} - Nilai Penawaran: ${formatFullRp(item.penawaranNominal)} (${item.penawaranCount} SPH)`}</title>
                    </rect>

                    {/* Deal Project Bar (Purple) */}
                    <rect
                      x={xDeal}
                      y={yDeal}
                      width={barWidth}
                      height={Math.max(dealHeight, 2)}
                      rx="4"
                      fill="#c49cff"
                      className="opacity-90 hover:opacity-100 transition"
                    >
                      <title>{`${item.year} - Deal Project: ${formatFullRp(item.dealNominal)} (${item.dealCount} Deal)`}</title>
                    </rect>

                    {/* Year Label */}
                    <text
                      x={xGroupCenter}
                      y={padTop + plotHeight + 24}
                      textAnchor="middle"
                      className="fill-slate-700 font-bold text-xs"
                    >
                      {item.year}
                    </text>
                  </g>
                )
              })}

              {/* Polyline Overlay */}
              {polylinePoints && (
                <polyline
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={polylinePoints}
                />
              )}

              {/* Data Point Markers & Labels */}
              {linePoints.map((point) => (
                <g key={point.year}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="6.5"
                    fill="#334155"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    className="transition hover:scale-125"
                  />
                  <g transform={`translate(${point.x}, ${Math.max(point.y - 12, padTop - 10)})`}>
                    <rect
                      x="-26"
                      y="-16"
                      width="52"
                      height="18"
                      rx="6"
                      fill="#0f172a"
                      className="shadow-sm"
                    />
                    <text
                      x="0"
                      y="-4"
                      textAnchor="middle"
                      className="fill-white font-mono font-bold text-[10px]"
                    >
                      {point.pct.toFixed(2).replace(".", ",")}%
                    </text>
                  </g>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Summary Table at Bottom (Matching Reference Image) */}
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th scope="col" className="w-1/4 p-3.5 font-bold uppercase tracking-wider text-slate-600 text-xs">
                    Keterangan / Metrik
                  </th>
                  {activeYearlyData.map((item) => (
                    <th
                      key={item.year}
                      scope="col"
                      className="p-3.5 text-center font-bold text-slate-800"
                    >
                      {item.year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* Row 1: Nilai Penawaran */}
                <tr className="hover:bg-slate-50/50 transition">
                  <th scope="row" className="p-3.5 font-semibold text-slate-800 flex items-center gap-2.5">
                    <span className="size-3 rounded bg-[#9bd183] border border-[#86c46b] shrink-0" />
                    <span>Nilai Penawaran</span>
                  </th>
                  {activeYearlyData.map((item) => (
                    <td key={item.year} className="p-3.5 text-center font-mono font-medium text-slate-700">
                      {formatFullRp(item.penawaranNominal)}
                    </td>
                  ))}
                </tr>

                {/* Row 2: Deal Project */}
                <tr className="hover:bg-slate-50/50 transition">
                  <th scope="row" className="p-3.5 font-semibold text-slate-800 flex items-center gap-2.5">
                    <span className="size-3 rounded bg-[#c49cff] border border-[#af80fa] shrink-0" />
                    <span>Deal Project</span>
                  </th>
                  {activeYearlyData.map((item) => (
                    <td key={item.year} className="p-3.5 text-center font-mono font-medium text-slate-700">
                      {formatFullRp(item.dealNominal)}
                    </td>
                  ))}
                </tr>

                {/* Row 3: Persentase Nilai Deal */}
                <tr className="bg-slate-50/70 font-semibold hover:bg-slate-100/60 transition">
                  <th scope="row" className="p-3.5 text-slate-900 flex items-center gap-2.5">
                    <span className="h-1 w-4 rounded-full bg-slate-600 shrink-0" />
                    <span>Persentase Nilai Deal</span>
                  </th>
                  {activeYearlyData.map((item) => (
                    <td key={item.year} className="p-3.5 text-center font-mono font-bold text-slate-900">
                      {item.percentageDeal.toFixed(2).replace(".", ",")}%
                    </td>
                  ))}
                </tr>

                {/* Row 4: Konversi Berkas */}
                <tr className="hover:bg-slate-50/50 transition text-slate-600">
                  <th scope="row" className="p-3.5 font-normal flex items-center gap-2.5 text-xs text-slate-500">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>Konversi Berkas (SPH → SPK)</span>
                  </th>
                  {activeYearlyData.map((item) => (
                    <td key={item.year} className="p-3.5 text-center font-mono text-xs text-slate-600">
                      {item.dealCount} dari {item.penawaranCount} SPH ({item.percentageCount.toFixed(1).replace(".", ",")}%)
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DEDICATED BRANCH COMPARISON SECTION */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:shadow-md md:p-6">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <BarChart3 size={16} />
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                Perbandingan Kinerja Konversi Antar Cabang
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Evaluasi efektivitas penawaran SPH dan konversi menjadi SPK/Proyek deal di tiap kantor cabang perusahaan.
            </p>
          </div>
          <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 sm:self-auto">
            {summary.branches.length} Cabang Aktif
          </span>
        </div>

        {/* Branch Comparative Table */}
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th scope="col" className="p-3.5 font-bold uppercase tracking-wider text-slate-600 text-xs">
                    Kantor Cabang
                  </th>
                  <th scope="col" className="p-3.5 text-right font-bold uppercase tracking-wider text-slate-600 text-xs">
                    Nilai Penawaran (SPH)
                  </th>
                  <th scope="col" className="p-3.5 text-right font-bold uppercase tracking-wider text-purple-700 text-xs">
                    Deal Project (SPK)
                  </th>
                  <th scope="col" className="p-3.5 text-center font-bold uppercase tracking-wider text-slate-600 text-xs">
                    Persentase Nilai Deal
                  </th>
                  <th scope="col" className="p-3.5 text-center font-bold uppercase tracking-wider text-slate-600 text-xs">
                    Konversi Berkas
                  </th>
                  <th scope="col" className="p-3.5 text-center font-bold uppercase tracking-wider text-slate-600 text-xs">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {summary.branches.map((branch, idx) => {
                  const isTopConversion = idx === 0 && branch.dealNominal > 0
                  const isSelected = selectedBranchId === branch.branchId

                  return (
                    <tr
                      key={branch.branchId}
                      className={`transition ${
                        isSelected
                          ? "bg-blue-50/60 font-semibold"
                          : "hover:bg-slate-50/60"
                      }`}
                    >
                      {/* Branch Name & Code */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 items-center justify-center rounded-lg bg-slate-100 font-bold text-xs text-slate-700">
                            {branch.branchCode || `#${idx + 1}`}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900">{branch.branchName}</p>
                            {isTopConversion && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600">
                                <Award size={11} />
                                Kontribusi Tertinggi
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Penawaran Nominal */}
                      <td className="p-3.5 text-right font-mono font-medium text-slate-700">
                        {formatFullRp(branch.penawaranNominal)}
                      </td>

                      {/* Deal Nominal */}
                      <td className="p-3.5 text-right font-mono font-bold text-purple-900">
                        {formatFullRp(branch.dealNominal)}
                      </td>

                      {/* Percentage Bar & Number */}
                      <td className="p-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-mono font-bold text-slate-900">
                            {branch.percentageDeal.toFixed(2).replace(".", ",")}%
                          </span>
                          {/* Mini Progress Bar */}
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-emerald-500"
                              style={{ width: `${Math.min(branch.percentageDeal, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Document Count */}
                      <td className="p-3.5 text-center font-mono text-xs text-slate-600">
                        <span className="font-semibold text-slate-900">{branch.dealCount}</span>
                        <span className="text-slate-400"> / </span>
                        <span>{branch.penawaranCount} SPH</span>
                        <span className="ml-1 text-slate-400">
                          ({branch.percentageCount.toFixed(1).replace(".", ",")}%)
                        </span>
                      </td>

                      {/* Action Button */}
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBranchId(branch.branchId)
                            window.scrollTo({ top: 120, behavior: "smooth" })
                          }}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                            isSelected
                              ? "bg-blue-600 text-white shadow-sm"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <span>{isSelected ? "Sedang Aktif" : "Lihat Kurva"}</span>
                          <ArrowUpRight size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
