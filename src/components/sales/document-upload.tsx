"use client"

import { useRef, useState, useEffect } from "react"
import { FileText, ExternalLink, Trash2, UploadCloud } from "lucide-react"

type UploadedItem = {
  id: string
  name: string
  size?: number
}

export function DocumentUpload({
  branchId,
  label,
  attachments,
  onChange,
  onBusyChange,
  disabled,
}: {
  branchId: string
  label: string
  attachments: string[]
  onChange: (ids: string[]) => void
  onBusyChange: (busy: boolean) => void
  disabled?: boolean
}) {
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [items, setItems] = useState<UploadedItem[]>([])

  // Load existing attachment details if already uploaded
  useEffect(() => {
    if (!attachments || attachments.length === 0) {
      setItems([])
      return
    }

    // Keep existing cached items that are still in attachments
    setItems((prev) => {
      const existingMap = new Map(prev.map((i) => [i.id, i]))
      return attachments.map((id, idx) => existingMap.get(id) || { id, name: `Lampiran ${idx + 1}` })
    })
  }, [attachments])

  async function upload() {
    const selected = Array.from(file.current?.files ?? [])
    if (!selected.length || !branchId || busy || attachments.length >= 10) return
    if (attachments.length + selected.length > 10) {
      setMessage("Maksimal 10 lampiran. Pilih lebih sedikit berkas.")
      return
    }

    setBusy(true)
    onBusyChange(true)
    setMessage("")

    const newAttachments = [...attachments]
    const newItems = [...items]

    try {
      for (const item of selected) {
        const body = new FormData()
        body.set("file", item)
        body.set("branch_id", branchId)
        body.set("mode", "sales-manual")

        const response = await fetch("/api/invoice-documents", { method: "POST", body })
        if (response.redirected || !response.headers.get("content-type")?.includes("application/json")) {
          throw new Error("Sesi berakhir. Silakan masuk kembali.")
        }

        const result = await response.json()
        if (!response.ok) {
          throw new Error(`${item.name}: ${result.error || "Dokumen gagal diunggah."}`)
        }

        newAttachments.push(result.id)
        newItems.push({ id: result.id, name: item.name, size: item.size })
      }

      setItems(newItems)
      onChange(newAttachments)
      setMessage(`${selected.length} dokumen berhasil diunggah. Lengkapi isian form dan simpan/submit SPH.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unggah dokumen gagal.")
    } finally {
      if (file.current) file.current.value = ""
      setBusy(false)
      onBusyChange(false)
    }
  }

  function removeAttachment(idToRemove: string) {
    if (disabled || busy) return
    const updatedAttachments = attachments.filter((id) => id !== idToRemove)
    const updatedItems = items.filter((item) => item.id !== idToRemove)
    setItems(updatedItems)
    onChange(updatedAttachments)
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-canvas/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="text-xs leading-5 text-muted">
            Unggah dokumen pendukung SPH (Surat Penawaran, RAB, Kerangka Kerja, dll). PDF, PNG, JPEG maks 10 MB per berkas.
          </p>
        </div>
        <span className="text-xs text-muted font-medium">
          {attachments.length}/10 berkas
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={file}
          type="file"
          multiple
          accept="application/pdf,image/png,image/jpeg"
          aria-label={label}
          disabled={disabled || busy || !branchId || attachments.length >= 10}
          className="text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
        />
        <button
          type="button"
          onClick={upload}
          disabled={disabled || busy || !branchId || attachments.length >= 10}
          className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:bg-brand/90 transition-colors"
        >
          <UploadCloud size={14} />
          {busy ? "Mengunggah..." : "+ Unggah Lampiran"}
        </button>
      </div>

      {items.length > 0 && (
        <ul className="mt-3 divide-y divide-line/60 rounded-lg border border-line bg-white px-3 py-1">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={15} className="shrink-0 text-slate-500" />
                <span className="truncate font-medium text-ink" title={item.name}>
                  {item.name}
                </span>
                {item.size ? (
                  <span className="text-[11px] text-muted shrink-0">
                    ({(item.size / 1024).toFixed(0)} KB)
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <a
                  href={`/api/invoice-documents/${item.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                >
                  Lihat
                  <ExternalLink size={12} />
                </a>

                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeAttachment(item.id)}
                    className="text-rose-500 hover:text-rose-700 transition-colors"
                    title="Hapus lampiran ini"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {message && (
        <p role="status" className="text-xs leading-5 text-brand font-medium">
          {message}
        </p>
      )}
    </div>
  )
}
