"use client"

import { useState } from "react"
import {
  Users,
  Send,
  FileSignature,
  ArrowUpRight,
  Search,
  X,
  ExternalLink,
  FileText,
  TrendingUp,
  Percent,
} from "lucide-react"
import { formatCurrency } from "@/lib/money"
import type { SalesKpiSummary } from "@/lib/director-dashboard"

export function SalesKpiCards({ kpi }: { kpi: SalesKpiSummary }) {
  const [activeModal, setActiveModal] = useState<"clients" | "sph" | "spk" | "conversion" | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const clientList = kpi.clientItems ?? []
  const sphList = kpi.sphItems ?? []
  const spkList = kpi.spkItems ?? []

  // Filter lists based on search query
  const q = searchQuery.toLowerCase().trim()

  const filteredClients = clientList.filter(
    (c) => !q || c.name.toLowerCase().includes(q)
  )

  const filteredSph = sphList.filter(
    (s) =>
      !q ||
      s.sph_number.toLowerCase().includes(q) ||
      s.title.toLowerCase().includes(q) ||
      s.client_name.toLowerCase().includes(q) ||
      s.branch_name.toLowerCase().includes(q)
  )

  const filteredSpk = spkList.filter(
    (k) =>
      !q ||
      k.document_number.toLowerCase().includes(q) ||
      k.title.toLowerCase().includes(q) ||
      k.client_name.toLowerCase().includes(q) ||
      k.branch_name.toLowerCase().includes(q)
  )

  const totalFilteredSphAmount = filteredSph.reduce((sum, s) => sum + s.amount, 0)
  const totalFilteredSpkAmount = filteredSpk.reduce((sum, k) => sum + k.amount, 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Ringkasan Laporan Kinerja Penjualan
          </h3>
          <p className="text-xs text-muted">
            Perbandingan jumlah mitra klien, penawaran SPH yang terkirim, serta realisasi kesepakatan SPK.
            <span className="ml-1 text-brand font-medium">Klik pada setiap box kartu untuk melihat rincian dokumennya.</span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Klien (Clickable) */}
        <div
          onClick={() => {
            setActiveModal("clients")
            setSearchQuery("")
          }}
          className="group cursor-pointer flex items-center justify-between rounded-xl border border-line bg-white p-5 shadow-panel transition-all duration-150 hover:-translate-y-1 hover:shadow-lg hover:border-blue-400"
          title="Klik untuk melihat daftar seluruh mitra klien"
        >
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand group-hover:bg-blue-100 transition-colors">
              <Users size={24} />
            </div>
            <div>
              <span className="text-xs text-muted flex items-center gap-1">
                Jumlah Klien
              </span>
              <p className="text-2xl font-bold text-ink">{kpi.totalClients}</p>
              <span className="text-[11px] text-muted">Mitra bisnis terdaftar</span>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-brand opacity-80 group-hover:opacity-100 flex items-center gap-0.5">
            Rincian <ArrowUpRight className="size-3" />
          </span>
        </div>

        {/* SPH Dikirim (Clickable) */}
        <div
          onClick={() => {
            setActiveModal("sph")
            setSearchQuery("")
          }}
          className="group cursor-pointer flex items-center justify-between rounded-xl border border-line bg-white p-5 shadow-panel transition-all duration-150 hover:-translate-y-1 hover:shadow-lg hover:border-amber-400"
          title="Klik untuk melihat daftar dokumen SPH yang dikirim"
        >
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors">
              <Send size={24} />
            </div>
            <div>
              <span className="text-xs text-muted">SPH Dikirim ke Klien</span>
              <p className="text-2xl font-bold text-ink">{kpi.sphSent}</p>
              <span className="text-[11px] text-muted">Dari total {kpi.totalSph} SPH</span>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-amber-700 opacity-80 group-hover:opacity-100 flex items-center gap-0.5">
            Rincian <ArrowUpRight className="size-3" />
          </span>
        </div>

        {/* Realisasi SPK (Clickable) */}
        <div
          onClick={() => {
            setActiveModal("spk")
            setSearchQuery("")
          }}
          className="group cursor-pointer flex items-center justify-between rounded-xl border border-line bg-white p-5 shadow-panel transition-all duration-150 hover:-translate-y-1 hover:shadow-lg hover:border-emerald-400"
          title="Klik untuk melihat daftar realisasi SPK yang disepakati"
        >
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
              <FileSignature size={24} />
            </div>
            <div>
              <span className="text-xs text-muted">Realisasi Jadi SPK</span>
              <p className="text-2xl font-bold text-ink">{kpi.totalSpk}</p>
              <span className="text-[11px] text-emerald-700">Perintah kerja disepakati</span>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-emerald-700 opacity-80 group-hover:opacity-100 flex items-center gap-0.5">
            Rincian <ArrowUpRight className="size-3" />
          </span>
        </div>

        {/* Rasio Konversi (Clickable) */}
        <div
          onClick={() => {
            setActiveModal("conversion")
            setSearchQuery("")
          }}
          className="group cursor-pointer flex items-center justify-between rounded-xl border border-line bg-white p-5 shadow-panel transition-all duration-150 hover:-translate-y-1 hover:shadow-lg hover:border-purple-400"
          title="Klik untuk melihat analisis corong konversi SPH menjadi SPK"
        >
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
              <Percent size={24} />
            </div>
            <div>
              <span className="text-xs text-muted">Rasio Konversi</span>
              <p className="text-2xl font-bold text-ink">{kpi.conversionRate}%</p>
              <span className="text-[11px] text-muted">SPH berhasil jadi SPK</span>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-purple-700 opacity-80 group-hover:opacity-100 flex items-center gap-0.5">
            Rincian <ArrowUpRight className="size-3" />
          </span>
        </div>
      </div>

      {/* Drill-down Modals */}
      {activeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
          <div
            className="flex flex-col w-full max-w-4xl max-h-[88vh] rounded-2xl bg-white shadow-2xl border border-line overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between p-5 border-b border-line bg-slate-50/70">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-md bg-brand-light text-brand border border-brand/20">
                    Kinerja Penjualan
                  </span>
                  <h3 className="text-base font-bold text-ink">
                    {activeModal === "clients" && `Daftar Mitra Klien Terdaftar (${kpi.totalClients})`}
                    {activeModal === "sph" && `Daftar Dokumen SPH Terkirim (${kpi.sphSent} SPH)`}
                    {activeModal === "spk" && `Daftar Dokumen Realisasi SPK Disepakati (${kpi.totalSpk} SPK)`}
                    {activeModal === "conversion" && `Analisis Konversi Penjualan SPH ke SPK (${kpi.conversionRate}%)`}
                  </h3>
                </div>
                <p className="text-xs text-muted">
                  {activeModal === "clients" && "Seluruh mitra bisnis dan klien yang terdaftar di dalam sistem perusahaan."}
                  {activeModal === "sph" && "Rincian seluruh surat penawaran harga (SPH) yang telah dikirim ke klien."}
                  {activeModal === "spk" && "Rincian surat perintah kerja (SPK) yang telah deal dan disepakati bersama klien."}
                  {activeModal === "conversion" && "Tingkat keberhasilan surat penawaran harga yang terealisasi menjadi kesepakatan kerja."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted hover:bg-slate-200/80 hover:text-ink transition-colors"
                title="Tutup (Esc)"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Search & Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border-b border-line">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-2.5 size-4 text-muted" />
                <input
                  type="text"
                  placeholder="Cari berdasarkan nama, nomor dokumen, atau judul..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-line pl-9 pr-3 py-1.5 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
                />
              </div>
              {activeModal === "sph" && (
                <div className="text-right">
                  <span className="text-xs text-muted">Total Penawaran:</span>{" "}
                  <span className="text-sm font-bold text-ink">{formatCurrency(totalFilteredSphAmount)}</span>
                </div>
              )}
              {activeModal === "spk" && (
                <div className="text-right">
                  <span className="text-xs text-muted">Total Kontrak SPK:</span>{" "}
                  <span className="text-sm font-bold text-emerald-800">{formatCurrency(totalFilteredSpkAmount)}</span>
                </div>
              )}
              {activeModal === "clients" && (
                <a
                  href="/pengajuan/penjualan/klien"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-brand/30 bg-brand-light px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand hover:text-white transition-colors"
                >
                  Buka Direktori Klien <ExternalLink className="size-3" />
                </a>
              )}
            </div>

            {/* Modal Content Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* 1. Modal Clients */}
              {activeModal === "clients" && (
                <div className="rounded-xl border border-line overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-canvas text-muted border-b border-line">
                      <tr>
                        <th scope="col" className="p-3 font-semibold">No.</th>
                        <th scope="col" className="p-3 font-semibold">Nama Mitra Klien / Perusahaan</th>
                        <th scope="col" className="p-3 font-semibold">Tanggal Terdaftar</th>
                        <th scope="col" className="p-3 text-center font-semibold">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filteredClients.map((client, idx) => (
                        <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono text-muted">{idx + 1}</td>
                          <td className="p-3 font-bold text-ink">{client.name}</td>
                          <td className="p-3 text-muted">{client.created_at || "-"}</td>
                          <td className="p-3 text-center">
                            <a
                              href="/pengajuan/penjualan/klien"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-brand hover:text-white transition-colors"
                            >
                              Detail Klien <ExternalLink className="size-3" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 2. Modal SPH */}
              {activeModal === "sph" && (
                <div className="rounded-xl border border-line overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-canvas text-muted border-b border-line">
                      <tr>
                        <th scope="col" className="p-3 font-semibold">Nomor SPH</th>
                        <th scope="col" className="p-3 font-semibold">Judul / Lingkup Pekerjaan</th>
                        <th scope="col" className="p-3 font-semibold">Mitra Klien</th>
                        <th scope="col" className="p-3 font-semibold">Cabang</th>
                        <th scope="col" className="p-3 font-semibold">Status</th>
                        <th scope="col" className="p-3 text-right font-semibold">Nilai Penawaran</th>
                        <th scope="col" className="p-3 text-center font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filteredSph.map((sph) => (
                        <tr key={sph.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-brand">{sph.sph_number}</td>
                          <td className="p-3 font-medium text-ink max-w-[220px] truncate">{sph.title}</td>
                          <td className="p-3 text-muted">{sph.client_name}</td>
                          <td className="p-3 text-muted">{sph.branch_name}</td>
                          <td className="p-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {sph.status}
                            </span>
                          </td>
                          <td className="p-3 text-right font-bold text-ink">{formatCurrency(sph.amount)}</td>
                          <td className="p-3 text-center">
                            <a
                              href={`/pengajuan/penjualan/sph/${sph.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-brand-light px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-brand hover:text-white transition-colors"
                            >
                              Buka SPH <ExternalLink className="size-3" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 3. Modal SPK */}
              {activeModal === "spk" && (
                <div className="rounded-xl border border-line overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-canvas text-muted border-b border-line">
                      <tr>
                        <th scope="col" className="p-3 font-semibold">Nomor SPK</th>
                        <th scope="col" className="p-3 font-semibold">Judul Pekerjaan</th>
                        <th scope="col" className="p-3 font-semibold">Mitra Klien</th>
                        <th scope="col" className="p-3 font-semibold">Cabang</th>
                        <th scope="col" className="p-3 font-semibold">Status</th>
                        <th scope="col" className="p-3 text-right font-semibold">Nilai Kontrak</th>
                        <th scope="col" className="p-3 text-center font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filteredSpk.map((spk) => (
                        <tr key={spk.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-emerald-800">{spk.document_number}</td>
                          <td className="p-3 font-medium text-ink max-w-[220px] truncate">{spk.title}</td>
                          <td className="p-3 text-muted">{spk.client_name}</td>
                          <td className="p-3 text-muted">{spk.branch_name}</td>
                          <td className="p-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {spk.status}
                            </span>
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-800">{formatCurrency(spk.amount)}</td>
                          <td className="p-3 text-center">
                            <a
                              href={`/pengajuan/penjualan/spk/${spk.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-700 hover:text-white transition-colors"
                            >
                              Buka SPK <ExternalLink className="size-3" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 4. Modal Konversi (Funnel) */}
              {activeModal === "conversion" && (
                <div className="space-y-4">
                  {/* Corong Rasio */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-line bg-slate-50 p-4 text-center">
                      <span className="text-xs text-muted block">Total SPH Terkirim</span>
                      <span className="text-2xl font-bold text-ink mt-1 block">{kpi.sphSent}</span>
                      <span className="text-[11px] text-muted">100% Penawaran</span>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center">
                      <span className="text-xs text-emerald-700 block">Realisasi Disepakati (Deal SPK)</span>
                      <span className="text-2xl font-bold text-emerald-800 mt-1 block">{kpi.totalSpk}</span>
                      <span className="text-[11px] font-semibold text-emerald-700">{kpi.conversionRate}% Tingkat Deal</span>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-center">
                      <span className="text-xs text-amber-700 block">Dalam Negosiasi / Belum Deal</span>
                      <span className="text-2xl font-bold text-amber-800 mt-1 block">
                        {Math.max(0, kpi.sphSent - kpi.totalSpk)}
                      </span>
                      <span className="text-[11px] font-semibold text-amber-700">
                        {100 - kpi.conversionRate}% Perlu Tindak Lanjut
                      </span>
                    </div>
                  </div>

                  {/* Tabel Perbandingan SPH Deal vs Belum Deal */}
                  <div className="rounded-xl border border-line overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-canvas text-muted border-b border-line">
                        <tr>
                          <th scope="col" className="p-3 font-semibold">Nomor Dokumen</th>
                          <th scope="col" className="p-3 font-semibold">Judul Pekerjaan</th>
                          <th scope="col" className="p-3 font-semibold">Klien</th>
                          <th scope="col" className="p-3 font-semibold">Tahap</th>
                          <th scope="col" className="p-3 text-right font-semibold">Nilai</th>
                          <th scope="col" className="p-3 text-center font-semibold">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {filteredSph.map((sph) => {
                          const isDeal = spkList.some(
                            (k) =>
                              k.document_number.includes(sph.sph_number.replace(/\D/g, "")) ||
                              k.title.toLowerCase().includes(sph.title.toLowerCase().slice(0, 15))
                          )
                          return (
                            <tr key={sph.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 font-mono font-bold text-brand">{sph.sph_number}</td>
                              <td className="p-3 font-medium text-ink max-w-[220px] truncate">{sph.title}</td>
                              <td className="p-3 text-muted">{sph.client_name}</td>
                              <td className="p-3">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    isDeal
                                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                      : "bg-amber-50 text-amber-800 border border-amber-200"
                                  }`}
                                >
                                  {isDeal ? "✓ Realisasi SPK" : "Negosiasi / SPH"}
                                </span>
                              </td>
                              <td className="p-3 text-right font-bold text-ink">{formatCurrency(sph.amount)}</td>
                              <td className="p-3 text-center">
                                <a
                                  href={`/pengajuan/penjualan/sph/${sph.id}`}
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
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-line bg-slate-50 text-xs text-muted">
              <span>
                {activeModal === "clients" && `Menampilkan ${filteredClients.length} dari ${clientList.length} mitra klien`}
                {activeModal === "sph" && `Menampilkan ${filteredSph.length} dari ${sphList.length} dokumen penawaran SPH`}
                {activeModal === "spk" && `Menampilkan ${filteredSpk.length} dari ${spkList.length} dokumen realisasi SPK`}
                {activeModal === "conversion" && `Rasio ${kpi.conversionRate}% dari total ${kpi.sphSent} SPH`}
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
    </div>
  )
}
