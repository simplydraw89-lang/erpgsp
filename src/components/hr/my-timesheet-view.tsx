"use client"

import React, { useState } from "react"
import { Timer, PlusCircle, Calendar, Briefcase, Clock, CheckCircle2 } from "lucide-react"
import { submitTimesheetAction } from "@/app/(workspace)/modul/hr-actions"

export interface MyTimesheetItem {
  id: string
  log_date: string
  duration_hours: number
  activity_description: string
  project_id: string | null
  created_at: string
}

interface MyTimesheetViewProps {
  timesheets: MyTimesheetItem[]
  projects: Array<{ id: string; name: string }>
  userName: string
}

export function MyTimesheetView({ timesheets, projects, userName }: MyTimesheetViewProps) {
  const [showModal, setShowModal] = useState(false)

  const totalHours = timesheets.reduce((sum, item) => sum + item.duration_hours, 0)
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayHours = timesheets
    .filter((item) => item.log_date === todayStr)
    .reduce((sum, item) => sum + item.duration_hours, 0)

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-ink">Logbook / Timesheet Harian ({userName})</h2>
          <p className="text-xs text-muted">
            Pencatatan alokasi jam kerja harian per proyek dan tugas teknis operasional.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition"
        >
          <PlusCircle size={15} />
          <span>Isi Jam Kerja Hari Ini</span>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm dark:bg-slate-900">
          <p className="text-xs text-muted">Total Jam Kerja Hari Ini</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-ink">{todayHours}</span>
            <span className="text-xs text-muted">Jam Kerja</span>
          </div>
          <p className="text-[11px] text-muted mt-0.5">Target harian standar: 8 Jam</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm dark:bg-slate-900">
          <p className="text-xs text-muted">Total Alokasi Periode Ini</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-brand">{totalHours}</span>
            <span className="text-xs text-muted">Jam Tercatat</span>
          </div>
          <p className="text-[11px] text-muted mt-0.5">Tersebar di {timesheets.length} sesi aktivitas proyek</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm dark:bg-slate-900">
          <p className="text-xs text-muted">Efisiensi & Produktivitas</p>
          <div className="flex items-center gap-1.5 mt-1 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
            <CheckCircle2 size={16} />
            <span>Aktif Terlaporkan</span>
          </div>
          <p className="text-[11px] text-muted mt-1.5">Tervalidasi untuk evaluasi beban kerja bulanan</p>
        </div>
      </div>

      {/* Tabel Log Timesheet */}
      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-muted dark:bg-slate-800">
            <tr>
              <th scope="col" className="p-3 font-semibold">Tanggal</th>
              <th scope="col" className="p-3 font-semibold">Durasi</th>
              <th scope="col" className="p-3 font-semibold">Uraian Aktivitas & Progres</th>
              <th scope="col" className="p-3 font-semibold">Proyek</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {timesheets.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted">
                  Belum ada log jam kerja. Klik tombol &quot;Isi Jam Kerja Hari Ini&quot; untuk mencatat aktivitas Anda.
                </td>
              </tr>
            ) : (
              timesheets.map((item) => {
                const proj = projects.find((p) => p.id === item.project_id)
                return (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 whitespace-nowrap text-muted font-medium">{item.log_date}</td>
                    <td className="p-3">
                      <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        {item.duration_hours} Jam
                      </span>
                    </td>
                    <td className="p-3 font-medium text-ink">{item.activity_description}</td>
                    <td className="p-3 text-muted">
                      {proj ? (
                        <span className="font-semibold text-ink">{proj.name}</span>
                      ) : (
                        <span className="text-[11px]">Operasional Umum / Non-Proyek</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Input Jam Kerja */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Timer className="text-brand" size={18} />
                <h3 className="font-bold text-ink text-sm">Catat Log Jam Kerja Harian</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-muted hover:text-ink text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form action={submitTimesheetAction} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Tanggal *</label>
                  <input
                    type="date"
                    name="log_date"
                    required
                    defaultValue={todayStr}
                    className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Durasi (Jam) *</label>
                  <input
                    type="number"
                    name="duration_hours"
                    required
                    min={0.5}
                    max={24}
                    step={0.5}
                    defaultValue={8}
                    className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Proyek Terkait</label>
                <select
                  name="project_id"
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                >
                  <option value="">-- Operasional Kantor / Umum --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Uraian Pekerjaan / Progres Teknis *</label>
                <textarea
                  name="activity_description"
                  required
                  rows={3}
                  placeholder="Contoh: Menyusun laporan teknis uji tanah sondir Cilegon dan verifikasi data lapangan..."
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
                  Simpan Log Kerja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
