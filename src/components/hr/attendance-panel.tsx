"use client"

import React, { useState, useEffect } from "react"
import {
  Clock,
  CheckCircle2,
  MapPin,
  Calendar,
  Building,
  Briefcase,
  AlertCircle,
  LogIn,
  LogOut,
  Send,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { recordAttendanceAction } from "@/app/(workspace)/modul/hr-actions"

export interface AttendanceRecord {
  id: string
  work_date: string
  clock_in: string
  clock_out: string | null
  attendance_status: string
  work_summary: string | null
  location_note: string | null
  employee_name?: string
}

interface AttendancePanelProps {
  todayRecord: AttendanceRecord | null
  records: AttendanceRecord[]
  canManage: boolean
  employeeName: string
}

export function AttendancePanel({
  todayRecord,
  records,
  canManage,
  employeeName,
}: AttendancePanelProps) {
  const [currentTime, setCurrentTime] = useState<string>("")
  const [attendanceStatus, setAttendanceStatus] = useState<string>("present")
  const [workSummary, setWorkSummary] = useState<string>(todayRecord?.work_summary || "")
  const [locationNote, setLocationNote] = useState<string>(todayRecord?.location_note || "")

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      )
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  const hasClockedIn = Boolean(todayRecord?.clock_in)
  const hasClockedOut = Boolean(todayRecord?.clock_out)

  return (
    <div className="space-y-6">
      {/* Widget Absensi Harian */}
      <Card className="overflow-hidden border-brand/20 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-semibold text-blue-300">
                Presensi & Kehadiran Online
              </span>
              <span className="text-xs text-slate-400">
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Halo, {employeeName}</h2>
            <div className="flex items-center gap-2 text-3xl font-mono font-bold text-emerald-400">
              <Clock size={26} className="text-emerald-400" />
              <span>{currentTime || "--:--:--"} WIB</span>
            </div>
          </div>

          {/* Status Box */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:w-80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Status Hari Ini:</span>
              <span
                className={`font-semibold rounded-full px-2 py-0.5 text-[11px] ${
                  hasClockedOut
                    ? "bg-slate-700 text-slate-200"
                    : hasClockedIn
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {hasClockedOut
                  ? "Selesai Kerja"
                  : hasClockedIn
                  ? "Sedang Bekerja"
                  : "Belum Absen Masuk"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-black/20 p-2">
                <span className="text-[10px] text-slate-400 block">Jam Masuk</span>
                <span className="font-mono font-bold text-white text-sm">
                  {todayRecord?.clock_in
                    ? new Date(todayRecord.clock_in).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--"}
                </span>
              </div>
              <div className="rounded-lg bg-black/20 p-2">
                <span className="text-[10px] text-slate-400 block">Jam Pulang</span>
                <span className="font-mono font-bold text-white text-sm">
                  {todayRecord?.clock_out
                    ? new Date(todayRecord.clock_out).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Form Aksi Absen Masuk / Pulang */}
        <form action={recordAttendanceAction} className="mt-6 border-t border-white/10 pt-5 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-300">
                Jenis Kehadiran
                <select
                  name="attendance_status"
                  value={attendanceStatus}
                  onChange={(e) => setAttendanceStatus(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900/90 p-2 text-xs text-white focus:border-brand focus:outline-none"
                >
                  <option value="present">Hadir di Kantor</option>
                  <option value="field_trip">Dinas Luar / Survei Lapangan</option>
                  <option value="wfh">Work from Home (WFH)</option>
                  <option value="sick">Sakit (Keterangan Dokter)</option>
                  <option value="permission">Izin Resmi</option>
                </select>
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Catatan Lokasi
                <input
                  type="text"
                  name="location_note"
                  value={locationNote}
                  onChange={(e) => setLocationNote(e.target.value)}
                  placeholder="Contoh: Kantor Pusat Jakarta / Lapangan Migas Cepu"
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900/90 p-2 text-xs text-white focus:border-brand focus:outline-none"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Rencana Aktivitas / Catatan Pekerjaan
                <input
                  type="text"
                  name="work_summary"
                  value={workSummary}
                  onChange={(e) => setWorkSummary(e.target.value)}
                  placeholder="Contoh: Penyusunan draft laporan UKL-UPL dan rapat koordinasi"
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900/90 p-2 text-xs text-white focus:border-brand focus:outline-none"
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {!hasClockedIn ? (
              <Button
                type="submit"
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-600/30 px-5"
              >
                <LogIn size={15} />
                <span>Absen Masuk Sekarang</span>
              </Button>
            ) : !hasClockedOut ? (
              <Button
                type="submit"
                className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-md shadow-amber-600/30 px-5"
              >
                <LogOut size={15} />
                <span>Absen Pulang (Selesai Kerja)</span>
              </Button>
            ) : (
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="text-xs text-slate-300 border-slate-700 bg-slate-800"
              >
                Perbarui Laporan Hari Ini
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Tabel Riwayat Kehadiran */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Calendar size={16} className="text-brand" />
              <span>Riwayat Kehadiran & Rekap Jam Kerja</span>
            </h3>
            <p className="text-xs text-muted">Daftar presensi harian karyawan pada sistem ERP GSP.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Total Tercatat: {records.length} Hari
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-line">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-muted dark:bg-slate-800">
                <tr>
                  <th scope="col" className="p-3 font-semibold">Tanggal</th>
                  {canManage && <th scope="col" className="p-3 font-semibold">Nama Karyawan</th>}
                  <th scope="col" className="p-3 font-semibold">Jam Masuk</th>
                  <th scope="col" className="p-3 font-semibold">Jam Pulang</th>
                  <th scope="col" className="p-3 font-semibold">Status</th>
                  <th scope="col" className="p-3 font-semibold">Lokasi & Aktivitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {records.length ? (
                  records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-medium text-ink whitespace-nowrap">
                        {r.work_date}
                      </td>
                      {canManage && (
                        <td className="p-3 font-medium text-ink">{r.employee_name || "Karyawan"}</td>
                      )}
                      <td className="p-3 font-mono text-emerald-700 dark:text-emerald-400">
                        {r.clock_in
                          ? new Date(r.clock_in).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>
                      <td className="p-3 font-mono text-amber-700 dark:text-amber-400">
                        {r.clock_out
                          ? new Date(r.clock_out).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                            r.attendance_status === "present"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : r.attendance_status === "field_trip"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {r.attendance_status === "present"
                            ? "Hadir Kantor"
                            : r.attendance_status === "field_trip"
                            ? "Dinas Lapangan"
                            : r.attendance_status === "wfh"
                            ? "WFH"
                            : r.attendance_status}
                        </span>
                      </td>
                      <td className="p-3 max-w-xs truncate text-muted">
                        {r.location_note ? `[${r.location_note}] ` : ""}
                        {r.work_summary || "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={canManage ? 6 : 5} className="p-6 text-center text-muted">
                      Belum ada catatan presensi untuk periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  )
}
