"use client"

import { useState } from "react"
import { formatCurrency } from "@/lib/money"

type HistoricalData = {
  year: number
  omzet: number
  beban: number
  labaBersih: number
}

export function HistoricalFinancialChart({ data }: { data: HistoricalData[] }) {
  const [metric, setMetric] = useState<"omzet" | "beban" | "labaBersih">("omzet")

  // Find max value for bar height scaling
  const maxValue = Math.max(...data.map((d) => d[metric]), 1000000)

  const labels = {
    omzet: "Omzet (Pendapatan)",
    beban: "Beban / Pengeluaran",
    labaBersih: "Estimasi Laba Bersih",
  }

  const metricColors = {
    omzet: {
      bar: "bg-emerald-500",
      light: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
    },
    beban: {
      bar: "bg-rose-500",
      light: "bg-rose-50",
      text: "text-rose-700",
      border: "border-rose-200",
    },
    labaBersih: {
      bar: "bg-sky-500",
      light: "bg-sky-50",
      text: "text-sky-700",
      border: "border-sky-200",
    },
  }

  const activeColor = metricColors[metric]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">Grafik Perbandingan 3 Tahun Terakhir</h3>
          <p className="mt-1 text-xs text-muted">
            Menampilkan data tren per tahun fiskal (data akan menyesuaikan sistem, tercatat 0 jika belum ada transaksi).
          </p>
        </div>
        <div className="flex rounded-lg border border-line bg-canvas p-1 text-xs font-medium">
          {(["omzet", "beban", "labaBersih"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`rounded-md px-3 py-1.5 transition ${
                metric === m
                  ? "bg-white font-semibold text-brand shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              {m === "omzet" ? "Omzet" : m === "beban" ? "Beban" : "Laba"}
            </button>
          ))}
        </div>
      </div>

      {/* Diagram Batang Interaktif SVG / Flex */}
      <div className="rounded-xl border border-line bg-slate-50/60 p-5">
        <div className="mb-4 flex items-center justify-between text-xs text-muted">
          <span className="font-semibold">{labels[metric]}</span>
          <span>Maksimal: {formatCurrency(maxValue)}</span>
        </div>

        <div className="grid grid-cols-3 gap-6 pt-4">
          {data.map((item) => {
            const val = item[metric]
            const heightPct = Math.max(8, Math.min(100, Math.round((val / maxValue) * 100)))

            return (
              <div key={item.year} className="flex flex-col items-center">
                {/* Nominal Text */}
                <div className="mb-2 text-center">
                  <span className="text-xs font-semibold text-ink sm:text-sm">
                    {val === 0 ? "Rp 0" : formatCurrency(val)}
                  </span>
                </div>

                {/* Bar Container */}
                <div className="relative flex h-48 w-full max-w-[120px] items-end justify-center rounded-xl bg-slate-200/50 p-2">
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-lg transition-all duration-500 ease-out shadow-sm ${activeColor.bar}`}
                  />
                </div>

                {/* Year Label */}
                <span className="mt-3 text-sm font-bold text-ink">Tahun {item.year}</span>
                <span className="text-[11px] text-muted">
                  {val === 0 ? "Belum ada catatan" : "Terealisasi"}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
