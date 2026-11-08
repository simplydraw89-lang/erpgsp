"use client"

import { useState, useActionState } from "react"
import Link from "next/link"
import {
  Users,
  FileText,
  Calendar,
  Calculator,
  Files,
  Receipt,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Send,
  Download,
  Eye,
  FileSpreadsheet,
  FileCheck,
  UserCheck,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { decideProjectAction, addProjectDirectorCommentAction } from "@/app/(workspace)/proyek/actions"

export type AttachmentItem = {
  id: string
  file_name: string
  content_type: string
  byte_size: number
}

export type DirectorInsight = {
  id: string
  author_id?: string
  author_name: string
  author_role: string
  section?: string
  comment: string
  created_at: string
}

function rupiah(num: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num || 0)
}

function formatDateID(dateStr?: string) {
  if (!dateStr) return "-"
  try {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

function formatSize(bytes: number) {
  if (!bytes) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ProjectDirectorConsole({
  project,
  attachments = [],
  insights = [],
  isDirut = false,
  isDirector = false,
  canReview = false,
  disabled = false,
}: {
  project: {
    id: string
    version: number
    code: string
    name: string
    approval_status: string
    contract_amount: number
    rab_total: number
    work_details: string | null
    starts_on: string | null
    ends_on: string | null
    manpower: Array<{ id: string; name: string; role: string; certification?: string; duration?: string }>
    timesheet_schedule: Array<{ id: string; phase: string; start_date?: string; end_date?: string; pic?: string }>
    rab_breakdown: Array<{ id: string; category: string; description: string; volume: number; unit: string; unit_price: number; total: number }>
    payment_terms?: Array<{ id?: string; index: number; name: string; percentage: number; amount: number; trigger: string; status?: string }>
    review_note?: string | null
  }
  attachments: AttachmentItem[]
  insights: DirectorInsight[]
  isDirut: boolean
  isDirector: boolean
  canReview: boolean
  disabled?: boolean
}) {
  const [activeTab, setActiveTab] = useState<"sdm" | "teknis" | "jadwal" | "rab" | "lampiran" | "termin">("sdm")
  const [insightSection, setInsightSection] = useState("general")

  // State untuk form keputusan pengesahan Dirut
  const [decisionState, decisionAction, isDecisionPending] = useActionState(decideProjectAction, undefined)
  // State untuk form kirim insight/komentar direktur
  const [commentState, commentAction, isCommentPending] = useActionState(addProjectDirectorCommentAction, undefined)

  const contractVal = Number(project.contract_amount) || 0
  const rabVal = Number(project.rab_total) || 0
  const margin = contractVal > 0 ? ((contractVal - rabVal) / contractVal) * 100 : 0

  function openAllAttachments() {
    attachments.forEach((att) => {
      window.open(`/api/invoice-documents/${att.id}`, "_blank", "noopener,noreferrer")
    })
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Status Verifikasi Direksi */}
      {project.approval_status === "director_review" && (
        <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-white p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="size-6 text-indigo-600 mt-1 shrink-0" />
              <div>
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-900">
                  Tahap Verifikasi & Pengesahan Direksi
                </span>
                <h2 className="mt-1 text-lg font-bold text-ink">
                  Konsol Pemeriksaan Dokumen Perencanaan Proyek
                </h2>
                <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed">
                  Para Direktur bertugas memeriksa 6 aspek kelengkapan perencanaan proyek di bawah ini (SDM, Teknis, Jadwal,
                  RAB Biaya, Berkas Lampiran, dan Termin Penagihan). Anda dapat memberikan catatan arahan atau insight bagi
                  cabang, serta mengesahkan (ACC) proyek bagi Direktur Utama.
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs text-muted">Nilai Kontrak SPK</p>
              <p className="text-lg font-bold text-brand">{rupiah(contractVal)}</p>
              <p className="text-xs text-muted">
                Pagu RAB: {rupiah(rabVal)} · Estimasi Margin:{" "}
                <span className="font-semibold text-emerald-700">{margin.toFixed(1)}%</span>
              </p>
            </div>
          </div>
        </Card>
      )}

      {project.approval_status === "revision_requested" && (
        <Card className="border-amber-200 bg-amber-50/80 p-5 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 text-amber-600 shrink-0" />
            <h3 className="font-bold text-amber-950 text-sm">Proyek Dikembalikan untuk Revisi Cabang</h3>
          </div>
          <p className="text-xs text-amber-900 leading-relaxed pl-7">
            <strong>Arahan Terakhir Direksi:</strong> {project.review_note || "Periksa dan lengkapi dokumen sesuai catatan di bawah."}
          </p>
        </Card>
      )}

      {/* 2. Segmented Tabs Pemeriksaan Dokumen (6 Bagian) */}
      <div className="rounded-2xl border border-line bg-white shadow-sm overflow-hidden">
        <div className="flex border-b border-line overflow-x-auto bg-slate-50/60">
          <button
            type="button"
            onClick={() => setActiveTab("sdm")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "sdm"
                ? "border-brand bg-white text-brand"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <Users className="size-4" />
            1. Tim SDM / Man Power ({project.manpower?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("teknis")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "teknis"
                ? "border-brand bg-white text-brand"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <FileText className="size-4" />
            2. Rincian Teknis & Deliverables
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("jadwal")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "jadwal"
                ? "border-brand bg-white text-brand"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <Calendar className="size-4" />
            3. Jadwal & Timesheet ({project.timesheet_schedule?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rab")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "rab"
                ? "border-brand bg-white text-brand"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <Calculator className="size-4" />
            4. Pos Anggaran RAB ({project.rab_breakdown?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("lampiran")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "lampiran"
                ? "border-brand bg-white text-brand"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <Files className="size-4 text-indigo-600" />
            5. Berkas Lampiran Resmi ({attachments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("termin")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "termin"
                ? "border-brand bg-white text-brand"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <Receipt className="size-4" />
            6. Termin Penagihan ({project.payment_terms?.length || 0})
          </button>
        </div>

        {/* Panel Konten per Bagian */}
        <div className="p-5">
          {/* TAB 1: SDM & MANPOWER */}
          {activeTab === "sdm" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <h3 className="font-semibold text-sm text-ink flex items-center gap-2">
                  <Users className="size-4 text-brand" /> Daftar Alokasi Personil / Tim SDM
                </h3>
                <span className="text-xs text-muted">Diperiksa Direksi: Kualifikasi & Durasi</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas text-muted">
                    <tr>
                      <th className="px-3 py-2">No</th>
                      <th className="px-3 py-2">Nama Personil</th>
                      <th className="px-3 py-2">Peran / Posisi</th>
                      <th className="px-3 py-2">Sertifikasi & Keahlian</th>
                      <th className="px-3 py-2">Durasi Pengerjaan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(project.manpower || []).map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2.5 text-muted">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-bold text-ink">{m.name || "Nama Belum Diisi"}</td>
                        <td className="px-3 py-2.5 font-medium text-slate-700">{m.role}</td>
                        <td className="px-3 py-2.5">
                          {m.certification ? (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-blue-800 text-[11px] font-medium">
                              <CheckCircle2 className="size-3 text-blue-600" /> {m.certification}
                            </span>
                          ) : (
                            <span className="text-muted italic">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{m.duration || "-"}</td>
                      </tr>
                    ))}
                    {(!project.manpower || project.manpower.length === 0) && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-muted">
                          Belum ada personil yang dicantumkan oleh cabang.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: TEKNIS & DELIVERABLES */}
          {activeTab === "teknis" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <h3 className="font-semibold text-sm text-ink flex items-center gap-2">
                  <FileText className="size-4 text-brand" /> Lingkup Teknis Pengerjaan & Deliverables
                </h3>
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span>Mulai: <strong>{formatDateID(project.starts_on || undefined)}</strong></span>
                  <span>Target Selesai: <strong>{formatDateID(project.ends_on || undefined)}</strong></span>
                </div>
              </div>
              <div className="rounded-xl border border-line bg-slate-50/70 p-4 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
                {project.work_details || "Belum ada rincian teknis pekerjaan yang dicantumkan."}
              </div>
            </div>
          )}

          {/* TAB 3: JADWAL & TIMESHEET */}
          {activeTab === "jadwal" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <h3 className="font-semibold text-sm text-ink flex items-center gap-2">
                  <Calendar className="size-4 text-brand" /> Jadwal Tahapan & Timesheet Pelaksanaan
                </h3>
                <span className="text-xs text-muted">{project.timesheet_schedule?.length || 0} tahapan pengerjaan</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas text-muted">
                    <tr>
                      <th className="px-3 py-2">Tahap</th>
                      <th className="px-3 py-2">Nama Tahapan Pekerjaan</th>
                      <th className="px-3 py-2">Mulai</th>
                      <th className="px-3 py-2">Selesai</th>
                      <th className="px-3 py-2">Penanggung Jawab (PIC)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(project.timesheet_schedule || []).map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2.5 text-muted">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-bold text-ink">{s.phase}</td>
                        <td className="px-3 py-2.5">{formatDateID(s.start_date)}</td>
                        <td className="px-3 py-2.5">{formatDateID(s.end_date)}</td>
                        <td className="px-3 py-2.5 font-medium text-slate-700">{s.pic || "-"}</td>
                      </tr>
                    ))}
                    {(!project.timesheet_schedule || project.timesheet_schedule.length === 0) && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-muted">
                          Belum ada tahapan jadwal yang dicantumkan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: RAB POS BIAYA */}
          {activeTab === "rab" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <div>
                  <h3 className="font-semibold text-sm text-ink flex items-center gap-2">
                    <Calculator className="size-4 text-brand" /> Rencana Anggaran Biaya (Pagu Biaya RAB)
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Pagu biaya yang diverifikasi direksi akan menjadi batas atas pengeluaran proyek.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted">Total RAB</p>
                  <p className="text-base font-bold text-brand">{rupiah(rabVal)}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas text-muted">
                    <tr>
                      <th className="px-3 py-2">Kategori</th>
                      <th className="px-3 py-2">Uraian Kebutuhan</th>
                      <th className="px-3 py-2 text-right">Volume</th>
                      <th className="px-3 py-2">Satuan</th>
                      <th className="px-3 py-2 text-right">Harga Satuan</th>
                      <th className="px-3 py-2 text-right">Total Pos (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(project.rab_breakdown || []).map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2.5 font-medium capitalize text-slate-700">
                          {r.category?.replace("_", " ")}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-ink">{r.description}</td>
                        <td className="px-3 py-2.5 text-right">{r.volume}</td>
                        <td className="px-3 py-2.5">{r.unit}</td>
                        <td className="px-3 py-2.5 text-right">{rupiah(r.unit_price)}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-ink">{rupiah(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-line font-bold">
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-right">
                        Total Pagu Anggaran Biaya (RAB):
                      </td>
                      <td className="px-3 py-3 text-right text-brand text-sm">{rupiah(rabVal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: LAMPIRAN BERKAS RESMI (DENGAN TAUTAN UNDUH/BUKA) */}
          {activeTab === "lampiran" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div>
                  <h3 className="font-semibold text-sm text-ink flex items-center gap-2">
                    <Files className="size-4 text-indigo-600" /> Berkas Dokumen Lampiran Proyek ({attachments.length})
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Berkas resmi yang diunggah cabang (KAK / TOR, Rincian RAB scan, Timesheet, Surat Tugas, dsb.)
                  </p>
                </div>
                {attachments.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={openAllAttachments}
                    className="gap-1.5 text-xs border-indigo-200 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-100 font-semibold"
                  >
                    <ExternalLink className="size-3.5" /> Buka Semua Lampiran Sekaligus
                  </Button>
                )}
              </div>

              {attachments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-6 text-center text-xs text-amber-900">
                  <p className="font-semibold">Belum ada dokumen lampiran yang diunggah untuk proyek ini.</p>
                  <p className="mt-1 text-amber-800 text-[11px]">
                    Cabang dapat mengunggah berkas KAK / TOR teknis dan rincian pendukung melalui formulir kelengkapan.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {attachments.map((att) => {
                    const isPdf = att.content_type?.includes("pdf") || att.file_name.endsWith(".pdf")
                    const isImage = att.content_type?.includes("image")
                    const isSpreadsheet = att.content_type?.includes("sheet") || att.file_name.endsWith(".xlsx") || att.file_name.endsWith(".csv")

                    return (
                      <div
                        key={att.id}
                        className="flex flex-col justify-between rounded-xl border border-line bg-slate-50/50 p-3.5 hover:border-brand/50 hover:bg-white transition space-y-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="rounded-lg bg-white p-2 border border-line shrink-0">
                            {isPdf ? (
                              <FileText className="size-6 text-red-500" />
                            ) : isImage ? (
                              <Eye className="size-6 text-blue-500" />
                            ) : isSpreadsheet ? (
                              <FileSpreadsheet className="size-6 text-emerald-600" />
                            ) : (
                              <Files className="size-6 text-indigo-500" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-xs text-ink truncate" title={att.file_name}>
                              {att.file_name}
                            </p>
                            <p className="text-[11px] text-muted mt-0.5">
                              {formatSize(att.byte_size)} · {att.content_type || "Dokumen"}
                            </p>
                          </div>
                        </div>

                        <div className="border-t border-line/60 pt-2 flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-500">Lampiran Resmi</span>
                          <a
                            href={`/api/invoice-documents/${att.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand/20 transition"
                          >
                            <Download className="size-3" /> Buka / Unduh
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: TERMIN PENAGIHAN */}
          {activeTab === "termin" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <h3 className="font-semibold text-sm text-ink flex items-center gap-2">
                  <Receipt className="size-4 text-brand" /> Jadwal Termin Penagihan ke Klien
                </h3>
                <span className="text-xs text-muted">
                  Total Kontrak: <strong>{rupiah(contractVal)}</strong>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas text-muted">
                    <tr>
                      <th className="px-3 py-2">Tahap</th>
                      <th className="px-3 py-2">Keterangan Termin</th>
                      <th className="px-3 py-2 text-right">Bobot (%)</th>
                      <th className="px-3 py-2 text-right">Nominal Tagihan (Rp)</th>
                      <th className="px-3 py-2">Syarat / Pemicu Tagihan</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(project.payment_terms || []).map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2.5 text-muted">Termin {idx + 1}</td>
                        <td className="px-3 py-2.5 font-bold text-ink">{t.name}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{t.percentage}%</td>
                        <td className="px-3 py-2.5 text-right font-bold text-brand">{rupiah(t.amount)}</td>
                        <td className="px-3 py-2.5 text-muted italic">{t.trigger || "Sesuai SPK"}</td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              t.status === "paid"
                                ? "bg-emerald-100 text-emerald-800"
                                : t.status === "invoiced"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {t.status === "paid" ? "✓ Lunas" : t.status === "invoiced" ? "⚡ Invoice Terbit" : "Rencana"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!project.payment_terms || project.payment_terms.length === 0) && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-muted">
                          Belum ada termin penagihan yang diatur.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Forum Catatan & Insight Arahan Direksi (Komentar 2 Arah untuk Admin Cabang) */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-brand" />
            <h3 className="font-bold text-ink text-sm">Catatan & Insight Arahan Direksi</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {insights.length} arahan
            </span>
          </div>
          <span className="text-xs text-muted">
            Direktur memberikan arahan perbaikan tanpa mengubah dokumen langsung
          </span>
        </div>

        {/* Riwayat Arahan Direksi */}
        <div className="space-y-3">
          {insights.map((ins) => (
            <div
              key={ins.id}
              className="rounded-xl border border-line bg-slate-50/60 p-3.5 space-y-1.5 text-xs transition"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-brand">{ins.author_name}</span>
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                    {ins.author_role}
                  </span>
                  {ins.section && ins.section !== "general" && (
                    <span className="rounded bg-slate-200/80 px-2 py-0.5 text-[10px] font-medium text-slate-700 uppercase">
                      Bagian: {ins.section}
                    </span>
                  )}
                </div>
                <time className="text-[11px] text-muted">{formatDateID(ins.created_at)}</time>
              </div>
              <p className="text-slate-800 leading-relaxed pl-1 whitespace-pre-wrap">{ins.comment}</p>
            </div>
          ))}

          {insights.length === 0 && (
            <p className="text-xs text-muted italic p-3 text-center bg-slate-50 rounded-lg">
              Belum ada catatan atau arahan spesifik dari Direksi untuk proyek ini.
            </p>
          )}
        </div>

        {/* Form Tambah Catatan & Arahan Direktur */}
        {!disabled && (isDirector || isDirut) && (
          <form action={commentAction} className="space-y-3 border-t border-line pt-3">
            <input type="hidden" name="id" value={project.id} />

            {commentState?.error && (
              <p className="rounded-lg bg-red-100 p-2.5 text-xs text-red-800 font-medium">{commentState.error}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="text-xs font-semibold text-slate-700">
                Beri Insight / Catatan Arahan Direksi:
              </label>
              <select
                name="section"
                value={insightSection}
                onChange={(e) => setInsightSection(e.target.value)}
                className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs text-slate-700"
              >
                <option value="general">Arahan Umum</option>
                <option value="sdm">Catatan untuk Tim SDM</option>
                <option value="teknis">Catatan untuk Rincian Teknis</option>
                <option value="jadwal">Catatan untuk Jadwal Pelaksanaan</option>
                <option value="rab">Catatan untuk Pos Biaya RAB</option>
                <option value="lampiran">Catatan untuk Berkas Lampiran</option>
                <option value="termin">Catatan untuk Termin Penagihan</option>
              </select>
            </div>

            <textarea
              name="comment"
              required
              rows={3}
              disabled={isCommentPending}
              placeholder="Tuliskan arahan pelaksanaan, catatan revisi dokumen, atau klarifikasi biaya untuk segera dijalankan oleh Admin Cabang..."
              className="w-full rounded-xl border border-line bg-white p-3 text-xs leading-relaxed text-ink focus:border-brand focus:outline-none"
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={isCommentPending}
                className="gap-1.5 bg-brand text-white hover:bg-brand/90 text-xs"
              >
                <Send className="size-3.5" /> Kirim Catatan Arahan ke Admin Cabang
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* 4. Konsol Keputusan Pengesahan Proyek (Khusus Direktur Utama saat status director_review) */}
      {canReview && isDirut && (
        <Card className="border-amber-300 bg-amber-50/50 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="size-5 text-amber-700 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-bold text-ink text-sm">Wewenang Pengesahan Akhir (Direktur Utama)</h3>
              <p className="text-xs text-muted mt-0.5">
                Setelah memeriksa seluruh kelengkapan dokumen di atas, tentukan keputusan: setujui untuk mengaktifkan proyek
                dan mengunci pagu RAB, atau kembalikan ke cabang dengan catatan revisi.
              </p>
            </div>
          </div>

          {decisionState?.error && (
            <p className="rounded-lg bg-red-100 p-2.5 text-xs text-red-800 font-medium">{decisionState.error}</p>
          )}

          <form action={decisionAction} className="space-y-4">
            <input type="hidden" name="id" value={project.id} />
            <input type="hidden" name="version" value={project.version} />

            <label className="block text-xs font-semibold text-slate-700">
              Catatan Keputusan Resmi Direktur Utama:
              <textarea
                name="note"
                rows={2}
                disabled={disabled || isDecisionPending}
                placeholder="Catatan resmi pengesahan atau instruksi revisi..."
                className="mt-1 block w-full rounded-xl border border-line bg-white p-2.5 text-xs text-ink leading-relaxed"
              />
            </label>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-amber-200">
              <Button
                type="submit"
                name="decision"
                value="revise"
                variant="secondary"
                disabled={disabled || isDecisionPending}
                className="gap-1.5 text-amber-800 border-amber-300 hover:bg-amber-100 text-xs font-semibold"
              >
                <RotateCcw className="size-4 text-amber-700" /> Kembalikan untuk Revisi Cabang
              </Button>
              <Button
                type="submit"
                name="decision"
                value="approve"
                disabled={disabled || isDecisionPending}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                <CheckCircle2 className="size-4" /> Setujui & Sahkan Proyek Resmi (ACC)
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
