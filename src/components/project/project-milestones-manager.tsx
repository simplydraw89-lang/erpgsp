"use client"

import { useRef, useState } from "react"
import {
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  FileCheck2,
  FileText,
  Layers,
  Loader2,
  Paperclip,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import type { ProjectMilestoneItem } from "@/lib/project-milestone-types"
import { updateProjectMilestonesAction } from "./actions"

export type MilestoneAttachmentOption = {
  id: string
  file_name: string
  content_type: string
  byte_size: number
}

interface ProjectMilestonesManagerProps {
  projectId: string
  branchId?: string
  initialMilestones: ProjectMilestoneItem[]
  disabled?: boolean
  availableAttachments?: MilestoneAttachmentOption[]
}

export function ProjectMilestonesManager({
  projectId,
  branchId,
  initialMilestones,
  disabled = false,
  availableAttachments = [],
}: ProjectMilestonesManagerProps) {
  const [milestones, setMilestones] = useState<ProjectMilestoneItem[]>(initialMilestones)
  const [localAttachments, setLocalAttachments] = useState<MilestoneAttachmentOption[]>(availableAttachments)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentEditing = editingIndex !== null ? milestones[editingIndex] : null

  const updateField = <K extends keyof ProjectMilestoneItem>(field: K, value: ProjectMilestoneItem[K]) => {
    if (editingIndex === null) return
    setMilestones((prev) => {
      const next = [...prev]
      next[editingIndex] = {
        ...next[editingIndex],
        [field]: value,
      }
      return next
    })
  }

  const addDeliverable = () => {
    if (editingIndex === null) return
    const current = milestones[editingIndex].deliverables || []
    updateField("deliverables", [...current, "Dokumen Hasil Baru"])
  }

  const updateDeliverable = (idx: number, val: string) => {
    if (editingIndex === null) return
    const current = [...(milestones[editingIndex].deliverables || [])]
    current[idx] = val
    updateField("deliverables", current)
  }

  const removeDeliverable = (idx: number) => {
    if (editingIndex === null) return
    const current = [...(milestones[editingIndex].deliverables || [])]
    current.splice(idx, 1)
    updateField("deliverables", current)
  }

  const addClientAction = () => {
    if (editingIndex === null) return
    const current = milestones[editingIndex].clientActions || []
    updateField("clientActions", [...current, "Kebutuhan Data Baru dari Klien"])
  }

  const updateClientAction = (idx: number, val: string) => {
    if (editingIndex === null) return
    const current = [...(milestones[editingIndex].clientActions || [])]
    current[idx] = val
    updateField("clientActions", current)
  }

  const removeClientAction = (idx: number) => {
    if (editingIndex === null) return
    const current = [...(milestones[editingIndex].clientActions || [])]
    current.splice(idx, 1)
    updateField("clientActions", current)
  }

  const toggleAttachment = (att: MilestoneAttachmentOption) => {
    if (editingIndex === null) return
    const current = milestones[editingIndex].attachment_ids || []
    const currentNames = { ...(milestones[editingIndex].attachment_names || {}) }

    if (current.includes(att.id)) {
      delete currentNames[att.id]
      setMilestones((prev) => {
        const next = [...prev]
        next[editingIndex] = {
          ...next[editingIndex],
          attachment_ids: current.filter((id) => id !== att.id),
          attachment_names: currentNames,
        }
        return next
      })
    } else {
      currentNames[att.id] = att.file_name
      setMilestones((prev) => {
        const next = [...prev]
        next[editingIndex] = {
          ...next[editingIndex],
          attachment_ids: [...current, att.id],
          attachment_names: currentNames,
        }
        return next
      })
    }
  }

  const handleUploadDeliverableFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || editingIndex === null) return

    if (!branchId) {
      setErrorMsg("Cabang proyek belum ditetapkan sehingga berkas belum dapat diunggah.")
      return
    }

    setIsUploading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const formData = new FormData()
      formData.set("file", file)
      formData.set("branch_id", branchId)
      formData.set("skip_ocr", "true")

      const res = await fetch("/api/project-documents", {
        method: "POST",
        body: formData,
      })

      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload?.error || "Gagal mengunggah berkas resmi tahapan.")
      }

      const newAtt: MilestoneAttachmentOption = {
        id: payload.id,
        file_name: payload.fileName || file.name,
        content_type: payload.contentType || file.type,
        byte_size: Number(payload.fileSize || file.size),
      }

      setLocalAttachments((prev) => [newAtt, ...prev.filter((item) => item.id !== newAtt.id)])
      setMilestones((prev) => {
        const next = [...prev]
        const targetMilestone = next[editingIndex]
        const existingIds = targetMilestone.attachment_ids || []
        const existingNames = { ...(targetMilestone.attachment_names || {}) }
        existingNames[newAtt.id] = newAtt.file_name
        next[editingIndex] = {
          ...targetMilestone,
          attachment_ids: existingIds.includes(newAtt.id) ? existingIds : [...existingIds, newAtt.id],
          attachment_names: existingNames,
        }
        return next
      })

      setSuccessMsg(
        `Berkas "${newAtt.file_name}" berhasil diunggah dan ditautkan ke ${milestones[editingIndex].title}. Klik "Simpan Semua Perubahan" untuk mempublikasikan ke Dashboard Klien.`
      )
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal mengunggah dokumen tahapan.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSaveAll = async () => {
    setIsSaving(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const res = await updateProjectMilestonesAction(projectId, milestones)
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setSuccessMsg("Seluruh milestone proyek berhasil disimpan & langsung tersinkronisasi ke Dashboard Klien.")
        setEditingIndex(null)
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan perubahan.")
    } finally {
      setIsSaving(false)
    }
  }

  const overallProgress = Math.round(
    milestones.reduce((acc, m) => acc + (Number(m.progress) || 0), 0) / (milestones.length || 1)
  )

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/png,image/jpeg"
        onChange={handleUploadDeliverableFile}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Header Info */}
      <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-emerald-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 border border-teal-300 px-2.5 py-0.5 text-xs font-bold text-teal-800">
                <Layers className="size-3.5 text-teal-700" />
                Kelola Milestone &amp; Laporan Klien
              </span>
              <span className="text-xs text-slate-500 font-medium">Khusus PM / PIC Proyek</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Kustomisasi Tahapan Proyek &amp; Laporan Interaktif
            </h2>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Atur status, persentase progres, nama PIC, rincian narasi teknis, daftar deliverables, serta unggah berkas resmi (seperti CoA Lab, Berita Acara, dll). Data ini langsung ditampilkan secara real-time di Dashboard Klien.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Total Progres Rata-rata:</span>
              <span className="text-xl font-extrabold text-teal-700">{overallProgress}%</span>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-800 transition disabled:opacity-50 cursor-pointer"
              >
                <Save className="size-4" />
                {isSaving ? "Menyimpan ke Sistem..." : "Simpan Semua Perubahan"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs font-medium text-red-950 flex items-center gap-2">
          <X className="size-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-medium text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid Kartu Milestone */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {milestones.map((m, idx) => {
          const isSelected = editingIndex === idx
          const isDone = m.status === "completed"
          const isCurrent = m.status === "in_progress"

          return (
            <Card
              key={m.milestone_number || idx}
              className={`p-4 rounded-xl space-y-3 transition border ${
                isSelected
                  ? "border-2 border-teal-600 bg-teal-50/70 shadow-md ring-2 ring-teal-500/20"
                  : isDone
                  ? "border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60"
                  : isCurrent
                  ? "border-teal-300 bg-teal-50/40 hover:bg-teal-50/80"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  {isDone ? (
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  ) : isCurrent ? (
                    <Clock className="size-4 text-teal-600 animate-spin shrink-0" />
                  ) : (
                    <span className="size-2 rounded-full bg-slate-400" />
                  )}
                  <span className={isDone ? "text-emerald-900" : isCurrent ? "text-teal-950" : "text-slate-700"}>
                    {m.title}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                {m.subtitle || "Belum ada keterangan sub-tahapan"}
              </p>

              <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span className="text-slate-500">Progres:</span>
                  <span className="text-teal-700">{m.progress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-600 transition-all duration-300"
                    style={{ width: `${m.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isDone
                    ? "bg-emerald-100 text-emerald-800"
                    : isCurrent
                    ? "bg-teal-100 text-teal-900"
                    : "bg-slate-100 text-slate-700"
                }`}>
                  {isDone ? "Selesai" : isCurrent ? "Sedang Berjalan" : "Akan Datang"}
                </span>

                {!disabled && (
                  <button
                    type="button"
                    onClick={() => setEditingIndex(isSelected ? null : idx)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 transition cursor-pointer"
                  >
                    <Edit3 className="size-3" />
                    <span>{isSelected ? "Tutup" : "Edit Form"}</span>
                  </button>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* FORM / MODAL EDITOR SAAT TAHAPAN DIPILIH */}
      {currentEditing && (
        <Card className="p-6 rounded-2xl border-2 border-teal-500 bg-white shadow-lg space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-teal-600 text-white font-bold text-xs">
                {currentEditing.milestone_number}
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Form Pengaturan: {currentEditing.title}
                </h3>
                <p className="text-xs text-slate-500">
                  Sesuaikan rincian teknis, bobot progres, PIC, deliverables, dan lampiran berkas resmi.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setEditingIndex(null)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              aria-label="Tutup form"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700">Judul Tahapan</label>
              <input
                type="text"
                value={currentEditing.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none"
                placeholder="Contoh: 3. Kajian Lapangan & Uji Laboratorium"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700">Sub-judul / Ringkasan Aksi</label>
              <input
                type="text"
                value={currentEditing.subtitle}
                onChange={(e) => updateField("subtitle", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none"
                placeholder="Contoh: Pengambilan sampel rona awal & uji parameter lingkungan"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Status Tahapan</label>
              <select
                value={currentEditing.status}
                onChange={(e) => {
                  const val = e.target.value as ProjectMilestoneItem["status"]
                  updateField("status", val)
                  if (val === "completed") updateField("progress", 100)
                  else if (val === "upcoming") updateField("progress", 0)
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none bg-white"
              >
                <option value="upcoming">⚪ Akan Datang (Upcoming)</option>
                <option value="in_progress">⏳ Sedang Dikerjakan (In Progress)</option>
                <option value="completed">✓ Tahap Selesai (Completed)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Persentase Progres ({currentEditing.progress}%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={currentEditing.progress}
                  onChange={(e) => updateField("progress", Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={currentEditing.progress}
                  onChange={(e) => updateField("progress", Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-16 rounded-xl border border-slate-300 px-2 py-1.5 text-xs text-center font-bold text-teal-800 focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Penanggung Jawab (PIC)</label>
              <input
                type="text"
                value={currentEditing.pic}
                onChange={(e) => updateField("pic", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none"
                placeholder="Contoh: Koordinator Tim Lapangan & Lab"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Periode Waktu Pelaksanaan</label>
              <input
                type="text"
                value={currentEditing.period}
                onChange={(e) => updateField("period", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none"
                placeholder="Contoh: Sedang Berjalan (Estimasi: 7 Hari)"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Narasi Rincian Teknis Pekerjaan</label>
            <textarea
              rows={3}
              value={currentEditing.description}
              onChange={(e) => updateField("description", e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3 text-xs focus:border-teal-500 focus:outline-none leading-relaxed"
              placeholder="Jelaskan secara rinci apa yang sedang/telah dikerjakan pada tahapan ini..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                  <FileCheck2 className="size-4 text-teal-700" />
                  <span>Daftar Dokumen Hasil (Deliverables):</span>
                </span>
                <button
                  type="button"
                  onClick={addDeliverable}
                  className="inline-flex items-center gap-1 rounded-lg bg-teal-100 text-teal-800 px-2 py-1 text-[11px] font-bold hover:bg-teal-200 transition cursor-pointer"
                >
                  <Plus className="size-3" /> Tambah
                </button>
              </div>

              <div className="space-y-2">
                {(currentEditing.deliverables || []).map((item, dIdx) => (
                  <div key={dIdx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateDeliverable(dIdx, e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-teal-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeDeliverable(dIdx)}
                      className="p-1 text-slate-400 hover:text-red-600 transition"
                      aria-label="Hapus item"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-blue-700" />
                  <span>Kebutuhan Data &amp; Tindakan Klien:</span>
                </span>
                <button
                  type="button"
                  onClick={addClientAction}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-100 text-blue-800 px-2 py-1 text-[11px] font-bold hover:bg-blue-200 transition cursor-pointer"
                >
                  <Plus className="size-3" /> Tambah
                </button>
              </div>

              <div className="space-y-2">
                {(currentEditing.clientActions || []).map((item, cIdx) => (
                  <div key={cIdx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateClientAction(cIdx, e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeClientAction(cIdx)}
                      className="p-1 text-slate-400 hover:text-red-600 transition"
                      aria-label="Hapus item"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Unggah & Lampirkan Berkas Resmi per Tahapan */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Paperclip className="size-4 text-teal-700" />
                  <span>Berkas Dokumen Resmi Tahapan (CoA Lab, Berita Acara, SPK, dll):</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Unggah dokumen baru (PDF/PNG/JPG maks. 10 MB) atau centang berkas proyek yang sudah tersedia.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-600">
                  Terlampir: {(currentEditing.attachment_ids || []).length} berkas
                </span>
                {branchId && !disabled && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-800 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Mengunggah...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="size-3.5" />
                        <span>Unggah Berkas Baru</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {localAttachments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {localAttachments.map((att) => {
                  const isChecked = (currentEditing.attachment_ids || []).includes(att.id)
                  return (
                    <div
                      key={att.id}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs transition ${
                        isChecked
                          ? "border-teal-500 bg-teal-50 text-teal-950 font-semibold"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleAttachment(att)}
                          className="rounded accent-teal-600 size-3.5 shrink-0"
                        />
                        <FileText className="size-3.5 text-slate-500 shrink-0" />
                        <span className="truncate flex-1" title={att.file_name}>
                          {att.file_name}
                        </span>
                      </label>
                      <a
                        href={`/api/invoice-documents/${att.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-slate-400 hover:text-teal-700 shrink-0"
                        title="Lihat berkas"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Belum ada berkas terlampir. Gunakan tombol &quot;Unggah Berkas Baru&quot; untuk melampirkan CoA Lab, Berita Acara, atau dokumen resmi lainnya.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setEditingIndex(null)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Tutup Editor Tahap Ini
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-5 py-2 text-xs font-bold text-white shadow hover:bg-teal-800 transition disabled:opacity-50 cursor-pointer"
            >
              <Save className="size-4" />
              <span>{isSaving ? "Menyimpan..." : "Simpan Semua Perubahan"}</span>
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}
