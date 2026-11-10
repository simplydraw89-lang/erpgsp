"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  MapPin,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { ProjectPortalView, type PortalEntryItem } from "@/components/project/project-portal-view"

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
  canSubmit?: boolean
}

export function ClientPortalDashboard({
  project,
  clientCompany,
  entries,
  projectAttachments = [],
  canSubmit = true,
}: ClientPortalDashboardProps) {
  // Hitung metrik ringkas
  const momCount = entries.filter((e) => e.kind === "mom").length
  const requestCount = entries.filter((e) => e.kind === "request" || e.kind === "status").length
  const documentCount = projectAttachments.length + entries.filter((e) => e.kind === "document").length

  // Progres tahapan default 65% untuk proyek aktif
  const progressPercent = 65

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
                <p className="text-xs text-slate-500">Status pengerjaan berdasarkan milestone teknis resmi</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Total Progres:</span>
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
              <span className="font-semibold text-teal-800">Tahap Uji Lab & Analisis Lapangan (Sedang Berjalan)</span>
              <span>Penyelesaian Dokumen</span>
            </div>
          </div>

          {/* Visual 5-Tahapan Milestone Flow */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                <span>1. Kontrak SPK</span>
              </div>
              <p className="text-[11px] text-emerald-700">SPK resmi telah disetujui Direktur Utama</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                <span>2. Tim SDM Ahli</span>
              </div>
              <p className="text-[11px] text-emerald-700">Mobilisasi tenaga ahli & personil lapangan</p>
            </div>

            <div className="rounded-xl border border-teal-300 bg-teal-50/70 p-3 space-y-1 relative">
              <div className="flex items-center gap-1.5 text-teal-900 font-bold text-xs">
                <Clock className="size-3.5 shrink-0 text-teal-600 animate-spin" />
                <span>3. Kajian Lapangan</span>
              </div>
              <p className="text-[11px] text-teal-800 font-medium">Sampling & pengujian laboratorium (75%)</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-xs">
                <span className="size-2 rounded-full bg-slate-400" />
                <span>4. Amdalnet & MoM</span>
              </div>
              <p className="text-[11px] text-slate-500">Koordinasi kelengkapan berkas & rapat berkala</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-xs">
                <span className="size-2 rounded-full bg-slate-400" />
                <span>5. Laporan Akhir</span>
              </div>
              <p className="text-[11px] text-slate-500">Penyerahan dokumen & berita acara serah terima</p>
            </div>
          </div>

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

      {/* 2. BAGIAN BAWAH: RUANG KOLABORASI PORTAL PROYEK (LANGSUNG PADA HALAMAN YANG SAMA) */}
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
            entries={entries}
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
