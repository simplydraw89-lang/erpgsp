"use client"

import React, { useState } from "react"
import {
  FolderGit2,
  ExternalLink,
  Download,
  Eye,
  CheckCircle2,
  Share2,
  Copy,
  PlusCircle,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  FolderOpen,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { savePortalEntry } from "@/app/(workspace)/portal-proyek/actions"

export interface GoogleDriveItem {
  id: string
  title: string
  url: string
  description?: string
  sharedBy: string
  sharedAt: string
  type: "folder" | "file" | "doc" | "sheet"
}

interface GoogleDriveSyncPanelProps {
  projectId: string
  projectName: string
  canManage: boolean
  isClient: boolean
  driveItems?: GoogleDriveItem[]
}

/**
 * Parsing URL Google Drive untuk menentukan jenis dan ID berkas
 */
export function parseGoogleDriveUrl(url: string): {
  type: "folder" | "file" | "doc" | "sheet"
  id?: string
  previewUrl?: string
  downloadUrl?: string
} {
  const cleanUrl = url.trim()

  // 1. Google Drive Folder
  const folderMatch = cleanUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (folderMatch) {
    const id = folderMatch[1]
    return {
      type: "folder",
      id,
      previewUrl: `https://drive.google.com/embeddedfolderview?id=${id}#grid`,
    }
  }

  // 2. Google Drive File (PDF, Image, dsb)
  const fileMatch = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (fileMatch) {
    const id = fileMatch[1]
    return {
      type: "file",
      id,
      previewUrl: `https://drive.google.com/file/d/${id}/preview`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${id}`,
    }
  }

  // 3. Google Spreadsheets
  const sheetMatch = cleanUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (sheetMatch) {
    const id = sheetMatch[1]
    return {
      type: "sheet",
      id,
      previewUrl: `https://docs.google.com/spreadsheets/d/${id}/preview`,
    }
  }

  // 4. Google Docs
  const docMatch = cleanUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
  if (docMatch) {
    const id = docMatch[1]
    return {
      type: "doc",
      id,
      previewUrl: `https://docs.google.com/document/d/${id}/preview`,
    }
  }

  return { type: "folder", previewUrl: cleanUrl }
}

export function GoogleDriveSyncPanel({
  projectId,
  projectName,
  canManage,
  isClient,
  driveItems = [],
}: GoogleDriveSyncPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [activePreview, setActivePreview] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function copyLink(url: string, id: string) {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <section className="space-y-4 rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/30 via-white to-slate-50/40 p-5 shadow-sm dark:border-emerald-950 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 pb-4 dark:border-emerald-950">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
            <FolderOpen size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Google Drive Terintegrasi
              </span>
              <span className="text-xs text-muted">Akses Langsung Berkas Klien</span>
            </div>
            <h3 className="text-base font-bold text-ink">
              Dokumen Proyek dari Google Drive Milik Klien
            </h3>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="gap-1.5 bg-emerald-600 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          <PlusCircle size={14} />
          <span>{isClient ? "Bagikan Tautan Google Drive" : "Hubungkan Google Drive Klien"}</span>
        </Button>
      </div>

      {/* Form Tambah Tautan Google Drive Baru */}
      {showAddForm && (
        <Card className="border-emerald-300 bg-white p-4.5 shadow-md dark:border-emerald-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
              <Share2 size={14} className="text-emerald-600" />
              <span>
                {isClient
                  ? "Bagikan Folder / Berkas Google Drive ke Tim PIC Proyek"
                  : "Tambahkan Tautan Berkas Google Drive dari Klien"}
              </span>
            </h4>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-muted hover:text-ink font-semibold"
            >
              Tutup ✕
            </button>
          </div>

          <form action={savePortalEntry} className="mt-3.5 space-y-3">
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="kind" value="document" />
            <input type="hidden" name="audience" value="external" />

            <div>
              <label className="block text-xs font-medium text-ink">
                Judul Dokumen / Nama Folder Google Drive <span className="text-red-500">*</span>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="Contoh: Berkas AMDAL & Peta Tapak Proyek dari Klien"
                  className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink">
                Tautan / URL Google Drive (Folder Share atau File Link) <span className="text-red-500">*</span>
                <input
                  type="url"
                  name="body"
                  required
                  placeholder="https://drive.google.com/drive/folders/xxxx atau https://drive.google.com/file/d/xxxx"
                  className="mt-1 block w-full rounded-lg border border-line bg-white p-2 text-xs font-mono text-ink focus:border-brand focus:outline-none dark:bg-slate-800"
                />
              </label>
              <p className="mt-1 text-[11px] text-muted">
                💡 Pastikan perizinan Google Drive diatur ke <em>&quot;Anyone with the link can view&quot;</em> agar PIC proyek dapat langsung membaca dan mengunduh berkas.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowAddForm(false)}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700">
                <CheckCircle2 size={13} />
                <span>Simpan Tautan Drive</span>
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Embedded Live Previewer Jika Dipilih */}
      {activePreview && (
        <Card className="p-4 space-y-3 bg-slate-900 border-slate-800">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Eye size={15} className="text-emerald-400" />
              <span>Pratinjau Dokumen Google Drive Langsung di ERP</span>
            </div>
            <button
              type="button"
              onClick={() => setActivePreview(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Tutup Pratinjau ✕
            </button>
          </div>
          <div className="aspect-video w-full rounded-lg overflow-hidden border border-slate-700 bg-white">
            <iframe
              src={activePreview}
              title="Google Drive Document Preview"
              className="w-full h-full border-0"
              allow="autoplay"
            />
          </div>
        </Card>
      )}

      {/* Daftar Berkas / Folder Google Drive Klien */}
      <div className="space-y-2.5">
        {driveItems.length ? (
          driveItems.map((item) => {
            const parsed = parseGoogleDriveUrl(item.url)
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-3.5 shadow-sm transition hover:border-emerald-300 dark:bg-slate-900"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950">
                    {parsed.type === "sheet" ? (
                      <FileSpreadsheet size={18} />
                    ) : parsed.type === "file" || parsed.type === "doc" ? (
                      <FileText size={18} />
                    ) : (
                      <FolderGit2 size={18} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-ink truncate">{item.title}</h4>
                    <p className="text-[11px] text-muted truncate">
                      Dibagikan oleh: <span className="font-medium text-ink">{item.sharedBy}</span> · {item.sharedAt}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Tombol Pratinjau Langsung */}
                  {parsed.previewUrl && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setActivePreview(
                          activePreview === parsed.previewUrl ? null : parsed.previewUrl || null
                        )
                      }
                      className="gap-1.5 text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
                    >
                      <Eye size={12} />
                      <span>{activePreview === parsed.previewUrl ? "Tutup" : "Baca di ERP"}</span>
                    </Button>
                  )}

                  {/* Tombol Unduh Langsung jika ada downloadUrl */}
                  {parsed.downloadUrl && (
                    <a
                      href={parsed.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Download size={12} />
                      <span>Unduh</span>
                    </a>
                  )}

                  {/* Buka di Google Drive Asli */}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                  >
                    <span>Buka di GDrive</span>
                    <ExternalLink size={12} />
                  </a>

                  {/* Salin Tautan */}
                  <button
                    type="button"
                    onClick={() => copyLink(item.url, item.id)}
                    title="Salin tautan Google Drive"
                    className="rounded-lg border border-line p-1.5 text-muted hover:text-ink"
                  >
                    {copiedId === item.id ? (
                      <CheckCircle2 size={14} className="text-emerald-600" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-xl border border-dashed border-emerald-200/80 p-5 text-center dark:border-emerald-900/50">
            <p className="text-xs text-muted">
              Belum ada folder atau dokumen Google Drive yang dihubungkan ke proyek ini.
            </p>
            <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
              Klien dapat membagikan folder Google Drive miliknya di sini agar PIC proyek dapat langsung membaca dan mengunduh berkas.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
