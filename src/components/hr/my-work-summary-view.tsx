"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  Briefcase,
  CheckCircle2,
  Clock,
  FolderKanban,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from "lucide-react"
import { Card } from "@/components/ui/card"

export interface MyProjectItem {
  id: string
  code: string
  name: string
  clientName?: string
  status: string
  branchName?: string
}

export interface MyWorkTaskItem {
  id: string
  title: string
  description?: string | null
  status: string
  priority: string
  dueOn?: string | null
  projectName?: string
}

interface MyWorkSummaryViewProps {
  projects: MyProjectItem[]
  tasks: MyWorkTaskItem[]
  userName: string
}

export function MyWorkSummaryView({ projects, tasks, userName }: MyWorkSummaryViewProps) {
  const [filterStatus, setFilterStatus] = useState<string>("all")

  const completedTasks = tasks.filter((t) => t.status === "done").length
  const activeTasks = tasks.filter((t) => t.status !== "done").length
  const completionRate = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus === "active") return t.status !== "done"
    if (filterStatus === "done") return t.status === "done"
    return true
  })

  return (
    <div className="space-y-6">
      {/* Kartu Ringkasan Beban & Capaian Kerja */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 border-blue-200 bg-blue-50/30 dark:bg-blue-950/20">
          <p className="text-xs text-blue-800 dark:text-blue-300 font-medium">Proyek Aktif yang Dikelola</p>
          <p className="mt-2 text-3xl font-bold text-blue-700 dark:text-blue-400">
            {projects.length} <span className="text-sm font-normal text-muted">Proyek</span>
          </p>
          <p className="mt-1 text-[11px] text-muted">Keterlibatan tim teknis & PIC</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs text-muted font-medium">Tugas Sedang Berjalan</p>
          <p className="mt-2 text-3xl font-bold text-amber-700">
            {activeTasks} <span className="text-sm font-normal text-muted">Tugas</span>
          </p>
          <p className="mt-1 text-[11px] text-muted">Menunggu diselesaikan</p>
        </Card>

        <Card className="p-5 border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/20">
          <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">Tingkat Penyelesaian Tugas</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700 dark:text-emerald-400">
            {completionRate}%
          </p>
          <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
            {completedTasks} dari {tasks.length} tugas selesai
          </p>
        </Card>
      </div>

      {/* Rincian Proyek Saya */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <FolderKanban size={16} className="text-brand" />
            <h3 className="text-sm font-bold text-ink">Proyek yang Saya Tangani ({projects.length})</h3>
          </div>
          <Link
            href="/modul/crm?type=project"
            className="text-xs font-semibold text-brand hover:underline"
          >
            Buka Modul Proyek &rarr;
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.length ? (
            projects.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-line bg-slate-50/50 p-4 space-y-2 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-brand">{p.code}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {p.status === "active" ? "Aktif" : p.status}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-ink line-clamp-1">{p.name}</h4>
                <p className="text-[11px] text-muted line-clamp-1">Klien: {p.clientName || "Klien Rekanan"}</p>
                <div className="pt-1 border-t border-line flex justify-between items-center text-[10px] text-muted">
                  <span>Cabang: {p.branchName || "Pusat"}</span>
                  <Link
                    href={`/portal-proyek?project=${p.id}`}
                    className="font-semibold text-brand hover:underline flex items-center gap-0.5"
                  >
                    <span>Portal</span>
                    <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full rounded-xl border border-dashed border-line p-6 text-center text-xs text-muted">
              Belum ada proyek yang dialokasikan ke akun Anda.
            </div>
          )}
        </div>
      </Card>

      {/* Rincian Tugas Operasional Saya */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-brand" />
            <h3 className="text-sm font-bold text-ink">Daftar Tugas & Tanggung Jawab Operasional</h3>
          </div>

          <div className="flex gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterStatus("all")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                filterStatus === "all" ? "bg-brand text-white" : "bg-slate-100 text-muted dark:bg-slate-800"
              }`}
            >
              Semua ({tasks.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("active")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                filterStatus === "active" ? "bg-brand text-white" : "bg-slate-100 text-muted dark:bg-slate-800"
              }`}
            >
              Aktif ({activeTasks})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("done")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                filterStatus === "done" ? "bg-brand text-white" : "bg-slate-100 text-muted dark:bg-slate-800"
              }`}
            >
              Selesai ({completedTasks})
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-line">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-muted dark:bg-slate-800">
                <tr>
                  <th scope="col" className="p-3 font-semibold">Tugas / Aktivitas</th>
                  <th scope="col" className="p-3 font-semibold">Prioritas</th>
                  <th scope="col" className="p-3 font-semibold">Tenggat Waktu</th>
                  <th scope="col" className="p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredTasks.length ? (
                  filteredTasks.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="p-3 max-w-sm">
                        <p className="font-semibold text-ink">{t.title}</p>
                        {t.description && (
                          <p className="text-[11px] text-muted line-clamp-1">{t.description}</p>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            t.priority === "urgent"
                              ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                              : t.priority === "high"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="p-3 text-muted">{t.dueOn || "Fleksibel"}</td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                            t.status === "done"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : t.status === "in_progress"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {t.status === "done"
                            ? "Selesai"
                            : t.status === "in_progress"
                            ? "Sedang Dikerjakan"
                            : "Belum Dikerjakan"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted">
                      Tidak ada tugas pada filter ini.
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
