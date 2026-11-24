"use client"

import React, { useState } from "react"
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  AlertCircle,
  PlusCircle,
  ShieldCheck,
  HeartPulse,
  Info,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { submitLeaveAction } from "@/app/(workspace)/modul/hr-actions"

export interface MyLeaveRequest {
  id: string
  leave_type: string
  starts_on: string
  ends_on: string
  total_days: number
  reason: string
  status: string
  created_at: string
}

interface MyLeaveAnnualTrackerProps {
  annualQuota: number
  usedDays: number
  requests: MyLeaveRequest[]
  userName: string
}

export function MyLeaveAnnualTracker({
  annualQuota = 12,
  usedDays = 0,
  requests = [],
  userName,
}: MyLeaveAnnualTrackerProps) {
  const [showForm, setShowForm] = useState(false)
  const remainingDays = Math.max(0, annualQuota - usedDays)

  // Hitung frekuensi per jenis cuti dalam 1 tahun
  const sickCount = requests.filter((r) => r.leave_type === "sick" && r.status === "approved").length
  const importantCount = requests.filter((r) => r.leave_type === "important" && r.status === "approved").length
  const annualCount = requests.filter((r) => r.leave_type === "annual" && r.status === "approved").length

  return (
    <div className="space-y-6">
      {/* 4 Kartu Metrik Rekap 1 Tahun Personal */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4.5 border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/20">
          <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">Sisa Cuti Tahunan</p>
          <p className="mt-1.5 text-3xl font-bold text-emerald-700 dark:text-emerald-400">
            {remainingDays} <span className="text-sm font-normal text-muted">Hari</span>
          </p>
          <p className="mt-1 text-[11px] text-muted">Dari kuota {annualQuota} hari/tahun</p>
        </Card>

        <Card className="p-4.5">
          <p className="text-xs text-muted font-medium">Cuti Tahunan Terpakai</p>
          <p className="mt-1.5 text-3xl font-bold text-amber-700">
            {usedDays} <span className="text-sm font-normal text-muted">Hari</span>
          </p>
          <p className="mt-1 text-[11px] text-muted">{annualCount} kali pengajuan disetujui</p>
        </Card>

        <Card className="p-4.5">
          <p className="text-xs text-muted font-medium flex items-center gap-1.5">
            <HeartPulse size={14} className="text-red-500" />
            <span>Frekuensi Izin Sakit</span>
          </p>
          <p className="mt-1.5 text-3xl font-bold text-ink">
            {sickCount} <span className="text-sm font-normal text-muted">Kali</span>
          </p>
          <p className="mt-1 text-[11px] text-muted">Tahun {new Date().getFullYear()}</p>
        </Card>

        <Card className="p-4.5">
          <p className="text-xs text-muted font-medium">Frekuensi Izin Penting</p>
          <p className="mt-1.5 text-3xl font-bold text-ink">
            {importantCount} <span className="text-sm font-normal text-muted">Kali</span>
          </p>
          <p className="mt-1 text-[11px] text-muted">Keperluan keluarga/dinas</p>
        </Card>
      </div>

      {/* Header & Aksi Pengajuan */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h3 className="text-base font-bold text-ink flex items-center gap-2">
            <CalendarDays size={18} className="text-brand" />
            <span>Riwayat Izin & Cuti Personal 1 Tahun ({userName})</span>
          </h3>
          <p className="text-xs text-muted">
            Semua riwayat izin dan cuti yang Anda ajukan dalam periode 1 tahun terakhir.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="gap-1.5 text-xs font-semibold"
        >
          <PlusCircle size={14} />
          <span>Ajukan Izin / Cuti Baru</span>
        </Button>
      </div>

      {/* Form Pengajuan Izin & Cuti */}
      {showForm && (
        <Card className="p-5 space-y-4 border-brand/30 bg-white shadow-md dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h4 className="text-xs font-bold text-ink">Formulir Pengajuan Izin / Cuti Mandiri</h4>
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
                  Kategori Pengajuan <span className="text-red-500">*</span>
                  <select
                    name="leave_type"
                    defaultValue="annual"
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                  >
                    <option value="annual">Cuti Tahunan (Potong Saldo Kuota)</option>
                    <option value="sick">Izin Sakit (Surat Dokter)</option>
                    <option value="important">Izin Keperluan Mendesak</option>
                    <option value="maternity">Cuti Melahirkan</option>
                    <option value="unpaid">Cuti di Luar Tanggungan</option>
                  </select>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink">
                  Tanggal Mulai <span className="text-red-500">*</span>
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
                  Tanggal Berakhir <span className="text-red-500">*</span>
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
                  Estimasi Hari Kerja <span className="text-red-500">*</span>
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
                  Alasan & Keterangan Pengajuan <span className="text-red-500">*</span>
                  <input
                    type="text"
                    name="reason"
                    required
                    placeholder="Contoh: Mengurus dokumen keluarga penting di instansi terkait"
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
                <span>Kirimkan Pengajuan ke HR</span>
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tabel Riwayat Pengajuan Cuti 1 Tahun */}
      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-muted dark:bg-slate-800">
            <tr>
              <th scope="col" className="p-3 font-semibold">Jenis Pengajuan</th>
              <th scope="col" className="p-3 font-semibold">Rentang Tanggal</th>
              <th scope="col" className="p-3 font-semibold">Total</th>
              <th scope="col" className="p-3 font-semibold">Alasan</th>
              <th scope="col" className="p-3 font-semibold">Status HR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {requests.length ? (
              requests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-semibold text-ink">
                    {r.leave_type === "annual"
                      ? "Cuti Tahunan"
                      : r.leave_type === "sick"
                      ? "Izin Sakit"
                      : r.leave_type === "important"
                      ? "Izin Penting"
                      : r.leave_type}
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
                        : "Menunggu Review"}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted">
                  Belum ada riwayat izin atau cuti yang diajukan pada tahun ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
