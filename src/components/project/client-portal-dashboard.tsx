"use client"

import { useState } from "react"
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  MessageSquare,
  Paperclip,
  Sparkles,
  TrendingUp,
  UserCheck,
  X,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { ProjectPortalView, type PortalEntryItem } from "@/components/project/project-portal-view"
import {
  DEFAULT_PROJECT_MILESTONES,
  isMilestoneSyncEntry,
  type ProjectMilestoneItem,
} from "@/lib/project-milestone-types"

export type ClientProjectInfo = {
  id: string
  code: string
  name: string
  status: string
  branch_name?: string
  start_date?: string
  target_end_date?: string
}

interface ClientPortalDashboardProps {
  project?: ClientProjectInfo | null
  clientCompany: string
  entries: PortalEntryItem[]
  projectAttachments?: Array<{ id: string; file_name: string; content_type: string; byte_size: number }>
  milestones?: ProjectMilestoneItem[]
  canSubmit?: boolean
}

export function ClientPortalDashboard({
  project,
  clientCompany,
  entries,
  projectAttachments = [],
  milestones = [],
  canSubmit = true,
}: ClientPortalDashboardProps) {
  const activeMilestones = milestones.length > 0 ? milestones : DEFAULT_PROJECT_MILESTONES
  const visibleEntries = entries.filter((e) => !isMilestoneSyncEntry(e))

  // Pilih milestone aktif awal: yang in_progress pertama atau yang pertama
  const defaultSelected =
    activeMilestones.find((m) => m.status === "in_progress") ||
    activeMilestones[0] ||
    null

  const [selectedMilestone, setSelectedMilestone] = useState<ProjectMilestoneItem | null>(defaultSelected)

  const momCount = visibleEntries.filter((e) => e.kind === "mom").length
  const requestCount = visibleEntries.filter((e) => e.kind === "request" || e.kind === "status").length
  const milestoneAttachmentIds = new Set(activeMilestones.flatMap((m) => m.attachment_ids || []))
  for (const att of projectAttachments) milestoneAttachmentIds.add(att.id)
  const documentCount = milestoneAttachmentIds.size + visibleEntries.filter((e) => e.kind === "document").length

  // Rata-rata progress dinamis dari seluruh milestones
  const progressPercent = activeMilestones.length > 0
    ? Math.round(activeMilestones.reduce((acc, m) => acc + (Number(m.progress) || 0), 0) / activeMilestones.length)
    : 65

  // Map attachments by ID for easy lookup
  const attachmentMap = new Map<string, { id: string; file_name: string; content_type: string; byte_size: number }>()
  for (const att of projectAttachments) {
    attachmentMap.set(att.id, att)
  }

  // Active milestone for subtext
  const currentActiveMilestone = activeMilestones.find((m) => m.status === "in_progress") || activeMilestones[activeMilestones.length - 1]

  return (
    <div className="space-y-6">
      {/* 1. BAGIAN ATAS: LAPORAN & PROGRESS PROYEK KLIEN (GRAFIK & DATA INFORMASI) */}
      <section className="space-y-4">
        {/* Banner Selamat Datang Klien */}
        <div className="rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-emerald-50/50 to-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  <span className="size-2 rounded-full bg-emerald-600 animate-pulse" />
                  Portal Kolaborasi Klien Aktif
                </span>
                <span className="text-xs text-slate-500">· Akses 2 Arah Resmi</span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                Laporan & Progress Proyek: {clientCompany}
              </h1>
              <p className="mt-1 text-xs text-slate-600 max-w-3xl leading-relaxed">
                Pantau progres tahapan pekerjaan, koordinasi permintaan dokumen teknis (Amdalnet), serta baca notulensi rapat resmi (MoM) secara transparan pada satu halaman terpadu.
              </p>
            </div>

            {project && (
              <div className="flex flex-col items-end text-right">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Nomor Kontrak / SPK</span>
                <span className="font-mono text-sm font-bold text-teal-900">{project.code}</span>
                <span className="text-xs text-slate-600 font-medium mt-0.5">{project.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Kartu Progress Proyek & Grafik Milestone */}
        <Card className="p-5 border-slate-200/90 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700">
                <TrendingUp className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Progres Pelaksanaan Proyek</h2>
                <p className="text-xs text-slate-500">
                  Klik tiap tahapan untuk melihat rincian laporan teknis & kegiatan pelaksanaan secara real-time
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Total Progres Keseluruhan:</span>
              <span className="text-lg font-extrabold text-teal-700">{progressPercent}%</span>
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="space-y-2">
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden p-0.5 border border-slate-200/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Mulai Kontrak</span>
              {currentActiveMilestone && (
                <span className="font-semibold text-teal-800">
                  {currentActiveMilestone.title} ({currentActiveMilestone.status === "completed" ? "Selesai" : currentActiveMilestone.status === "in_progress" ? "Sedang Berjalan" : "Akan Datang"} · {currentActiveMilestone.progress}%)
                </span>
              )}
              <span>Penyelesaian Dokumen (100%)</span>
            </div>
          </div>

          {/* Visual Tahapan Milestone Flow (Dinamis dari Backend PM/PIC) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
            {activeMilestones.map((m) => {
              const isSelected = selectedMilestone?.milestone_number === m.milestone_number
              const isDone = m.status === "completed"
              const isCurrent = m.status === "in_progress"

              return (
                <button
                  key={m.milestone_number}
                  type="button"
                  onClick={() => setSelectedMilestone(m)}
                  className={`text-left rounded-xl p-3 space-y-1.5 transition-all cursor-pointer relative ${
                    isSelected
                      ? "border-2 border-teal-600 bg-teal-50/80 shadow-md ring-2 ring-teal-500/20"
                      : isDone
                      ? "border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/50"
                      : isCurrent
                      ? "border border-teal-300 bg-teal-50/60 hover:bg-teal-100/60"
                      : "border border-slate-200 bg-slate-50 hover:bg-slate-100/80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      {isDone ? (
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                      ) : isCurrent ? (
                        <Clock className="size-3.5 shrink-0 text-teal-600 animate-spin" />
                      ) : (
                        <span className="size-2 rounded-full bg-slate-400" />
                      )}
                      <span className={isDone ? "text-emerald-900" : isCurrent ? "text-teal-950" : "text-slate-700"}>
                        {m.title}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="size-1.5 rounded-full bg-teal-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                    {m.subtitle}
                  </p>
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-200/60">
                    <span className="font-semibold text-slate-500">{m.progress}% Selesai</span>
                    <span className="text-teal-700 font-medium">Buka detail →</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* DETAIL DRAWER / POPUP BOX SAAT MILESTONE DIKLIK */}
          {selectedMilestone && (
            <div className="mt-4 rounded-2xl border border-teal-300/80 bg-gradient-to-b from-teal-50/40 to-white p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-teal-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      selectedMilestone.status === "completed"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : selectedMilestone.status === "in_progress"
                        ? "bg-teal-100 text-teal-900 border border-teal-300"
                        : "bg-slate-100 text-slate-700 border border-slate-300"
                    }`}>
                      {selectedMilestone.status === "completed" ? "✓ Tahap Selesai" : selectedMilestone.status === "in_progress" ? "⏳ Sedang Dikerjakan" : "⚪ Tahap Berikutnya"}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">· {selectedMilestone.period}</span>
                  </div>
                  <h3 className="mt-1.5 text-base font-bold text-slate-900">
                    {selectedMilestone.title}: {selectedMilestone.subtitle}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMilestone(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                  aria-label="Tutup detail"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Rincian Deskripsi Kegiatan */}
              <div className="text-xs text-slate-700 leading-relaxed bg-white/80 p-3.5 rounded-xl border border-slate-200/80">
                <p className="font-semibold text-slate-900 mb-1">Rincian Teknis & Pelaksanaan:</p>
                <p>{selectedMilestone.description}</p>
                <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-500">
                  <UserCheck className="size-3.5 text-teal-700" />
                  <span>Penanggung Jawab (PIC Teknis): <strong>{selectedMilestone.pic}</strong></span>
                </div>
              </div>

              {/* Grid 2 Kolom: Deliverables Dokumen & Aksi Klien */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5 text-xs text-teal-900">
                    <FileCheck2 className="size-4 text-teal-700" />
                    <span>Laporan & Dokumen Hasil (Deliverables):</span>
                  </p>
                  <ul className="space-y-1.5 text-[11px] text-slate-600">
                    {selectedMilestone.deliverables.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-teal-600 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5 text-xs text-blue-900">
                    <CheckCircle2 className="size-4 text-blue-700" />
                    <span>Peran & Kordinasi Pihak Klien:</span>
                  </p>
                  <ul className="space-y-1.5 text-[11px] text-slate-600">
                    {selectedMilestone.clientActions.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Lampiran Berkas Resmi per Tahapan */}
              {selectedMilestone.attachment_ids && selectedMilestone.attachment_ids.length > 0 && (
                <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-3.5 space-y-2">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5 text-xs text-teal-950">
                    <Paperclip className="size-4 text-teal-700" />
                    <span>Dokumen & Berkas Resmi Terlampir untuk Tahap Ini:</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {selectedMilestone.attachment_ids.map((attId) => {
                      const att = attachmentMap.get(attId)
                      const fileName =
                        att?.file_name ||
                        selectedMilestone.attachment_names?.[attId] ||
                        `Dokumen Lampiran (${attId.slice(0, 8)})`
                      return (
                        <a
                          key={attId}
                          href={`/api/invoice-documents/${attId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 rounded-lg bg-white border border-teal-200 text-xs text-teal-900 hover:bg-teal-50 transition"
                        >
                          <FileText className="size-4 text-teal-600 shrink-0" />
                          <span className="truncate flex-1 font-medium">{fileName}</span>
                          <ExternalLink className="size-3 text-slate-400 shrink-0" />
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200/60">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-amber-600" />
                  <span>Isi laporan tiap milestone diperbarui secara real-time oleh Project Manager / PIC Proyek GSP.</span>
                </span>
                <span className="font-semibold text-teal-800">Progres: {selectedMilestone.progress}%</span>
              </div>
            </div>
          )}

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="rounded-xl border border-slate-200 p-3.5 bg-white flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <MessageSquare className="size-4" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 font-medium">Permintaan Data (2 Arah)</p>
                <p className="text-base font-bold text-slate-900">{requestCount} Catatan</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3.5 bg-white flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                <FileCheck2 className="size-4" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 font-medium">Notulensi Rapat (MoM)</p>
                <p className="text-base font-bold text-slate-900">{momCount} Risalah Resmi</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3.5 bg-white flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <FileText className="size-4" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 font-medium">Dokumen & Berkas Resmi</p>
                <p className="text-base font-bold text-slate-900">{documentCount} Berkas Terlampir</p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* 2. BAGIAN BAWAH: RUANG KOLABORASI PORTAL PROYEK */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200/90 pb-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Ruang Kolaborasi & Permintaan Data</h2>
            <p className="text-xs text-slate-500">
              Kirim berkas teknis, baca notulensi rapat, dan lakukan diskusi 2 arah bersama PIC Proyek PT. Global Solusi Prima.
            </p>
          </div>
        </div>

        {project ? (
          <ProjectPortalView
            projectId={project.id}
            branchId={project.branch_name || ""}
            isInternal={false}
            isDirector={false}
            isClient={true}
            canSubmit={canSubmit}
            entries={visibleEntries}
          />
        ) : (
          <Card className="p-8 text-center text-slate-500 text-sm">
            Belum ada proyek aktif yang dialokasikan ke akun Anda. Hubungi administrator proyek untuk menghubungkan akun Anda.
          </Card>
        )}
      </section>
    </div>
  )
}
