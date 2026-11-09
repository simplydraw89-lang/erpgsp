"use client"

import { useState } from "react"
import { formatCurrency } from "@/lib/money"
import {
  Building2,
  Layers,
  ArrowUpRight,
  Search,
  X,
  ExternalLink,
  FileText,
  Receipt,
  Wallet,
  DollarSign,
  TrendingUp,
  Percent,
} from "lucide-react"
import type { BranchFinancialSummary, DrilldownDetailItem } from "@/lib/director-dashboard"

export function BranchReportView({
  consolidated,
  byBranch,
}: {
  consolidated: BranchFinancialSummary
  byBranch: BranchFinancialSummary[]
}) {
  const [selectedBranchId, setSelectedBranchId] = useState<string>("company-wide")
  const [activeModal, setActiveModal] = useState<{
    category: "cashBank" | "omzet" | "utang" | "piutang" | "ppnMasukan" | "ppnKeluaran" | "pph"
    title: string
    description: string
    badgeColor: string
  } | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const selectedData =
    selectedBranchId === "company-wide"
      ? consolidated
      : byBranch.find((b) => b.branchId === selectedBranchId) ?? consolidated

  const currentItems: DrilldownDetailItem[] = activeModal
    ? selectedData.drilldown?.[activeModal.category] ?? []
    : []

  const filteredItems = currentItems.filter((item) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      item.documentNumber.toLowerCase().includes(q) ||
      item.title.toLowerCase().includes(q) ||
      item.counterpartyName.toLowerCase().includes(q) ||
      item.branchName.toLowerCase().includes(q)
    )
  })

  const totalFilteredAmount = filteredItems.reduce((acc, curr) => acc + curr.amount, 0)

  return (
    <div className="space-y-6">
      {/* Selector Cabang vs Konsolidasi Perusahaan */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Ringkasan Laporan Keuangan</h2>
          <p className="mt-1 text-xs text-muted">
            Bandingkan performa keuangan antar cabang dan konsolidasi seluruh perusahaan.
            <span className="ml-1 text-brand font-medium">Klik pada setiap box kartu untuk melihat rincian dokumen pengajuannya.</span>
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

      {/* Primary KPI Grid for Selected Scope (Interactive Clickable Cards) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Kas & Bank */}
        <div
          onClick={() => {
            setActiveModal({
              category: "cashBank",
              title: "Rincian Kas & Bank (Likuiditas Operasional)",
              description: "Saldo operasional kas dan rekening bank aktif",
              badgeColor: "bg-slate-100 text-slate-800 border-slate-200",
            })
            setSearchQuery("")
          }}
          className="group cursor-pointer rounded-xl border border-line bg-white p-5 shadow-panel transition-all duration-150 hover:-translate-y-1 hover:shadow-lg hover:border-slate-400"
          title="Klik untuk membuka rincian akun kas & bank"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Wallet className="size-3.5 text-slate-500" /> Kas & Bank
            </span>
            <span className="text-[10px] font-semibold text-brand opacity-80 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              Rincian <ArrowUpRight className="size-3" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-ink">
            {formatCurrency(selectedData.cashBank)}
          </p>
          <div className="mt-1 flex items-center justify-between text-xs text-muted">
            <span>Likuiditas saldo operasional</span>
            <span className="text-[11px] text-brand font-medium group-hover:underline">Buka rincian ↗</span>
          </div>
        </div>

        {/* Omzet / Pendapatan */}
        <div
          onClick={() => {
            setActiveModal({
              category: "omzet",
              title: "Rincian Omzet (Realisasi SPH & SPK)",
              description: "Daftar kontrak kerja proyek dan penawaran deal yang membentuk pendapatan",
              badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
            })
            setSearchQuery("")
          }}
          className="group cursor-pointer rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-panel transition-all duration-150 hover:-translate-y-1 hover:shadow-lg hover:border-emerald-400 hover:bg-emerald-50/80"
          title="Klik untuk membuka rincian dokumen SPH & SPK"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-emerald-600" /> Omzet (Pendapatan)
            </span>
            <span className="text-[10px] font-semibold text-emerald-700 opacity-80 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              Rincian <ArrowUpRight className="size-3" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-800">
            {formatCurrency(selectedData.omzet)}
          </p>
          <div className="mt-1 flex items-center justify-between text-xs text-emerald-600">
            <span>Realisasi SPH & SPK</span>
            <span className="text-[11px] font-medium group-hover:underline">Buka rincian ↗</span>
          </div>
        </div>

        {/* Utang Usaha */}
        <div
          onClick={() => {
            setActiveModal({
              category: "utang",
              title: "Rincian Utang Usaha (Kewajiban Vendor)",
              description: "Daftar tagihan pengajuan pembelian vendor yang belum selesai dibayar",
              badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
            })
            setSearchQuery("")
          }}
          className="group cursor-pointer rounded-xl border border-rose-200 bg-rose-50/50 p-5 shadow-panel transition-all duration-150 hover:-translate-y-1 hover:shadow-lg hover:border-rose-400 hover:bg-rose-50/80"
          title="Klik untuk membuka rincian pengajuan pembelian vendor"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
              <Receipt className="size-3.5 text-rose-600" /> Utang Usaha
            </span>
            <span className="text-[10px] font-semibold text-rose-700 opacity-80 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              Rincian <ArrowUpRight className="size-3" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-800">
            {formatCurrency(selectedData.utang)}
          </p>
          <div className="mt-1 flex items-center justify-between text-xs text-rose-600">
            <span>Kewajiban vendor belum dibayar</span>
            <span className="text-[11px] font-medium group-hover:underline">Buka rincian ↗</span>
          </div>
        </div>

        {/* Piutang Usaha */}
        <div
          onClick={() => {
            setActiveModal({
              category: "piutang",
              title: "Rincian Piutang Usaha (Tagihan Klien)",
              description: "Daftar invoice termin penagihan klien yang belum lunas",
              badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
            })
            setSearchQuery("")
          }}
          className="group cursor-pointer rounded-xl border border-blue-200 bg-blue-50/50 p-5 shadow-panel transition-all duration-150 hover:-translate-y-1 hover:shadow-lg hover:border-blue-400 hover:bg-blue-50/80"
          title="Klik untuk membuka rincian tagihan invoice klien"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
              <DollarSign className="size-3.5 text-blue-600" /> Piutang Usaha
            </span>
            <span className="text-[10px] font-semibold text-blue-700 opacity-80 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              Rincian <ArrowUpRight className="size-3" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-800">
            {formatCurrency(selectedData.piutang)}
          </p>
          <div className="mt-1 flex items-center justify-between text-xs text-blue-600">
            <span>Tagihan klien berjalan</span>
            <span className="text-[11px] font-medium group-hover:underline">Buka rincian ↗</span>
          </div>
        </div>
      </div>

      {/* Pajak Breakdown Card (Clickable Boxes) */}
      <div className="rounded-xl border border-line bg-white p-5 shadow-panel">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-ink">Rincian Perpajakan ({selectedData.branchName})</h3>
            <p className="mt-1 text-xs text-muted">
              Pajak Pertambahan Nilai (PPN Masukan, PPN Keluaran) dan Pajak Penghasilan (PPh).
            </p>
          </div>
          <span className="hidden sm:inline-block text-[11px] text-muted italic">
            Klik masing-masing jenis pajak untuk membuka daftar faktur & bukti potong ↗
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {/* PPN Masukan */}
          <div
            onClick={() => {
              setActiveModal({
                category: "ppnMasukan",
                title: "Rincian PPN Masukan (11%)",
                description: "Faktur pajak masukan dari pengajuan pembelian barang & jasa vendor",
                badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
              })
              setSearchQuery("")
            }}
            className="group cursor-pointer rounded-lg border border-line bg-canvas p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-300 hover:bg-white"
            title="Klik untuk membuka rincian PPN Masukan"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted flex items-center gap-1">
                <Percent className="size-3 text-indigo-600" /> PPN Masukan
              </span>
              <span className="text-[10px] font-semibold text-indigo-700 opacity-80 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                Rincian <ArrowUpRight className="size-3" />
              </span>
            </div>
            <p className="mt-1 text-lg font-bold text-ink">
              {formatCurrency(selectedData.pajak.ppnMasukan)}
            </p>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
              <span>Pajak masukan pembelian</span>
              <span className="text-brand font-medium group-hover:underline">Buka data ↗</span>
            </div>
          </div>

          {/* PPN Keluaran */}
          <div
            onClick={() => {
              setActiveModal({
                category: "ppnKeluaran",
                title: "Rincian PPN Keluaran (11%)",
                description: "Faktur pajak keluaran atas penyerahan jasa konsultansi & teknis ke klien",
                badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
              })
              setSearchQuery("")
            }}
            className="group cursor-pointer rounded-lg border border-line bg-canvas p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-300 hover:bg-white"
            title="Klik untuk membuka rincian PPN Keluaran"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted flex items-center gap-1">
                <Percent className="size-3 text-indigo-600" /> PPN Keluaran
              </span>
              <span className="text-[10px] font-semibold text-indigo-700 opacity-80 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                Rincian <ArrowUpRight className="size-3" />
              </span>
            </div>
            <p className="mt-1 text-lg font-bold text-ink">
              {formatCurrency(selectedData.pajak.ppnKeluaran)}
            </p>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
              <span>Pajak penyerahan jasa</span>
              <span className="text-brand font-medium group-hover:underline">Buka data ↗</span>
            </div>
          </div>

          {/* PPh */}
          <div
            onClick={() => {
              setActiveModal({
                category: "pph",
                title: "Rincian Pajak Penghasilan (PPh)",
                description: "Daftar pemotongan PPh 21, PPh 23, dan PPh Final atas transaksi rekanan",
                badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
              })
              setSearchQuery("")
            }}
            className="group cursor-pointer rounded-lg border border-line bg-canvas p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-amber-300 hover:bg-white"
            title="Klik untuk membuka rincian pemotongan PPh"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted flex items-center gap-1">
                <Percent className="size-3 text-amber-600" /> Pajak Penghasilan (PPh)
              </span>
              <span className="text-[10px] font-semibold text-amber-800 opacity-80 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                Rincian <ArrowUpRight className="size-3" />
              </span>
            </div>
            <p className="mt-1 text-lg font-bold text-ink">
              {formatCurrency(selectedData.pajak.pph)}
            </p>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
              <span>PPh 21, PPh 23, & Final</span>
              <span className="text-brand font-medium group-hover:underline">Buka data ↗</span>
            </div>
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

      {/* Drill-down Modal Detail */}
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
            {/* Header Modal */}
            <div className="flex items-start justify-between p-5 border-b border-line bg-slate-50/70">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-md border ${activeModal.badgeColor}`}
                  >
                    {selectedData.branchName}
                  </span>
                  <h3 className="text-base font-bold text-ink">{activeModal.title}</h3>
                </div>
                <p className="text-xs text-muted">{activeModal.description}</p>
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

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border-b border-line">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-2.5 size-4 text-muted" />
                <input
                  type="text"
                  placeholder="Cari berdasarkan No. Dokumen, Rekanan, atau Judul..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-line pl-9 pr-3 py-1.5 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
                />
              </div>
              <div className="text-right">
                <span className="text-xs text-muted">Total Terhitung:</span>{" "}
                <span className="text-sm font-bold text-ink">{formatCurrency(totalFilteredAmount)}</span>
              </div>
            </div>

            {/* Daftar Transaksi / Rincian Dokumen */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredItems.length === 0 ? (
                <div className="p-12 text-center text-muted">
                  <FileText className="mx-auto size-10 text-slate-300 stroke-1 mb-2" />
                  <p className="text-sm font-medium text-ink">Tidak ada transaksi yang sesuai</p>
                  <p className="text-xs mt-1">
                    {searchQuery
                      ? `Tidak ditemukan dokumen yang cocok dengan kata kunci "${searchQuery}".`
                      : "Belum ada dokumen transaksi tercatat dalam kategori ini."}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-line overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-canvas text-muted border-b border-line">
                      <tr>
                        <th scope="col" className="p-3 font-semibold">No. Dokumen / Judul</th>
                        <th scope="col" className="p-3 font-semibold">Rekanan (Klien / Vendor)</th>
                        <th scope="col" className="p-3 font-semibold">Cabang</th>
                        <th scope="col" className="p-3 font-semibold">Tanggal</th>
                        <th scope="col" className="p-3 font-semibold">Status</th>
                        <th scope="col" className="p-3 text-right font-semibold">Nominal (Rp)</th>
                        <th scope="col" className="p-3 text-center font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filteredItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3">
                            <span className="font-mono font-bold text-ink block">{item.documentNumber}</span>
                            <span className="text-[11px] text-muted line-clamp-1 mt-0.5">{item.title}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-medium text-ink block">{item.counterpartyName}</span>
                          </td>
                          <td className="p-3 text-muted">{item.branchName}</td>
                          <td className="p-3 text-muted">
                            {item.date}
                            {item.dueDate && (
                              <span className="block text-[10px] text-rose-700">
                                JT: {item.dueDate}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {item.statusLabel}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <span className="font-bold text-ink block">
                              {formatCurrency(item.amount)}
                            </span>
                            {item.secondaryAmount !== undefined && (
                              <span className="text-[10px] text-muted block mt-0.5">
                                {item.secondaryLabel ?? "Dasar"}: {formatCurrency(item.secondaryAmount)}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <a
                              href={item.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-brand-light px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-brand hover:text-white transition-colors"
                              title="Buka detail pengajuan di tab baru"
                            >
                              Buka <ExternalLink className="size-3" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-between p-4 border-t border-line bg-slate-50 text-xs text-muted">
              <span>Menampilkan {filteredItems.length} dari total {currentItems.length} data dokumen</span>
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
