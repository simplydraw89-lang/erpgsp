"use client"

import React, { useState } from "react"
import { CheckCircle2, XCircle, Clock, CalendarDays, Filter, User, AlertCircle } from "lucide-react"
import { reviewLeaveRequestAction } from "@/app/(workspace)/modul/hr-actions"

export interface ManagementLeaveRequestItem {
  id: string
  employee_name: string
  leave_type: string
  starts_on: string
  ends_on: string
  total_days: number
  reason: string
  status: "submitted" | "approved" | "rejected" | "cancelled"
  created_at: string
}

interface ManagementLeaveApprovalViewProps {
  requests: ManagementLeaveRequestItem[]
}

export function ManagementLeaveApprovalView({ requests }: ManagementLeaveApprovalViewProps) {
  const [filterStatus, setFilterStatus] = useState<string>("submitted")
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState<string>("")

  const pendingList = requests.filter((r) => r.status === "submitted")
  const filtered = requests.filter((r) => {
    if (filterStatus === "all") return true
    return r.status === filterStatus
  })

  function getLeaveTypeLabel(type: string) {
    switch (type) {
      case "annual":
        return "Cuti Tahunan"
      case "sick":
        return "Sakit (Surat Dokter)"
      case "important":
        return "Izin Alasan Penting"
      case "maternity":
        return "Cuti Melahirkan"
      case "unpaid":
        return "Cuti di Luar Tanggungan"
      default:
        return type
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-ink">Approval Pengajuan Cuti Seluruh Karyawan</h2>
          <p className="text-xs text-muted">
            Otoritas persetujuan cuti dan izin kerja staf seluruh cabang (Jakarta, Surabaya, Jogjakarta).
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-muted">Status:</span>
          {["submitted", "approved", "rejected", "all"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                filterStatus === st
                  ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                  : "bg-slate-100 text-muted hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {st === "submitted"
                ? `Menunggu (${pendingList.length})`
                : st === "approved"
                ? "Disetujui"
                : st === "rejected"
                ? "Ditolak"
                : "Semua"}
            </button>
          ))}
        </div>
      </div>

      {/* Grid or Table Requests */}
      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-muted dark:bg-slate-800">
            <tr>
              <th scope="col" className="p-3 font-semibold">Nama Karyawan</th>
              <th scope="col" className="p-3 font-semibold">Jenis Cuti</th>
              <th scope="col" className="p-3 font-semibold">Rentang Tanggal</th>
              <th scope="col" className="p-3 font-semibold">Durasi</th>
              <th scope="col" className="p-3 font-semibold">Alasan</th>
              <th scope="col" className="p-3 font-semibold text-right">Aksi HR / Direksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted">
                  Tidak ada pengajuan cuti dalam kategori ini.
                </td>
              </tr>
            ) : (
              filtered.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-bold text-ink whitespace-nowrap">{req.employee_name}</td>
                  <td className="p-3">
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {getLeaveTypeLabel(req.leave_type)}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap text-muted">
                    {req.starts_on} s/d {req.ends_on}
                  </td>
                  <td className="p-3 font-semibold text-ink">{req.total_days} Hari</td>
                  <td className="p-3 text-muted max-w-xs">{req.reason}</td>
                  <td className="p-3 text-right">
                    {req.status === "submitted" ? (
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <form action={reviewLeaveRequestAction} className="inline">
                          <input type="hidden" name="request_id" value={req.id} />
                          <input type="hidden" name="decision" value="approved" />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                          >
                            <CheckCircle2 size={13} />
                            <span>Setujui</span>
                          </button>
                        </form>
                        <button
                          type="button"
                          onClick={() => setRejectingId(req.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 transition"
                        >
                          <XCircle size={13} />
                          <span>Tolak</span>
                        </button>
                      </div>
                    ) : req.status === "approved" ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-xs">
                        <CheckCircle2 size={13} /> Disetujui
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-600 font-semibold text-xs">
                        <XCircle size={13} /> Ditolak
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Penolakan Cuti */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-2xl dark:bg-slate-900 space-y-4">
            <h3 className="font-bold text-ink text-sm">Alasan Penolakan Cuti Karyawan</h3>
            <p className="text-xs text-muted">
              Sampaikan alasan penolakan secara jelas agar karyawan dapat mengatur kembali jadwal kerjanya.
            </p>

            <form action={reviewLeaveRequestAction} className="space-y-3 text-xs">
              <input type="hidden" name="request_id" value={rejectingId} />
              <input type="hidden" name="decision" value="rejected" />
              <div>
                <label className="block font-semibold text-ink mb-1">Alasan Penolakan *</label>
                <textarea
                  name="note"
                  required
                  rows={3}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Contoh: Jadwal berbenturan dengan kick-off meeting proyek Cilegon..."
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setRejectingId(null)}
                  className="rounded-xl border border-line px-4 py-2 font-medium text-muted hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-rose-700 transition"
                >
                  Konfirmasi Penolakan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
