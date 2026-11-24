"use client"

import React, { useState } from "react"
import { Receipt, PlusCircle, CheckCircle2, Clock, XCircle, FileText, UploadCloud, AlertCircle } from "lucide-react"
import { submitReimbursementAction } from "@/app/(workspace)/modul/hr-actions"

export interface MyReimbursementItem {
  id: string
  title: string
  category: "transport" | "accommodation" | "meals" | "field_supplies" | "others"
  amount: number
  expense_date: string
  receipt_url: string | null
  description: string | null
  status: "draft" | "submitted" | "approved_hr" | "paid" | "rejected"
  review_note: string | null
  created_at: string
}

interface MyReimbursementViewProps {
  reimbursements: MyReimbursementItem[]
  projects: Array<{ id: string; name: string }>
  userName: string
}

export function MyReimbursementView({ reimbursements, projects, userName }: MyReimbursementViewProps) {
  const [showModal, setShowModal] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  const totalSubmitted = reimbursements.reduce((sum, item) => sum + item.amount, 0)
  const totalPaid = reimbursements
    .filter((item) => item.status === "paid")
    .reduce((sum, item) => sum + item.amount, 0)
  const totalPending = reimbursements
    .filter((item) => item.status === "submitted" || item.status === "approved_hr")
    .reduce((sum, item) => sum + item.amount, 0)

  const filtered = reimbursements.filter((item) => {
    if (categoryFilter === "all") return true
    return item.category === categoryFilter
  })

  function getCategoryLabel(cat: string) {
    switch (cat) {
      case "transport":
        return "Bensin / Tol / Transport"
      case "accommodation":
        return "Penginapan / Mess Site"
      case "meals":
        return "Uang Makan Lapangan"
      case "field_supplies":
        return "Material & Alat Kerja Lapangan"
      default:
        return "Operasional Lainnya"
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 size={12} /> Dicairkan Keuangan
          </span>
        )
      case "approved_hr":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <CheckCircle2 size={12} /> Disetujui HR
          </span>
        )
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            <XCircle size={12} /> Ditolak
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <Clock size={12} /> Menunggu Verifikasi
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-ink">Klaim Reimbursement Operasional ({userName})</h2>
          <p className="text-xs text-muted">
            Penggantian biaya pribadi untuk transportasi, logistik, penginapan site, dan keperluan operasional proyek.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition"
        >
          <PlusCircle size={15} />
          <span>Ajukan Klaim Baru</span>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm dark:bg-slate-900">
          <p className="text-xs text-muted">Total Klaim Diajukan</p>
          <p className="text-lg font-bold text-ink mt-1">Rp {totalSubmitted.toLocaleString("id-ID")}</p>
          <p className="text-[11px] text-muted mt-0.5">{reimbursements.length} transaksi tahun berjalan</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm dark:bg-slate-900">
          <p className="text-xs text-muted">Klaim Sedang Diproses</p>
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
            Rp {totalPending.toLocaleString("id-ID")}
          </p>
          <p className="text-[11px] text-muted mt-0.5">Menunggu approval HR & pencairan Kasir</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm dark:bg-slate-900">
          <p className="text-xs text-muted">Total Berhasil Dicairkan</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            Rp {totalPaid.toLocaleString("id-ID")}
          </p>
          <p className="text-[11px] text-muted mt-0.5">Sudah ditransfer ke rekening karyawan</p>
        </div>
      </div>

      {/* Filter Kategori */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="font-semibold text-muted shrink-0">Filter:</span>
        {["all", "transport", "accommodation", "meals", "field_supplies", "others"].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              categoryFilter === cat
                ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                : "bg-slate-100 text-muted hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {cat === "all" ? "Semua Kategori" : getCategoryLabel(cat)}
          </button>
        ))}
      </div>

      {/* Tabel Riwayat Klaim */}
      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-muted dark:bg-slate-800">
            <tr>
              <th scope="col" className="p-3 font-semibold">Tgl Transaksi</th>
              <th scope="col" className="p-3 font-semibold">Uraian / Keperluan</th>
              <th scope="col" className="p-3 font-semibold">Kategori</th>
              <th scope="col" className="p-3 font-semibold text-right">Nominal (Rp)</th>
              <th scope="col" className="p-3 font-semibold">Bukti Nota</th>
              <th scope="col" className="p-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted">
                  Belum ada riwayat klaim reimbursement. Klik tombol &quot;Ajukan Klaim Baru&quot; di atas untuk mengajukan.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 whitespace-nowrap text-muted font-medium">{item.expense_date}</td>
                  <td className="p-3 font-semibold text-ink">
                    {item.title}
                    {item.description && <p className="text-[11px] font-normal text-muted mt-0.5">{item.description}</p>}
                    {item.review_note && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">Catatan HR: {item.review_note}</p>
                    )}
                  </td>
                  <td className="p-3 text-muted">{getCategoryLabel(item.category)}</td>
                  <td className="p-3 text-right font-mono font-bold text-ink">
                    Rp {item.amount.toLocaleString("id-ID")}
                  </td>
                  <td className="p-3">
                    {item.receipt_url ? (
                      <a
                        href={item.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-brand hover:underline font-medium"
                      >
                        <FileText size={13} />
                        <span>Lihat Bukti</span>
                      </a>
                    ) : (
                      <span className="text-muted text-[11px]">-</span>
                    )}
                  </td>
                  <td className="p-3">{getStatusBadge(item.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Pengajuan Klaim Baru */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="text-brand" size={18} />
                <h3 className="font-bold text-ink text-sm">Form Pengajuan Reimbursement Lapangan</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-muted hover:text-ink text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form action={submitReimbursementAction} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-ink mb-1">Judul / Keperluan Pengeluaran *</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="Contoh: Bensin & Tol Site Cilegon Kunjungan Pertama"
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Kategori Biaya *</label>
                  <select
                    name="category"
                    required
                    className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                  >
                    <option value="transport">Bensin / Tol / Transport</option>
                    <option value="accommodation">Penginapan / Mess Lapangan</option>
                    <option value="meals">Uang Makan Lembur Site</option>
                    <option value="field_supplies">Material & Alat Lapangan</option>
                    <option value="others">Operasional Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Tanggal Transaksi *</label>
                  <input
                    type="date"
                    name="expense_date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Nominal (Rp) *</label>
                  <input
                    type="number"
                    name="amount"
                    required
                    min={1000}
                    step={1000}
                    placeholder="Contoh: 150000"
                    className="w-full rounded-xl border border-line bg-surface p-2.5 font-mono text-ink outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Proyek Terkait (Opsional)</label>
                  <select
                    name="project_id"
                    className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                  >
                    <option value="">-- Bebas / Non-Proyek Khusus --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Link Foto Bukti Struk / Nota *</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    name="receipt_url"
                    placeholder="https://drive.google.com/... atau link foto struk"
                    className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                  />
                </div>
                <p className="text-[10px] text-muted mt-1">
                  Lampirkan foto struk pembayaran, bensin, atau bukti transfer agar tim Keuangan dapat memverifikasi.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Catatan Tambahan</label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Keterangan rute perjalanan dinas atau penjelasan pengeluaran..."
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-line px-4 py-2 font-medium text-muted hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-brand px-5 py-2 font-semibold text-white shadow-sm hover:opacity-90 transition"
                >
                  Kirim Pengajuan Klaim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
