"use client"

import { useRef, useState } from "react"

export function DocumentUpload({ branchId, label, attachments, onChange, onBusyChange, disabled }: {
  branchId: string; label: string; attachments: string[]; onChange: (ids: string[]) => void;
  onBusyChange: (busy: boolean) => void; disabled?: boolean
}) {
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  async function upload() {
    const selected = Array.from(file.current?.files ?? [])
    if (!selected.length || !branchId || busy || attachments.length >= 10) return
    if (attachments.length + selected.length > 10) { setMessage("Maksimal 10 lampiran. Pilih lebih sedikit berkas."); return }
    setBusy(true); onBusyChange(true); setMessage("")
    const saved = [...attachments]
    try {
      for (const item of selected) {
        const body = new FormData()
        body.set("file", item); body.set("branch_id", branchId); body.set("mode", "sales-manual")
        const response = await fetch("/api/invoice-documents", { method: "POST", body })
        if (response.redirected || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Sesi berakhir. Silakan masuk kembali.")
        const result = await response.json()
        if (!response.ok) throw new Error(`${item.name}: ${result.error || "Dokumen gagal diunggah."}`)
        saved.push(result.id); onChange([...saved])
      }
      setMessage(`${selected.length} dokumen tersimpan privat. Simpan formulir untuk menghubungkan lampiran.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unggah dokumen gagal.") }
    finally { if (file.current) file.current.value = ""; setBusy(false); onBusyChange(false) }
  }
  return <div className="space-y-3 rounded-xl border border-line bg-canvas p-4">
    <p className="text-sm font-semibold">{label}</p>
    <p className="text-xs leading-5 text-muted">Unggah dokumen yang dibuat manual. PDF, PNG atau JPEG, maksimal 10 MB per berkas dan 10 lampiran. Dokumen disimpan tanpa OCR.</p>
    <input ref={file} type="file" multiple accept="application/pdf,image/png,image/jpeg" aria-label={label} disabled={disabled || busy || !branchId || attachments.length >= 10} className="block w-full text-sm" />
    <button type="button" onClick={upload} disabled={disabled || busy || !branchId || attachments.length >= 10} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Mengunggah…" : "+ Tambah lampiran"}</button>
    {attachments.length > 0 && <ul className="space-y-1 text-sm">{attachments.map((id, index) => <li key={id}><a href={`/api/invoice-documents/${id}`} target="_blank" rel="noopener noreferrer" className="text-brand">Buka lampiran {index + 1}</a></li>)}</ul>}
    {message && <p role="status" className="text-sm leading-6">{message}</p>}
  </div>
}
