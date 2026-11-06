"use client"

import { FileText, ExternalLink, Files } from "lucide-react"

export type AttachmentItem = {
  id: string
  file_name: string
  content_type: string
  byte_size: number
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentList({
  attachments,
  title = "Dokumen Lampiran & Kelengkapan",
}: {
  attachments: AttachmentItem[]
  title?: string
}) {
  if (!attachments || attachments.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-canvas/40 p-4 text-xs text-muted">
        Tidak ada dokumen lampiran yang diunggah.
      </div>
    )
  }

  function openAll() {
    attachments.forEach((att) => {
      window.open(`/api/invoice-documents/${att.id}`, "_blank", "noopener,noreferrer")
    })
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-canvas/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <Files size={17} className="text-brand" />
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-medium text-slate-700">
            {attachments.length} berkas
          </span>
        </div>
        {attachments.length > 1 && (
          <button
            type="button"
            onClick={openAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand/20 bg-brand/5 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand/10 transition-colors"
            title="Buka semua berkas lampiran sekaligus di tab baru"
          >
            <ExternalLink size={13} />
            Buka Semua Lampiran Sekaligus
          </button>
        )}
      </div>

      <ul className="divide-y divide-line/60">
        {attachments.map((file, idx) => (
          <li
            key={file.id}
            className="flex items-center justify-between gap-3 py-2 text-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex size-6 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-500 font-mono text-[10px]">
                {idx + 1}
              </span>
              <FileText size={16} className="shrink-0 text-slate-500" />
              <div className="min-w-0">
                <p className="truncate font-medium text-ink" title={file.file_name}>
                  {file.file_name || `Lampiran ${idx + 1}`}
                </p>
                <span className="text-[11px] text-muted">
                  {file.content_type.split("/")[1]?.toUpperCase() ?? "BERKAS"} • {formatSize(file.byte_size)}
                </span>
              </div>
            </div>

            <a
              href={`/api/invoice-documents/${file.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 font-medium text-brand hover:underline"
            >
              Lihat Dokumen
              <ExternalLink size={12} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
