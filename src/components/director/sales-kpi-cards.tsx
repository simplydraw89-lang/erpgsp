import { Users, Send, FileSignature, ArrowUpRight } from "lucide-react"
import type { SalesKpiSummary } from "@/lib/director-dashboard"

export function SalesKpiCards({ kpi }: { kpi: SalesKpiSummary }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Ringkasan Laporan Kinerja Penjualan
        </h3>
        <p className="text-xs text-muted">
          Perbandingan jumlah mitra klien, penawaran SPH yang terkirim, serta realisasi kesepakatan SPK.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Klien */}
        <div className="flex items-center gap-4 rounded-xl border border-line bg-white p-5 shadow-panel">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand">
            <Users size={24} />
          </div>
          <div>
            <span className="text-xs text-muted">Jumlah Klien</span>
            <p className="text-2xl font-bold text-ink">{kpi.totalClients}</p>
            <span className="text-[11px] text-muted">Mitra bisnis terdaftar</span>
          </div>
        </div>

        {/* SPH Dikirim */}
        <div className="flex items-center gap-4 rounded-xl border border-line bg-white p-5 shadow-panel">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Send size={24} />
          </div>
          <div>
            <span className="text-xs text-muted">SPH Dikirim ke Klien</span>
            <p className="text-2xl font-bold text-ink">{kpi.sphSent}</p>
            <span className="text-[11px] text-muted">Dari total {kpi.totalSph} SPH</span>
          </div>
        </div>

        {/* Realisasi SPK */}
        <div className="flex items-center gap-4 rounded-xl border border-line bg-white p-5 shadow-panel">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <FileSignature size={24} />
          </div>
          <div>
            <span className="text-xs text-muted">Realisasi Jadi SPK</span>
            <p className="text-2xl font-bold text-ink">{kpi.totalSpk}</p>
            <span className="text-[11px] text-emerald-700">Perintah kerja disepakati</span>
          </div>
        </div>

        {/* Rasio Konversi */}
        <div className="flex items-center gap-4 rounded-xl border border-line bg-white p-5 shadow-panel">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <ArrowUpRight size={24} />
          </div>
          <div>
            <span className="text-xs text-muted">Rasio Konversi</span>
            <p className="text-2xl font-bold text-ink">{kpi.conversionRate}%</p>
            <span className="text-[11px] text-muted">SPH berhasil jadi SPK</span>
          </div>
        </div>
      </div>
    </div>
  )
}
