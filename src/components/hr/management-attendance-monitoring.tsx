"use client"

import React, { useState } from "react"
import { Users, MapPin, Camera, Clock, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react"

export interface MonitoringAttendanceItem {
  id: string
  employee_name: string
  branch_name: string
  attendance_type: "office" | "site"
  clock_in: string | null
  clock_out: string | null
  attendance_status: string
  latitude: number | null
  longitude: number | null
  photo_data: string | null
  reason: string | null
  location_note: string | null
}

interface ManagementAttendanceMonitoringProps {
  logs: MonitoringAttendanceItem[]
}

export function ManagementAttendanceMonitoring({ logs }: ManagementAttendanceMonitoringProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<{ name: string; photo: string } | null>(null)
  const [filterBranch, setFilterBranch] = useState<string>("all")
  const [filterType, setFilterType] = useState<string>("all")

  const totalHadir = logs.filter((l) => l.clock_in).length
  const totalKantor = logs.filter((l) => l.attendance_type === "office" && l.clock_in).length
  const totalSite = logs.filter((l) => l.attendance_type === "site" && l.clock_in).length

  const filtered = logs.filter((item) => {
    if (filterBranch !== "all" && item.branch_name !== filterBranch) return false
    if (filterType !== "all" && item.attendance_type !== filterType) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-ink">Live Monitoring Presensi Seluruh Cabang</h2>
          <p className="text-xs text-muted">
            Pemantauan langsung kehadiran real-time staf di kantor cabang dan tim lapangan (site) se-Indonesia.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm dark:bg-slate-900">
          <p className="text-xs text-muted">Total Tim Hadir Hari Ini</p>
          <p className="text-2xl font-black text-ink mt-1">{totalHadir}</p>
          <p className="text-[11px] text-muted mt-0.5">Seluruh cabang aktif (Jakarta, Surabaya, Jogja)</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm dark:bg-slate-900">
          <p className="text-xs text-muted">Hadir di Kantor Cabang (Radius 100m)</p>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{totalKantor}</p>
          <p className="text-[11px] text-muted mt-0.5">Koordinat GPS tervalidasi geofencing kantor</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm dark:bg-slate-900">
          <p className="text-xs text-muted">Penugasan Site / Lapangan Luar Kantor</p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{totalSite}</p>
          <p className="text-[11px] text-muted mt-0.5">Tersebar di lokasi proyek dengan verifikasi selfie</p>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-muted">Cabang:</span>
          {["all", "Jakarta", "Surabaya", "Jogjakarta"].map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setFilterBranch(b)}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                filterBranch === b
                  ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                  : "bg-slate-100 text-muted hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {b === "all" ? "Semua Cabang" : b}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-muted">Lokasi:</span>
          {["all", "office", "site"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                filterType === t
                  ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                  : "bg-slate-100 text-muted hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {t === "all" ? "Semua" : t === "office" ? "Kantor" : "Site Lapangan"}
            </button>
          ))}
        </div>
      </div>

      {/* Tabel Live Attendance */}
      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-muted dark:bg-slate-800">
            <tr>
              <th scope="col" className="p-3 font-semibold">Nama Karyawan</th>
              <th scope="col" className="p-3 font-semibold">Cabang</th>
              <th scope="col" className="p-3 font-semibold">Jam Masuk / Pulang</th>
              <th scope="col" className="p-3 font-semibold">Tipe Absen</th>
              <th scope="col" className="p-3 font-semibold">Koordinat GPS Maps</th>
              <th scope="col" className="p-3 font-semibold">Foto Selfie Live</th>
              <th scope="col" className="p-3 font-semibold">Keterangan / Site</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">
                  Belum ada log presensi pada kriteria filter ini.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-bold text-ink whitespace-nowrap">{item.employee_name}</td>
                  <td className="p-3 text-muted">{item.branch_name}</td>
                  <td className="p-3 whitespace-nowrap text-muted">
                    <div className="font-mono font-medium text-ink">
                      {item.clock_in ? item.clock_in.slice(11, 16) : "-"}
                      <span className="text-muted text-[11px] font-normal"> s/d </span>
                      {item.clock_out ? item.clock_out.slice(11, 16) : "Aktif"}
                    </div>
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        item.attendance_type === "office"
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {item.attendance_type === "office" ? "Kantor" : "Site Lapangan"}
                    </span>
                  </td>
                  <td className="p-3">
                    {item.latitude && item.longitude ? (
                      <a
                        href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-brand hover:underline"
                      >
                        <MapPin size={12} className="text-rose-500" />
                        <span>
                          {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                        </span>
                      </a>
                    ) : (
                      <span className="text-muted text-[11px]">-</span>
                    )}
                  </td>
                  <td className="p-3">
                    {item.photo_data ? (
                      <button
                        type="button"
                        onClick={() => setSelectedPhoto({ name: item.employee_name, photo: item.photo_data! })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        <Camera size={12} className="text-brand" />
                        <span>Lihat Wajah</span>
                      </button>
                    ) : (
                      <span className="text-muted text-[11px]">Tanpa Foto</span>
                    )}
                  </td>
                  <td className="p-3 text-muted max-w-xs">{item.reason || item.location_note || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Preview Foto Selfie */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-2xl dark:bg-slate-900 space-y-3 text-center">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h4 className="font-bold text-ink text-xs">Foto Presensi: {selectedPhoto.name}</h4>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="text-muted hover:text-ink text-lg font-bold"
              >
                &times;
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-line bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPhoto.photo}
                alt={`Presensi ${selectedPhoto.name}`}
                className="w-full h-auto object-cover max-h-80"
              />
            </div>
            <button
              type="button"
              onClick={() => setSelectedPhoto(null)}
              className="w-full rounded-xl bg-slate-800 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
