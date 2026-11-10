"use client"

import React, { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import type { WorkflowAuditSummary, EnrichedAuditStep } from "@/lib/audit-trail"
import {
  Clock,
  UserCheck,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Activity,
  Timer,
  Send,
  XCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  LayoutList,
  Eye,
} from "lucide-react"

const BADGE_STYLES: Record<
  WorkflowAuditSummary["steps"][number]["actionBadge"]["tone"],
  string
> = {
  slate: "bg-slate-100 text-slate-800 border-slate-300",
  blue: "bg-blue-100 text-blue-900 border-blue-300",
  amber: "bg-amber-100 text-amber-950 border-amber-300",
  emerald: "bg-emerald-100 text-emerald-900 border-emerald-300",
  rose: "bg-rose-100 text-rose-900 border-rose-300",
  indigo: "bg-indigo-100 text-indigo-900 border-indigo-300",
}

const DOT_STYLES: Record<
  WorkflowAuditSummary["steps"][number]["actionBadge"]["tone"],
  string
> = {
  slate: "bg-slate-500 ring-slate-100",
  blue: "bg-blue-600 ring-blue-100",
  amber: "bg-amber-500 ring-amber-100",
  emerald: "bg-emerald-600 ring-emerald-100",
  rose: "bg-rose-600 ring-rose-100",
  indigo: "bg-indigo-600 ring-indigo-100",
}

type TimelineGroupItem =
  | { type: "single"; step: EnrichedAuditStep }
  | {
      type: "group"
      groupId: string
      actorName: string
      actorRole: string
      actorBranch: string
      actorEmail: string
      startStepNumber: number
      endStepNumber: number
      latestCreatedAt: string
      steps: EnrichedAuditStep[]
      totalDurationLabel?: string
    }

export function AuditWorkflowTimeline({
  summary,
  title = "Log Audit, Posisi Dokumen & KPI Waktu Pengerjaan",
}: {
  summary: WorkflowAuditSummary
  title?: string
}) {
  const { creator, currentHolder, metrics, steps, actorKpiList, isCompleted, isRevisionOrRejected } = summary

  const [isCompactMode, setIsCompactMode] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  function toggleGroup(groupId: string) {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }))
  }

  // Kelompokkan pembaruan draft yang berurutan jika dalam mode ringkas
  const timelineItems: TimelineGroupItem[] = useMemo(() => {
    if (!isCompactMode) {
      return steps.map((step) => ({ type: "single", step }))
    }

    const items: TimelineGroupItem[] = []
    let currentDraftGroup: EnrichedAuditStep[] = []

    function flushDraftGroup() {
      if (currentDraftGroup.length === 0) return
      if (currentDraftGroup.length === 1) {
        items.push({ type: "single", step: currentDraftGroup[0] })
      } else {
        const first = currentDraftGroup[0]
        const last = currentDraftGroup[currentDraftGroup.length - 1]
        items.push({
          type: "group",
          groupId: `draft-group-${first.id}`,
          actorName: last.actor.fullName,
          actorRole: last.actor.roleLabel,
          actorBranch: last.actor.branchName,
          actorEmail: last.actor.email,
          startStepNumber: first.stepNumber,
          endStepNumber: last.stepNumber,
          latestCreatedAt: last.createdAtFormatted,
          steps: [...currentDraftGroup],
          totalDurationLabel: last.durationFromPrevLabel || undefined,
        })
      }
      currentDraftGroup = []
    }

    for (const step of steps) {
      const isDraftUpdate =
        step.actionBadge.label === "Update Draft" ||
        step.action === "draft_updated" ||
        step.action === "planning_updated" ||
        step.action === "updated"

      // Hanya grup jika aktornya sama persis
      const prevInGroup = currentDraftGroup[currentDraftGroup.length - 1]
      const sameActor = !prevInGroup || prevInGroup.actor.userId === step.actor.userId

      if (isDraftUpdate && sameActor) {
        currentDraftGroup.push(step)
      } else {
        flushDraftGroup()
        if (isDraftUpdate) {
          currentDraftGroup.push(step)
        } else {
          items.push({ type: "single", step })
        }
      }
    }

    flushDraftGroup()
    return items
  }, [steps, isCompactMode])

  return (
    <Card className="overflow-hidden border border-line bg-white shadow-sm">
      {/* HEADER UTAMA */}
      <div className="border-b border-line bg-slate-50/80 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Activity className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink">{title}</h2>
            <p className="text-xs text-muted">
              Pelacakan penanggung jawab (PIC), alur disposisi/revisi, dan durasi pengerjaan untuk evaluasi KPI personel.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700">
            <Timer className="size-3.5 text-brand" />
            Total Waktu Siklus: <strong className="text-ink">{metrics.totalLeadTimeLabel}</strong>
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold ${
              metrics.revisionCount === 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-300 bg-amber-50 text-amber-900"
            }`}
          >
            {metrics.revisionCount === 0 ? (
              <>
                <CheckCircle2 className="size-3.5 text-emerald-600" /> Tanpa Revisi (First-Time Right)
              </>
            ) : (
              <>
                <RotateCcw className="size-3.5 text-amber-600" /> {metrics.revisionCount}x Siklus Revisi
              </>
            )}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* PANEL POSISI DOKUMEN SAAT INI & SIAPA YANG SEDANG MENGERJAKAN */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* KARTU 1: PENGAJU / PEMBUAT DOKUMEN */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                1. Pengaju / Pembuat Dokumen (PIC Awal)
              </span>
              <span className="rounded bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-800">
                {creator.branchName}
              </span>
            </div>
            <div className="flex items-start gap-3 pt-1">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                {creator.fullName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-ink truncate">{creator.fullName}</p>
                <p className="text-xs font-medium text-brand">
                  {creator.roleLabel} · {creator.branchName}
                </p>
                {creator.email && (
                  <p className="text-[11px] font-mono text-muted mt-0.5">{creator.email}</p>
                )}
                <p className="text-[11px] text-muted mt-1">
                  Mulai dibuat: <span className="font-medium text-slate-700">{metrics.firstCreatedAtFormatted}</span>
                </p>
              </div>
            </div>
          </div>

          {/* KARTU 2: POSISI DOKUMEN SAAT INI & SIAPA YANG SEDANG MENGERJAKAN */}
          {currentHolder && (
            <div
              className={`rounded-xl border p-4 space-y-2 ${
                isCompleted
                  ? "border-emerald-300 bg-emerald-50/60"
                  : isRevisionOrRejected
                  ? "border-amber-300 bg-amber-50/70"
                  : "border-blue-300 bg-blue-50/60"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    isCompleted
                      ? "text-emerald-800"
                      : isRevisionOrRejected
                      ? "text-amber-900"
                      : "text-blue-900"
                  }`}
                >
                  2. {isCompleted ? "Status Akhir Dokumen" : "Sedang Dikerjakan / Menunggu Tindakan Oleh"}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    isCompleted
                      ? "bg-emerald-200 text-emerald-950"
                      : isRevisionOrRejected
                      ? "bg-amber-200 text-amber-950"
                      : "bg-blue-200 text-blue-950"
                  }`}
                >
                  <Clock className="size-3" />
                  {isCompleted ? "Selesai" : `Durasi berjalan: ${currentHolder.elapsedLabel}`}
                </span>
              </div>

              <div className="flex items-start gap-3 pt-1">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                    isCompleted
                      ? "bg-emerald-600"
                      : isRevisionOrRejected
                      ? "bg-amber-600"
                      : "bg-blue-600"
                  }`}
                >
                  {currentHolder.holderName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-ink">
                    {currentHolder.holderName}
                  </p>
                  <p className="text-xs font-semibold text-slate-700">
                    {currentHolder.holderRoleLabel} · {currentHolder.holderBranchName}
                    {currentHolder.holderEmail ? ` (${currentHolder.holderEmail})` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-800 leading-relaxed">
                    <span className="font-semibold">Posisi Tahap:</span> {currentHolder.statusLabel}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-700 leading-relaxed">
                    <span className="font-semibold">Tugas / Tindak Lanjut:</span> {currentHolder.actionRequiredLabel}
                  </p>
                  {!isCompleted && (
                    <p className="mt-1 text-[11px] text-slate-600">
                      Diterima di tahap ini sejak: <strong>{currentHolder.sinceFormatted}</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* REKAP KPI KECEPATAN KERJA PER USER */}
        {actorKpiList.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-canvas/60 overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-100/70 px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Ringkasan KPI Penugasan & Waktu Respons Personel pada Dokumen Ini
              </span>
              <span className="text-[11px] text-muted">
                Digunakan sebagai dasar evaluasi kecepatan kerja (SLA)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2 font-semibold">Nama Personel / User</th>
                    <th className="px-3.5 py-2 font-semibold">Jabatan & Lokasi</th>
                    <th className="px-3.5 py-2 font-semibold text-center">Jml Aksi</th>
                    <th className="px-3.5 py-2 font-semibold">Total Durasi Respons</th>
                    <th className="px-3.5 py-2 font-semibold">Tindakan Terakhir</th>
                    <th className="px-3.5 py-2 font-semibold">Status Tugas</th>
                  </tr>
                </thead>
                <tbody>
                  {actorKpiList.map((item, i) => (
                    <tr key={`${item.userId}-${i}`} className="border-b border-slate-100 last:border-0">
                      <td className="px-3.5 py-2.5">
                        <div className="font-bold text-ink">{item.fullName}</div>
                        {item.email && <div className="font-mono text-[11px] text-muted">{item.email}</div>}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span className="font-medium text-slate-800">{item.roleLabel}</span>
                        <span className="block text-[11px] text-muted">{item.branchName}</span>
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-bold text-slate-800">
                        {item.actionsCount}x
                      </td>
                      <td className="px-3.5 py-2.5 font-mono font-semibold text-brand">
                        {item.totalResponseLabel}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span className="font-medium text-slate-800">{item.lastActionTitle}</span>
                        <span className="block text-[11px] text-muted">{item.lastActionAtFormatted}</span>
                      </td>
                      <td className="px-3.5 py-2.5">
                        {item.isCurrentHolder ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                            <Clock className="size-3" /> Sedang Mengerjakan
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                            <CheckCircle2 className="size-3" /> Tahap Selesai
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TIMELINE KRONOLOGIS LOG AUDIT */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Kronologi Riwayat Tindakan & Disposisi ({steps.length} Tahap Tercatat)
              </h3>
              <p className="text-[11px] text-muted mt-0.5">
                {isCompactMode
                  ? "Tampilan Ringkas aktif: pembaruan draft berulang dirangkum agar mudah dibaca."
                  : "Tampilan Lengkap aktif: menampilkan seluruh rincian per tahap."}
              </p>
            </div>

            {/* TOGGLE MODE TAMPILAN RINGKAS VS RINCI */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setIsCompactMode(true)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 transition ${
                  isCompactMode
                    ? "bg-white text-brand shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutList className="size-3.5" />
                Mode Ringkas
              </button>
              <button
                type="button"
                onClick={() => setIsCompactMode(false)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 transition ${
                  !isCompactMode
                    ? "bg-white text-brand shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Eye className="size-3.5" />
                Mode Detail
              </button>
            </div>
          </div>

          {steps.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-muted">
              Belum ada riwayat aktivitas tercatat untuk dokumen ini.
            </p>
          ) : (
            <ol className="relative border-l-2 border-slate-200 ml-3 space-y-4">
              {timelineItems.map((item, itemIdx) => {
                // 1. TAMPILAN KELOMPOK PEMBARUAN DRAFT (GROUPED)
                if (item.type === "group") {
                  const isExpanded = Boolean(expandedGroups[item.groupId])
                  return (
                    <li key={item.groupId} className="ml-5 relative">
                      <span className="absolute -left-[27px] top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 ring-4 ring-blue-100" />
                      <div className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-3 text-xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-blue-100 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-900">
                              Tahap #{item.startStepNumber} – #{item.endStepNumber}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-white px-2.5 py-0.5 text-[11px] font-bold text-blue-900">
                              Pembaruan Draft ({item.steps.length}x tersimpan)
                            </span>
                            {item.totalDurationLabel && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                                <Timer className="size-3 text-brand" />
                                {item.totalDurationLabel}
                              </span>
                            )}
                          </div>
                          <time className="font-mono text-[11px] text-slate-500">
                            {item.latestCreatedAt}
                          </time>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-slate-800 leading-relaxed">
                            Draft & lampiran diperbarui {item.steps.length} kali oleh{" "}
                            <strong className="text-slate-900">{item.actorName}</strong>{" "}
                            <span className="text-slate-500">({item.actorRole} · {item.actorBranch})</span>
                          </p>

                          <button
                            type="button"
                            onClick={() => toggleGroup(item.groupId)}
                            className="inline-flex items-center gap-1 rounded border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-900 hover:bg-blue-50 transition"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="size-3" /> Sembunyikan Rincian
                              </>
                            ) : (
                              <>
                                <ChevronDown className="size-3" /> Lihat Rincian ({item.steps.length} kali edit)
                              </>
                            )}
                          </button>
                        </div>

                        {/* SUB-LIST JIKA DI-EXPAND */}
                        {isExpanded && (
                          <div className="mt-2.5 space-y-1.5 border-t border-blue-200/60 pt-2.5 pl-2">
                            {item.steps.map((subStep) => (
                              <div
                                key={subStep.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded bg-white/80 px-2.5 py-1.5 text-[11px] text-slate-700 border border-blue-100"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-slate-500">
                                    #{subStep.stepNumber}
                                  </span>
                                  <span>{subStep.actionTitle}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {subStep.durationFromPrevLabel && (
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      +{subStep.durationFromPrevLabel}
                                    </span>
                                  )}
                                  <time className="font-mono text-[10px] text-slate-500">
                                    {subStep.createdAtFormatted}
                                  </time>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  )
                }

                // 2. TAMPILAN LANGKAH TUNGGAL (SINGLE STEP)
                const step = item.step
                const isDraftUpdate =
                  step.actionBadge.label === "Update Draft" ||
                  step.action === "draft_updated" ||
                  step.action === "planning_updated" ||
                  step.action === "updated"

                const isSameActorRouting =
                  step.routedTo &&
                  (step.routedTo.personName === step.actor.fullName ||
                    step.routedTo.personEmail === step.actor.email)

                return (
                  <li key={step.id} className="ml-5 relative">
                    {/* Titik Indikator Timeline */}
                    <span
                      className={`absolute -left-[27px] top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ${
                        DOT_STYLES[step.actionBadge.tone]
                      }`}
                    />

                    <div
                      className={`rounded-xl border bg-white p-3.5 shadow-2xs space-y-2 ${
                        step.actionBadge.tone === "emerald"
                          ? "border-emerald-200/80 bg-emerald-50/20"
                          : step.actionBadge.tone === "amber"
                          ? "border-amber-200/80 bg-amber-50/30"
                          : step.actionBadge.tone === "rose"
                          ? "border-rose-200/80 bg-rose-50/30"
                          : "border-slate-200"
                      }`}
                    >
                      {/* Baris Atas: Nomor Tahap, Badge Aksi, Durasi SLA, dan Waktu Presisi */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                            Tahap #{step.stepNumber}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                              BADGE_STYLES[step.actionBadge.tone]
                            }`}
                          >
                            {step.actionBadge.label}
                          </span>
                          {step.durationFromPrevLabel && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                              <Timer className="size-3 text-brand" />
                              {step.durationContextLabel || "Durasi respons"}:{" "}
                              <strong className="text-ink">{step.durationFromPrevLabel}</strong>
                            </span>
                          )}
                        </div>

                        <time className="font-mono text-xs font-medium text-slate-500">
                          {step.createdAtFormatted}
                        </time>
                      </div>

                      {/* Judul Tindakan */}
                      <p className="text-sm font-bold text-ink">{step.actionTitle}</p>

                      {/* Kotak Info Eksekutor: RINGKAS UNTUK DRAFT, PENUH UNTUK PERPINDAHAN TANGAN */}
                      {isDraftUpdate || isSameActorRouting ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs border border-slate-200/70">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{step.actor.fullName}</span>
                            <span className="text-muted">
                              ({step.actor.roleLabel} · {step.actor.branchName})
                            </span>
                            {step.actor.email && (
                              <span className="font-mono text-[11px] text-slate-500 hidden sm:inline">
                                · {step.actor.email}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-600">
                            <span>Posisi:</span>
                            <strong className="text-brand font-semibold">{step.toStageLabel}</strong>
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-2.5 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-2 border border-slate-200/80">
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 block">
                              Dilakukan Oleh (Eksekutor):
                            </span>
                            <p className="font-bold text-slate-900 mt-0.5">{step.actor.fullName}</p>
                            <p className="text-brand font-medium">
                              {step.actor.roleLabel} · {step.actor.branchName}
                            </p>
                            {step.actor.email && (
                              <p className="font-mono text-[11px] text-slate-500">{step.actor.email}</p>
                            )}
                          </div>

                          {step.routedTo && (
                            <div
                              className={`rounded-md p-2 border ${
                                step.routedTo.isRevisionReturn
                                  ? "bg-amber-50/90 border-amber-200 text-amber-950"
                                  : "bg-white border-slate-200/80 text-slate-800"
                              }`}
                            >
                              <span className="text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1 text-slate-600">
                                {step.routedTo.isRevisionReturn ? (
                                  <>
                                    <RotateCcw className="size-3 text-amber-700" />
                                    <span className="text-amber-900 font-bold">{step.routedTo.label}:</span>
                                  </>
                                ) : (
                                  <>
                                    <ArrowRight className="size-3 text-brand" />
                                    <span>{step.routedTo.label}:</span>
                                  </>
                                )}
                              </span>
                              <p className="font-bold text-slate-900 mt-0.5">{step.routedTo.personName}</p>
                              <p className="text-[11px] font-medium text-slate-600">
                                {step.routedTo.roleLabel}
                                {step.routedTo.personEmail ? ` · ${step.routedTo.personEmail}` : ""}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Alur Perubahan Posisi Status Dokumen (hanya jika ada perpindahan tahap) */}
                      {step.fromStageLabel && step.fromStageLabel !== step.toStageLabel && (
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 pt-0.5">
                          <span className="font-semibold text-slate-700">Perpindahan Posisi:</span>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            {step.fromStageLabel}
                          </span>
                          <ArrowRight className="size-3 text-slate-400" />
                          <span className="rounded bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
                            {step.toStageLabel}
                          </span>
                        </div>
                      )}

                      {/* Catatan / Alasan Revisi / Komentar Pemeriksa */}
                      {step.note && (
                        <div
                          className={`rounded-lg border p-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                            step.actionBadge.tone === "amber" || step.actionBadge.tone === "rose"
                              ? "border-amber-300 bg-amber-50/80 text-amber-950"
                              : "border-slate-200 bg-slate-50 text-slate-800"
                          }`}
                        >
                          <span className="font-bold block mb-0.5">
                            {step.actionBadge.tone === "amber"
                              ? "Catatan / Alasan Permintaan Revisi:"
                              : step.actionBadge.tone === "rose"
                              ? "Alasan Penolakan:"
                              : "Catatan / Keterangan:"}
                          </span>
                          {step.note}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </Card>
  )
}
