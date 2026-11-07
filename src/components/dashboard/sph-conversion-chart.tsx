"use client"

import { useState, useMemo } from "react"
import { TrendingUp, CheckCircle2, Building2, Award, Calendar, Layers, ChevronDown, ChevronUp } from "lucide-react"
import type { SphConversionSummary } from "@/lib/director-dashboard"

export function SphConversionChart({ summary }: { summary: SphConversionSummary }) {
  // Branch filter: "all" for consolidated, or branchId
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all")
  
  // Year filter for the Branch Comparison leaderboard (default: current year / latest year)
  const currentYear = new Date().getFullYear()
  const availableYears = summary.yearlyData.map((d) => d.year)
  const defaultYear = availableYears.includes(currentYear)
    ? currentYear
    : availableYears[availableYears.length - 1]
  const [comparisonYear, setComparisonYear] = useState<number | "all">(defaultYear)
  
  // Toggle show branch breakdown rows in table
  const [showBranchBreakdown, setShowBranchBreakdown] = useState(false)

  // Selected branch data or consolidated
  const selectedBranch = selectedBranchId === "all"
    ? null
    : summary.branches.find((b) => b.branchId === selectedBranchId)

  const activeYearlyData = selectedBranch
    ? selectedBranch.yearlyData
    : summary.yearlyData

  const activeTitle = selectedBranch
    ? `Cabang ${selectedBranch.branchName}`
    : "Konsolidasi Semua Cabang"

  const activePenawaran = selectedBranch
    ? selectedBranch.penawaranNominal
    : summary.allTimeConversion.penawaranNominal

  const activeDeal = selectedBranch
    ? selectedBranch.dealNominal
    : summary.allTimeConversion.dealNominal

  const activePct = selectedBranch
    ? selectedBranch.percentageDeal
    : summary.allTimeConversion.percentageDeal

  // Dynamic Y axis calculation to avoid excess empty space
  const maxNominalVal = Math.max(
    ...activeYearlyData.map((d) => Math.max(d.penawaranNominal, d.dealNominal)),
    5000000000
  )
  // Fit nicely with 10B or 20B intervals
  const interval = maxNominalVal > 40000000000 ? 20000000000 : 10000000000
  const yNominalMax = Math.ceil((maxNominalVal * 1.08) / interval) * interval || 80000000000

  // Compact Chart Dimensions (Low height, minimal whitespace)
  const svgWidth = 820
  const svgHeight = 210
  const padLeft = 72
  const padRight = 48
  const padTop = 22
  const padBottom = 28
  const plotWidth = svgWidth - padLeft - padRight
  const plotHeight = svgHeight - padTop - padBottom

  const groupWidth = plotWidth / activeYearlyData.length
  const barWidth = Math.min(groupWidth * 0.22, 28)
  const barGap = 4

  // Branch distinct shades (Harmonious tones: Green spectrum for Penawaran, Purple spectrum for Deal)
  // This keeps the metric colors clean while clearly showing each branch's contribution!
  const branchPalette: Record<string, { penawaran: string; deal: string; label: string }> = {
    SBY: { penawaran: "#6ab050", deal: "#874dcc", label: "Surabaya" },
    JKT: { penawaran: "#88cc74", deal: "#a86fe8", label: "Jakarta" },
    JOG: { penawaran: "#b2e3a2", deal: "#cfa1f7", label: "Jogjakarta" },
    PUSAT: { penawaran: "#d3f2c7", deal: "#e8caff", label: "Pusat" },
  }

  // Pre-calculate stacked segments for each year when in consolidated mode
  const isConsolidated = selectedBranchId === "all"

  // Coordinates for the percentage trendline
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

  // Calculate branch leaderboard based on selected comparisonYear
  const branchLeaderboard = useMemo(() => {
    return summary.branches.map((b) => {
      let penawaran = 0
      let deal = 0
      let penawaranCount = 0
      let dealCount = 0

      if (comparisonYear === "all") {
        penawaran = b.penawaranNominal
        deal = b.dealNominal
        penawaranCount = b.penawaranCount
        dealCount = b.dealCount
      } else {
        const yrData = b.yearlyData.find((y) => y.year === comparisonYear)
        if (yrData) {
          penawaran = yrData.penawaranNominal
          deal = yrData.dealNominal
          penawaranCount = yrData.penawaranCount
          dealCount = yrData.dealCount
        }
      }

      const pct = penawaran > 0 ? (deal / penawaran) * 100 : 0
      const countPct = penawaranCount > 0 ? (dealCount / penawaranCount) * 100 : 0

      return {
        branchId: b.branchId,
        branchCode: b.branchCode,
        branchName: b.branchName,
        penawaran,
        deal,
        pct: Math.round(pct * 100) / 100,
        penawaranCount,
        dealCount,
        countPct: Math.round(countPct * 10) / 10,
      }
    }).sort((a, b) => b.deal - a.deal || b.pct - a.pct)
  }, [summary.branches, comparisonYear])

  return (
    <div className="space-y-4">
      {/* 1. COMPACT MAIN CHART CARD */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">
        {/* Header - Compact Single Line */}
        <div className="flex flex-col gap-2.5 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
              <TrendingUp size={14} />
            </span>
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                Kurva Berdasarkan Nilai Penawaran
              </h2>
              <p className="text-[11px] text-slate-500">
                Tingkat konversi penawaran SPH menjadi SPK deal · <span className="font-semibold text-blue-600">{activeTitle}</span>
              </p>
            </div>
          </div>

          {/* Quick Metrics Pills */}
          <div className="flex items-center gap-2 text-xs">
            <div className="rounded-lg bg-slate-50 px-2.5 py-1 border border-slate-200/60">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Penawaran: </span>
              <span className="font-bold text-slate-900">{formatShortRp(activePenawaran)}</span>
            </div>
            <div className="rounded-lg bg-purple-50/80 px-2.5 py-1 border border-purple-100">
              <span className="text-[10px] text-purple-600 uppercase font-semibold">Deal: </span>
              <span className="font-bold text-purple-900">{formatShortRp(activeDeal)}</span>
            </div>
            <div className="rounded-lg bg-emerald-50 px-2.5 py-1 border border-emerald-100">
              <span className="text-[10px] text-emerald-600 uppercase font-semibold">Rasio: </span>
              <span className="font-bold text-emerald-800">
                {activePct.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%
              </span>
            </div>
          </div>
        </div>

        {/* Toolbar: Branch Filter Pills & Legend */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Branch Pill Selector */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200/70 bg-slate-50/80 p-0.5">
            <button
              type="button"
              onClick={() => setSelectedBranchId("all")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                selectedBranchId === "all"
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua Cabang
            </button>
            {summary.branches.map((b) => (
              <button
                key={b.branchId}
                type="button"
                onClick={() => setSelectedBranchId(b.branchId)}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                  selectedBranchId === b.branchId
                    ? "bg-white text-blue-700 shadow-sm border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {b.branchName}
              </button>
            ))}
          </div>

          {/* Metric Legend with Branch Color Swatches */}
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            {/* Penawaran Legend */}
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1">
                <span className="size-2.5 rounded-full bg-[#6ab050] border border-white" title="Surabaya" />
                <span className="size-2.5 rounded-full bg-[#88cc74] border border-white" title="Jakarta" />
                <span className="size-2.5 rounded-full bg-[#b2e3a2] border border-white" title="Jogjakarta" />
              </div>
              <span className="font-medium text-slate-700">Nilai Penawaran</span>
            </div>

            {/* Deal Legend */}
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1">
                <span className="size-2.5 rounded-full bg-[#874dcc] border border-white" title="Surabaya" />
                <span className="size-2.5 rounded-full bg-[#a86fe8] border border-white" title="Jakarta" />
                <span className="size-2.5 rounded-full bg-[#cfa1f7] border border-white" title="Jogjakarta" />
              </div>
              <span className="font-medium text-slate-700">Deal Project</span>
            </div>

            {/* Curve Line Legend */}
            <div className="flex items-center gap-1.5">
              <span className="h-0.5 w-3.5 rounded-full bg-slate-600" />
              <span className="font-medium text-slate-700">% Nilai Deal</span>
            </div>
          </div>
        </div>

        {/* Compact SVG Combination Chart */}
        <div className="mt-2 overflow-x-auto">
          <div className="min-w-[620px]">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-auto w-full select-none">
              {/* Gridlines & Y-Axis Labels (4 levels) */}
              {[0, 0.33, 0.66, 1].map((ratio) => {
                const y = padTop + plotHeight - ratio * plotHeight
                const nominalVal = ratio * yNominalMax
                const percentVal = Math.round(ratio * 100)

                return (
                  <g key={ratio}>
                    <line
                      x1={padLeft - 6}
                      y1={y}
                      x2={svgWidth - padRight + 6}
                      y2={y}
                      stroke="#f1f5f9"
                      strokeDasharray={ratio === 0 ? "0" : "3 3"}
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 10}
                      y={y + 3.5}
                      textAnchor="end"
                      className="fill-slate-400 font-mono text-[9.5px]"
                    >
                      {formatShortRp(nominalVal)}
                    </text>
                    <text
                      x={svgWidth - padRight + 10}
                      y={y + 3.5}
                      textAnchor="start"
                      className="fill-slate-400 font-mono text-[9.5px]"
                    >
                      {percentVal}%
                    </text>
                  </g>
                )
              })}

              {/* Bars for Each Year */}
              {activeYearlyData.map((item, index) => {
                const xGroupCenter = padLeft + index * groupWidth + groupWidth / 2
                const xPenawaran = xGroupCenter - barWidth - barGap / 2
                const xDeal = xGroupCenter + barGap / 2

                // If consolidated, stack branch contributions inside the bar!
                if (isConsolidated) {
                  // Calculate stacked segments for Penawaran
                  let currentYPenawaran = padTop + plotHeight
                  const penawaranSegments = summary.branches.map((b) => {
                    const bYr = b.yearlyData.find((y) => y.year === item.year)
                    const val = bYr?.penawaranNominal ?? 0
                    const segHeight = (val / yNominalMax) * plotHeight
                    currentYPenawaran -= segHeight
                    const color = branchPalette[b.branchCode]?.penawaran || "#88cc74"
                    return { bName: b.branchName, val, segHeight, y: currentYPenawaran, color }
                  })

                  // Calculate stacked segments for Deal
                  let currentYDeal = padTop + plotHeight
                  const dealSegments = summary.branches.map((b) => {
                    const bYr = b.yearlyData.find((y) => y.year === item.year)
                    const val = bYr?.dealNominal ?? 0
                    const segHeight = (val / yNominalMax) * plotHeight
                    currentYDeal -= segHeight
                    const color = branchPalette[b.branchCode]?.deal || "#b88cf2"
                    return { bName: b.branchName, val, segHeight, y: currentYDeal, color }
                  })

                  return (
                    <g key={item.year}>
                      {/* Stacked Penawaran Bar */}
                      {penawaranSegments.map((seg, sIdx) => (
                        <rect
                          key={`pen-${sIdx}`}
                          x={xPenawaran}
                          y={seg.y}
                          width={barWidth}
                          height={Math.max(seg.segHeight, 0.5)}
                          rx={sIdx === penawaranSegments.length - 1 ? 3 : 0}
                          fill={seg.color}
                          className="opacity-95 hover:opacity-100 transition"
                        >
                          <title>{`${item.year} - ${seg.bName}: Penawaran ${formatFullRp(seg.val)}`}</title>
                        </rect>
                      ))}

                      {/* Stacked Deal Bar */}
                      {dealSegments.map((seg, sIdx) => (
                        <rect
                          key={`deal-${sIdx}`}
                          x={xDeal}
                          y={seg.y}
                          width={barWidth}
                          height={Math.max(seg.segHeight, 0.5)}
                          rx={sIdx === dealSegments.length - 1 ? 3 : 0}
                          fill={seg.color}
                          className="opacity-95 hover:opacity-100 transition"
                        >
                          <title>{`${item.year} - ${seg.bName}: Deal ${formatFullRp(seg.val)}`}</title>
                        </rect>
                      ))}

                      {/* Year Label */}
                      <text
                        x={xGroupCenter}
                        y={padTop + plotHeight + 18}
                        textAnchor="middle"
                        className="fill-slate-700 font-bold text-[11px]"
                      >
                        {item.year}
                      </text>
                    </g>
                  )
                }

                // Single Branch Mode (Solid bars)
                const penawaranHeight = Math.min((item.penawaranNominal / yNominalMax) * plotHeight, plotHeight)
                const yPenawaran = padTop + plotHeight - penawaranHeight

                const dealHeight = Math.min((item.dealNominal / yNominalMax) * plotHeight, plotHeight)
                const yDeal = padTop + plotHeight - dealHeight

                const bCode = selectedBranch?.branchCode ?? "SBY"
                const penColor = branchPalette[bCode]?.penawaran || "#88cc74"
                const dealColor = branchPalette[bCode]?.deal || "#b88cf2"

                return (
                  <g key={item.year}>
                    <rect
                      x={xPenawaran}
                      y={yPenawaran}
                      width={barWidth}
                      height={Math.max(penawaranHeight, 2)}
                      rx="3"
                      fill={penColor}
                    >
                      <title>{`${item.year} - Penawaran: ${formatFullRp(item.penawaranNominal)}`}</title>
                    </rect>
                    <rect
                      x={xDeal}
                      y={yDeal}
                      width={barWidth}
                      height={Math.max(dealHeight, 2)}
                      rx="3"
                      fill={dealColor}
                    >
                      <title>{`${item.year} - Deal Project: ${formatFullRp(item.dealNominal)}`}</title>
                    </rect>
                    <text
                      x={xGroupCenter}
                      y={padTop + plotHeight + 18}
                      textAnchor="middle"
                      className="fill-slate-700 font-bold text-[11px]"
                    >
                      {item.year}
                    </text>
                  </g>
                )
              })}

              {/* Trendline Curve Overlay */}
              {polylinePoints && (
                <polyline
                  fill="none"
                  stroke="#475569"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={polylinePoints}
                />
              )}

              {/* Data Point Markers & Percentage Callouts */}
              {linePoints.map((point) => (
                <g key={point.year}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="4.5"
                    fill="#1e293b"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <g transform={`translate(${point.x}, ${Math.max(point.y - 10, padTop - 5)})`}>
                    <rect
                      x="-20"
                      y="-13"
                      width="40"
                      height="15"
                      rx="4"
                      fill="#0f172a"
                      className="shadow-sm"
                    />
                    <text
                      x="0"
                      y="-2.5"
                      textAnchor="middle"
                      className="fill-white font-mono font-bold text-[8.5px]"
                    >
                      {point.pct.toFixed(1).replace(".", ",")}%
                    </text>
                  </g>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Compact Reference Table */}
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th scope="col" className="w-1/4 py-2 px-3 font-bold uppercase tracking-wider text-slate-600 text-[11px]">
                    Keterangan
                  </th>
                  {activeYearlyData.map((item) => (
                    <th key={item.year} scope="col" className="py-2 px-3 text-center font-bold text-slate-800 text-[11px]">
                      {item.year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Row 1: Nilai Penawaran */}
                <tr className="hover:bg-slate-50/60 transition">
                  <th scope="row" className="py-2 px-3 font-semibold text-slate-800 flex items-center gap-2">
                    <span className="size-2.5 rounded bg-[#88cc74] border border-[#70b35c] shrink-0" />
                    <span>Nilai Penawaran</span>
                  </th>
                  {activeYearlyData.map((item) => (
                    <td key={item.year} className="py-2 px-3 text-center font-mono font-medium text-slate-700 text-xs">
                      {formatFullRp(item.penawaranNominal)}
                    </td>
                  ))}
                </tr>

                {/* Row 2: Deal Project */}
                <tr className="hover:bg-slate-50/60 transition">
                  <th scope="row" className="py-2 px-3 font-semibold text-slate-800 flex items-center gap-2">
                    <span className="size-2.5 rounded bg-[#b88cf2] border border-[#a272e0] shrink-0" />
                    <span>Deal Project</span>
                  </th>
                  {activeYearlyData.map((item) => (
                    <td key={item.year} className="py-2 px-3 text-center font-mono font-medium text-slate-700 text-xs">
                      {formatFullRp(item.dealNominal)}
                    </td>
                  ))}
                </tr>

                {/* Row 3: Persentase Nilai Deal */}
                <tr className="bg-slate-50/70 font-semibold hover:bg-slate-100/60 transition">
                  <th scope="row" className="py-2 px-3 text-slate-900 flex items-center gap-2">
                    <span className="h-0.5 w-3 rounded-full bg-slate-600 shrink-0" />
                    <span>Persentase Nilai Deal</span>
                  </th>
                  {activeYearlyData.map((item) => (
                    <td key={item.year} className="py-2 px-3 text-center font-mono font-bold text-slate-900 text-xs">
                      {item.percentageDeal.toFixed(2).replace(".", ",")}%
                    </td>
                  ))}
                </tr>

                {/* Row 4: Berkas Deal */}
                <tr className="text-slate-500 hover:bg-slate-50/50 transition text-[11px]">
                  <th scope="row" className="py-1.5 px-3 font-normal flex items-center gap-1.5 text-slate-500">
                    <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                    <span>Konversi Berkas (SPH → SPK)</span>
                  </th>
                  {activeYearlyData.map((item) => (
                    <td key={item.year} className="py-1.5 px-3 text-center font-mono text-[11px] text-slate-600">
                      {item.dealCount} / {item.penawaranCount} SPH ({item.percentageCount.toFixed(1).replace(".", ",")}%)
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. COMPACT BRANCH PERFORMANCE COMPARISON */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <Building2 size={14} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 sm:text-base">
                Perbandingan Kinerja Antar Cabang
              </h3>
              <p className="text-[11px] text-slate-500">
                Peringkat realisasi penawaran & closing proyek per kantor cabang
              </p>
            </div>
          </div>

          {/* Period Selector: Default current fiscal year (auto-reset per year), or past years */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 text-xs">
            <span className="px-1.5 text-[10px] font-semibold uppercase text-slate-400">Periode:</span>
            {availableYears.map((yr) => {
              const isCurrent = yr === currentYear
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setComparisonYear(yr)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                    comparisonYear === yr
                      ? "bg-white text-emerald-700 shadow-sm border border-slate-200/80 font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {yr} {isCurrent && "(Tahun Berjalan)"}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setComparisonYear("all")}
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                comparisonYear === "all"
                  ? "bg-white text-emerald-700 shadow-sm border border-slate-200/80 font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua Periode
            </button>
          </div>
        </div>

        {/* Sleek, Compact Branch Table */}
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px]">
                <tr>
                  <th scope="col" className="py-2.5 px-3 font-bold uppercase">Cabang</th>
                  <th scope="col" className="py-2.5 px-3 text-right font-bold uppercase">Nilai Penawaran</th>
                  <th scope="col" className="py-2.5 px-3 text-right font-bold uppercase text-purple-700">Deal Project</th>
                  <th scope="col" className="py-2.5 px-3 text-center font-bold uppercase">Rasio Closing</th>
                  <th scope="col" className="py-2.5 px-3 text-center font-bold uppercase">Berkas SPH</th>
                  <th scope="col" className="py-2.5 px-3 text-center font-bold uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branchLeaderboard.map((branch, idx) => {
                  const isTop = idx === 0 && branch.deal > 0
                  const isSelected = selectedBranchId === branch.branchId
                  const palette = branchPalette[branch.branchCode]

                  return (
                    <tr
                      key={branch.branchId}
                      className={`transition ${
                        isSelected
                          ? "bg-blue-50/50 font-semibold"
                          : "hover:bg-slate-50/60"
                      }`}
                    >
                      {/* Branch Name & Code Swatch */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-3 rounded-full border border-white shrink-0 shadow-xs"
                            style={{ backgroundColor: palette?.deal || "#874dcc" }}
                          />
                          <span className="font-semibold text-slate-900">{branch.branchName}</span>
                          <span className="rounded bg-slate-100 px-1 py-0.2 text-[10px] font-mono text-slate-500">
                            {branch.branchCode}
                          </span>
                          {isTop && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.2 text-[9px] font-bold text-amber-700 border border-amber-200/60">
                              <Award size={10} /> Top
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Penawaran */}
                      <td className="py-2 px-3 text-right font-mono font-medium text-slate-700">
                        {formatFullRp(branch.penawaran)}
                      </td>

                      {/* Deal Project */}
                      <td className="py-2 px-3 text-right font-mono font-bold text-purple-900">
                        {formatFullRp(branch.deal)}
                      </td>

                      {/* Conversion Percentage Bar */}
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-emerald-500"
                              style={{ width: `${Math.min(branch.pct, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {branch.pct.toFixed(1).replace(".", ",")}%
                          </span>
                        </div>
                      </td>

                      {/* Document Count */}
                      <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-800">{branch.dealCount}</span>
                        <span className="text-slate-400"> / {branch.penawaranCount}</span>
                      </td>

                      {/* Action Button */}
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedBranchId(branch.branchId)}
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                            isSelected
                              ? "bg-blue-600 text-white"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {isSelected ? "Aktif" : "Filter Kurva"}
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
