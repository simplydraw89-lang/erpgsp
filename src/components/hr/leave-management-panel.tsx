"use client"

import React, { useState } from "react"
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  AlertCircle,
  PlusCircle,
  FileText,
  UserCheck,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { submitLeaveAction } from "@/app/(workspace)/modul/hr-actions"

export interface LeaveRequestRow {
  id: string
  leave_type: string
  starts_on: string
  ends_on: string
  total_days: number
  reason: string
  status: string
  created_at: string
  reviewer_name?: string
  review_note?: string | null
}

interface LeaveManagementPanelProps {
  annualQuota: number
  usedDays: number
  requests: LeaveRequestRow[]
  canManage: boolean
}

export function LeaveManagementPanel({
  annualQuota,
  usedDays,
  requests,
  canManage,
}: LeaveManagementPanelProps) {
  const [showForm, setShowForm] = useState(false)
  const remainingDays = Math.max(0, annualQuota - usedDays)

  return (
    <div className="space-y-6">
      {/* Kartu Saldo Cuti */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs text-muted font-medium">Hak Cuti Tahunan</p>
          <p className="mt-2 text-3xl font-bold text-ink">{annualQuota} <span className="text-sm font-normal text-muted">Hari</span></p>
          <p className="mt-1 text-[11px] text-muted">Periode Tahun {new Date().getFullYear()}</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs text-muted font-medium">Cuti Terpakai</p>
          <p className="mt-2 text-3xl font-bold text-amber-700">{usedDays} <span className="text-sm font-normal text-muted">Hari</span></p>
          <p className="mt-1 text-[11px] text-muted">Sudah disetujui HRD/Atasan</p>
        </Card>

        <Card className="p-5 border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/20">
          <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">Sisa Saldo Cuti</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700 dark:text-emerald-400">{remainingDays} <span className="text-sm font-normal text-muted">Hari</span></p>
          <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">Tersedia untuk diajukan</p>
        </Card>
      </div>

      {/* Header & Tombol Pengajuan */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-ink flex items-center gap-2">
            <CalendarDays size={18} className="text-brand" />
            <span>Riwayat Pengajuan Cuti & Izin Karyawan</span>
          </h3>
          <p className="text-xs text-muted">Pantau status persetujuan pengajuan cuti tahunan, sakit, dan izin dinas.</p>
        </div>

        <Button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="gap-1.5 text-xs font-semibold"
        >
          <PlusCircle size={14} />
          <span>Ajukan Cuti / Izin Baru</span>
        </Button>
      </div>

      {/* Form Pengajuan Cuti */}
      {showForm && (
        <Card className="p-5 space-y-4 border-brand/30 bg-white shadow-md dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h4 className="text-xs font-bold text-ink">Formulir Pengajuan Cuti / Izin</h4>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-muted hover:text-ink font-semibold"
            >
              Tutup ✕
            </button>
          </div>

          <form action={submitLeaveAction} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-ink">
                  Jenis Pengajuan
                  <select
                    name="leave_type"
                    defaultValue="annual"
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                  >
                    <option value="annual">Cuti Tahunan (Potong Saldo)</option>
                    <option value="sick">Sakit (Keterangan Dokter)</option>
                    <option value="important">Izin Keperluan Penting</option>
                    <option value="maternity">Cuti Melahirkan / Ayah</option>
                    <option value="unpaid">Cuti di Luar Tanggungan</option>
                  </select>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink">
                  Tanggal Mulai
                  <input
                    type="date"
                    name="starts_on"
                    required
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink">
                  Tanggal Berakhir
                  <input
                    type="date"
                    name="ends_on"
                    required
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                  />
                </label>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-ink">
                  Total Hari Kerja
                  <input
                    type="number"
                    name="total_days"
                    min="1"
                    max="30"
                    defaultValue="1"
                    required
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                  />
                </label>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-ink">
                  Alasan & Keterangan Pengajuan
                  <input
                    type="text"
                    name="reason"
                    required
                    placeholder="Contoh: Keperluan keluarga mendesak di luar kota"
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowForm(false)}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" className="gap-1.5">
                <CheckCircle2 size={13} />
                <span>Kirimkan Pengajuan</span>
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tabel Riwayat Pengajuan Cuti */}
      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-muted dark:bg-slate-800">
            <tr>
              <th scope="col" className="p-3 font-semibold">Jenis Cuti</th>
              <th scope="col" className="p-3 font-semibold">Periode</th>
              <th scope="col" className="p-3 font-semibold">Jumlah</th>
              <th scope="col" className="p-3 font-semibold">Alasan</th>
              <th scope="col" className="p-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {requests.length ? (
              requests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-semibold text-ink capitalize">
                    {r.leave_type === "annual" ? "Cuti Tahunan" : r.leave_type === "sick" ? "Sakit" : r.leave_type}
                  </td>
                  <td className="p-3 text-muted">{r.starts_on} s/d {r.ends_on}</td>
                  <td className="p-3 font-bold text-ink">{r.total_days} Hari</td>
                  <td className="p-3 max-w-xs truncate text-muted">{r.reason}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        r.status === "approved"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : r.status === "rejected"
                          ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {r.status === "approved"
                        ? "Disetujui"
                        : r.status === "rejected"
                        ? "Ditolak"
                        : "Menunggu Review HR"}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted">
                  Belum ada riwayat pengajuan cuti.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
