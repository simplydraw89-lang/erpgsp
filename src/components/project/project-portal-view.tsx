"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import {
  FileText,
  MessageSquare,
  Sparkles,
  UploadCloud,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Eye,
  Send,
  Loader2,
  AlertCircle,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { savePortalEntry, savePortalComment } from "@/app/(workspace)/portal-proyek/actions"

export type PortalEntryItem = {
  id: string
  kind: "request" | "status" | "mom" | "document" | "correspondence" | "invoice_summary"
  audience: "internal" | "external"
  title: string
  body: string
  created_by: string
  created_at: string
  attachment_ids?: string[]
  metadata?: {
    meeting_date?: string
    agreed_points?: string[]
    action_items?: Array<{ task: string; pic?: string; deadline?: string }>
    summary?: string
    amdalnet_checklist?: string[]
    client_status?: string
    sender_type?: "company" | "client"
  }
  comments?: Array<{
    id: string
    user_id: string
    sender_name: string
    sender_role: "client" | "pic" | "team" | "director" | "owner"
    message: string
    created_at: string
  }>
}

export function ProjectPortalView({
  projectId,
  branchId,
  isInternal,
  isDirector,
  isClient,
  canSubmit,
  entries = [],
  disabled,
}: {
  projectId: string
  branchId: string
  isInternal: boolean
  isDirector: boolean
  isClient: boolean
  canSubmit: boolean
  entries: PortalEntryItem[]
  disabled?: boolean
}) {
  const [activeTab, setActiveTab] = useState<"requests" | "mom" | "all">("requests")
  const [showNewEntryForm, setShowNewEntryForm] = useState(false)
  const [newKind, setNewKind] = useState<"request" | "mom" | "status">("request")

  // MoM Smart OCR states
  const momFileInputRef = useRef<HTMLInputElement>(null)
  const [momOcrLoading, setMomOcrLoading] = useState(false)
  const [momOcrNotice, setMomOcrNotice] = useState<string | null>(null)

  // Form states for new entry
  const [entryTitle, setEntryTitle] = useState("")
  const [entryBody, setEntryBody] = useState("")
  const [entryMeetingDate, setEntryMeetingDate] = useState("")
  const [entryAgreedPoints, setEntryAgreedPoints] = useState<string[]>([])
  const [entryActionItems, setEntryActionItems] = useState<Array<{ task: string; pic?: string; deadline?: string }>>([])
  const [entryAttachments, setEntryAttachments] = useState<string[]>([])

  // Comment input per entry state
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})

  // Filter entries based on tab
  const requestEntries = entries.filter((e) => e.kind === "request" || e.kind === "status")
  const momEntries = entries.filter((e) => e.kind === "mom")
  const displayEntries = activeTab === "requests" ? requestEntries : activeTab === "mom" ? momEntries : entries

  // Handler for MoM Smart OCR Upload
  async function handleMomOcrUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setMomOcrLoading(true)
    setMomOcrNotice(null)

    try {
      const body = new FormData()
      body.set("file", file)
      body.set("branch_id", branchId)
      body.set("project_id", projectId)
      body.set("target", "mom")

      const response = await fetch("/api/project-documents", { method: "POST", body })
      if (!response.ok) throw new Error("Gagal membaca dokumen notulensi rapat.")

      const result = await response.json()
      if (result.id) {
        setEntryAttachments((prev) => [...prev, result.id])
      }

      const extracted = result.extracted || {}
      if (extracted.title) setEntryTitle(extracted.title)
      if (extracted.meeting_date) setEntryMeetingDate(extracted.meeting_date)
      if (extracted.summary) setEntryBody(extracted.summary)
      if (Array.isArray(extracted.agreed_points)) setEntryAgreedPoints(extracted.agreed_points)
      if (Array.isArray(extracted.action_items)) setEntryActionItems(extracted.action_items)

      setMomOcrNotice(
        `Dokumen notulensi "${file.name}" berhasil dianalisis dengan AI Gemini. Poin kesepakatan dan action items otomatis terisi.`
      )
      setNewKind("mom")
      setShowNewEntryForm(true)
    } catch (err) {
      setMomOcrNotice(err instanceof Error ? err.message : "Gagal memproses OCR dokumen.")
    } finally {
      setMomOcrLoading(false)
      if (momFileInputRef.current) momFileInputRef.current.value = ""
    }
  }

  function toggleComments(entryId: string) {
    setExpandedComments((prev) => ({ ...prev, [entryId]: !prev[entryId] }))
  }

  return (
    <div className="space-y-6">
      {/* Hidden File Input for MoM OCR */}
      <input
        ref={momFileInputRef}
        type="file"
        accept=".pdf,image/png,image/jpeg,image/webp"
        onChange={handleMomOcrUpload}
        className="hidden"
        disabled={disabled || momOcrLoading}
      />

      {/* Role Banner */}
      {isDirector && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900">
          <Eye className="size-4 shrink-0 text-blue-600" />
          <p>
            <strong>Mode Pengawas Direksi (Read-Only)</strong>: Anda memiliki wewenang untuk memantau seluruh laporan proyek, instruksi Amdalnet, notulensi MoM, serta riwayat tanya-jawab 2 arah tanpa dapat mengubah berita acara.
          </p>
        </div>
      )}

      {/* Segmented Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-2">
        <div className="flex border-b border-line gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("requests")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "requests" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <FileText className="size-4" />
            <span>Laporan & Permintaan Data (2 Arah)</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
              {requestEntries.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mom")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "mom" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <ShieldCheck className="size-4 text-indigo-600" />
            <span>Minutes of Meeting (MoM)</span>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-900">
              {momEntries.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "all" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <span>Semua Dokumen ({entries.length})</span>
          </button>
        </div>

        {/* Action Buttons for Authorized Users */}
        {!disabled && !isDirector && (canSubmit || isInternal) && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => momFileInputRef.current?.click()}
              disabled={momOcrLoading}
              className="gap-2 border-indigo-200 bg-indigo-50/80 text-indigo-950 hover:bg-indigo-100 text-xs font-semibold"
            >
              {momOcrLoading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin text-indigo-600" /> Menganalisis Notulensi...
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5 text-indigo-600" /> Upload Notulensi Rapat (Smart OCR)
                </>
              )}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowNewEntryForm(!showNewEntryForm)
                setNewKind("request")
              }}
              className="gap-1.5 bg-brand text-white hover:bg-brand/90 text-xs"
            >
              + {showNewEntryForm ? "Tutup Form" : "Buat Komunikasi / Permintaan Baru"}
            </Button>
          </div>
        )}
      </div>

      {/* Form Tambah Entry Baru (Permintaan Data / MoM) */}
      {showNewEntryForm && (
        <Card className="border-brand/30 p-5 space-y-4 bg-slate-50/50">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h3 className="font-semibold text-ink text-sm">
              {newKind === "mom"
                ? "Catat Minutes of Meeting (MoM) Resmi — Terkunci Setelah Disimpan"
                : "Kirim Permintaan Data / Instruksi Dokumen ke Klien (Amdalnet)"}
            </h3>
            <span className="text-xs text-muted">
              {newKind === "mom" ? "Berita Acara Rapat" : "Komunikasi 2 Arah"}
            </span>
          </div>

          {momOcrNotice && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-950 flex items-start gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
              <p>{momOcrNotice}</p>
            </div>
          )}

          <form action={savePortalEntry} className="space-y-4">
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="kind" value={newKind} />
            <input type="hidden" name="audience" value="external" />
            <input type="hidden" name="attachment_ids" value={JSON.stringify(entryAttachments)} />
            <input
              type="hidden"
              name="metadata"
              value={JSON.stringify({
                meeting_date: entryMeetingDate,
                agreed_points: entryAgreedPoints,
                action_items: entryActionItems,
                sender_type: isClient ? "client" : "company",
              })}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-medium text-slate-700">
                Jenis Informasi
                <select
                  value={newKind}
                  onChange={(e) => setNewKind(e.target.value as any)}
                  className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs"
                >
                  <option value="request">Permintaan Data & Checklist Amdalnet (2 Arah)</option>
                  <option value="mom">Minutes of Meeting (MoM) / Notulensi Rapat</option>
                  <option value="status">Update Laporan Progres Proyek</option>
                </select>
              </label>

              {newKind === "mom" && (
                <label className="block text-xs font-medium text-slate-700">
                  Tanggal Pelaksanaan Rapat
                  <input
                    type="date"
                    value={entryMeetingDate}
                    onChange={(e) => setEntryMeetingDate(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs"
                  />
                </label>
              )}
            </div>

            <label className="block text-xs font-medium text-slate-700">
              Judul / Agenda Utama
              <input
                required
                maxLength={200}
                value={entryTitle}
                placeholder={
                  newKind === "mom"
                    ? "e.g. Notulensi Rapat Koordinasi Penyusunan Dokumen AMDAL Tahap I"
                    : "e.g. Checklist Kebutuhan Data Pendukung untuk Upload Amdalnet"
                }
                onChange={(e) => setEntryTitle(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              Rincian Informasi / Instruksi / Notulensi Rapat
              <textarea
                required
                rows={5}
                value={entryBody}
                placeholder={
                  newKind === "mom"
                    ? "Ringkasan pembahasan dan catatan jalannya rapat..."
                    : "Jelaskan data teknis apa saja yang dibutuhkan. Jika perlu diupload klien ke website Amdalnet, sebutkan dokumen spesifiknya..."
                }
                onChange={(e) => setEntryBody(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-line bg-white p-2.5 text-xs leading-relaxed"
              />
            </label>

            {/* Poin Kesepakatan jika MoM */}
            {newKind === "mom" && entryAgreedPoints.length > 0 && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
                <p className="text-xs font-bold text-indigo-950">Poin Kesepakatan Terbaca (Smart OCR):</p>
                <ul className="list-disc list-inside text-xs text-indigo-900 space-y-1">
                  {entryAgreedPoints.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Items jika MoM */}
            {newKind === "mom" && entryActionItems.length > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
                <p className="text-xs font-bold text-emerald-950">Tindak Lanjut / Action Items:</p>
                <div className="space-y-1.5 text-xs">
                  {entryActionItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-emerald-900 border-b border-emerald-200/50 pb-1">
                      <span>• {item.task}</span>
                      <span className="font-semibold text-emerald-800 text-[11px]">
                        PIC: {item.pic || "Pihak Terkait"} {item.deadline ? `(${item.deadline})` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-line pt-3">
              <p className="text-[11px] text-muted italic">
                {newKind === "mom"
                  ? "⚠️ MoM yang disimpan akan langsung dikunci resmi (non-editable) demi menjaga integritas berita acara."
                  : "Klien & perusahaan akan saling terkoneksi dan menerima notifikasi atas permintaan ini."}
              </p>
              <Button type="submit" className="gap-2 bg-brand text-white">
                <Send className="size-4" /> Simpan & Bagikan ke Pihak Proyek
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* List of Entries */}
      <div className="space-y-4">
        {displayEntries.map((entry) => {
          const isMom = entry.kind === "mom"
          const isRequest = entry.kind === "request"
          const comments = entry.comments || []
          const isExpanded = expandedComments[entry.id] ?? false

          return (
            <Card
              key={entry.id}
              className={`p-5 space-y-4 transition ${
                isMom ? "border-indigo-200 bg-white" : "border-line bg-white"
              }`}
            >
              {/* Entry Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isMom
                        ? "bg-indigo-100 text-indigo-900 border border-indigo-200"
                        : isRequest
                        ? "bg-amber-100 text-amber-900 border border-amber-200"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {isMom ? "Minutes of Meeting (MoM)" : isRequest ? "Permintaan Data & Kebutuhan Dokumen" : "Status Proyek"}
                  </span>
                  {isMom && (
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 font-medium">
                      <ShieldCheck className="size-3 text-emerald-600" /> Berita Acara Terkunci (Non-Editable)
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted">
                  {new Intl.DateTimeFormat("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Bangkok",
                  }).format(new Date(entry.created_at))}
                </span>
              </div>

              {/* Title & Body */}
              <div>
                <h3 className="text-base font-bold text-ink">{entry.title}</h3>
                {entry.metadata?.meeting_date && (
                  <p className="text-xs text-muted mt-1 font-medium">
                    📅 Tanggal Pelaksanaan Rapat: {entry.metadata.meeting_date}
                  </p>
                )}
                <p className="mt-2.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-800">
                  {entry.body}
                </p>
              </div>

              {/* Poin Kesepakatan Khusus MoM */}
              {isMom && entry.metadata?.agreed_points && entry.metadata.agreed_points.length > 0 && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-2">
                  <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-indigo-600" /> Poin Kesepakatan Rapat:
                  </h4>
                  <ul className="list-disc list-inside text-xs text-indigo-900 space-y-1">
                    {entry.metadata.agreed_points.map((pt, idx) => (
                      <li key={idx}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items Khusus MoM */}
              {isMom && entry.metadata?.action_items && entry.metadata.action_items.length > 0 && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 space-y-2">
                  <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <Clock className="size-3.5 text-emerald-600" /> Tindak Lanjut & Tanggung Jawab:
                  </h4>
                  <div className="divide-y divide-emerald-200/50 text-xs">
                    {entry.metadata.action_items.map((act, idx) => (
                      <div key={idx} className="py-1.5 flex items-center justify-between">
                        <span className="text-emerald-950 font-medium">• {act.task}</span>
                        <span className="text-[11px] font-semibold text-emerald-800">
                          PIC: {act.pic || "Pihak Terkait"} {act.deadline ? `· Deadline: ${act.deadline}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lampiran Dokumen MoM / Berkas */}
              {(entry.attachment_ids ?? []).length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-line">
                  <span className="text-xs text-muted font-medium">Lampiran Dokumen:</span>
                  {entry.attachment_ids?.map((attId, idx) => (
                    <a
                      key={attId}
                      href={`/api/invoice-documents/${attId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-slate-200 transition"
                    >
                      <Download className="size-3" /> Berkas Notulensi {idx + 1}
                    </a>
                  ))}
                </div>
              )}

              {/* Section Komentar / Tanya Jawab 2 Arah */}
              <div className="border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => toggleComments(entry.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
                >
                  <MessageSquare className="size-3.5" />
                  <span>Diskusi & Tanya Jawab 2 Arah ({comments.length})</span>
                  {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                </button>

                {isExpanded && (
                  <div className="mt-3 space-y-3 pl-2 sm:pl-4 border-l-2 border-line">
                    {comments.map((c) => {
                      const isClientSender = c.sender_role === "client"
                      const isPicSender = c.sender_role === "pic" || c.sender_role === "team"
                      return (
                        <div
                          key={c.id}
                          className={`rounded-lg p-3 text-xs space-y-1 ${
                            isClientSender
                              ? "bg-amber-50/60 border border-amber-200/60"
                              : isPicSender
                              ? "bg-emerald-50/60 border border-emerald-200/60"
                              : "bg-slate-50 border border-line"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-ink flex items-center gap-1.5">
                              {c.sender_name}
                              <span
                                className={`rounded px-1.5 py-0.2 text-[10px] font-semibold uppercase ${
                                  isClientSender
                                    ? "bg-amber-200 text-amber-900"
                                    : isPicSender
                                    ? "bg-emerald-200 text-emerald-900"
                                    : "bg-slate-200 text-slate-800"
                                }`}
                              >
                                {isClientSender
                                  ? "Klien"
                                  : isPicSender
                                  ? "PIC Proyek"
                                  : c.sender_role === "director"
                                  ? "Direktur"
                                  : "Internal"}
                              </span>
                            </span>
                            <span className="text-[10px] text-muted">
                              {new Intl.DateTimeFormat("id-ID", {
                                dateStyle: "short",
                                timeStyle: "short",
                                timeZone: "Asia/Bangkok",
                              }).format(new Date(c.created_at))}
                            </span>
                          </div>
                          <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{c.message}</p>
                        </div>
                      )
                    })}

                    {!comments.length && (
                      <p className="text-xs text-muted italic">
                        Belum ada pertanyaan atau tanggapan pada dokumen ini.
                      </p>
                    )}

                    {/* Form Balas / Komentar jika bukan Direktur Read-Only */}
                    {!isDirector && !disabled && (
                      <form action={savePortalComment} className="flex gap-2 pt-1">
                        <input type="hidden" name="project_id" value={projectId} />
                        <input type="hidden" name="entry_id" value={entry.id} />
                        <input
                          type="text"
                          required
                          name="message"
                          placeholder={
                            isClient
                              ? "Tanyakan poin kesepakatan atau klarifikasi ke PIC proyek..."
                              : "Jawab pertanyaan klien atau berikan catatan teknis..."
                          }
                          className="flex-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs text-ink"
                        />
                        <Button type="submit" size="sm" className="gap-1 bg-brand text-white text-xs">
                          <Send className="size-3" /> Balas
                        </Button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )
        })}

        {!displayEntries.length && (
          <Card className="p-8 text-center text-sm text-muted">
            {activeTab === "mom"
              ? "Belum ada Minutes of Meeting (MoM) yang dicatat pada proyek ini. Tim proyek dapat mengunggah notulensi rapat dengan Smart OCR."
              : activeTab === "requests"
              ? "Belum ada komunikasi permintaan data / instruksi dokumen untuk proyek ini."
              : "Belum ada informasi yang dibagikan pada proyek ini."}
          </Card>
        )}
      </div>
    </div>
  )
}
