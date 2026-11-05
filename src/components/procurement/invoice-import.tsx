"use client"

import { useEffect, useRef, useState } from "react"

export type ExtractedInvoice = {
  text: string
  warnings?: string[]
  invoice_number?: string
  invoice_date?: string
  vendor_name?: string
  vendor_address?: string
  tax_invoice_number?: string
  tax_invoice_date?: string
  lines?: { description: string; amount: number }[]
}

export function InvoiceImport({ branchId, disabled, mode = "invoice", onExtracted, onAttachment, onBusyChange, existingAttachmentId }: {
  branchId: string; disabled?: boolean; mode?: "invoice" | "spk"
  existingAttachmentId?: string
  onExtracted?: (data: ExtractedInvoice) => void
  onAttachment?: (id: string) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const currentBranch = useRef(branchId)
  useEffect(() => { currentBranch.current = branchId }, [branchId])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [recognizedText, setRecognizedText] = useState("")
  const [uploaded, setUploaded] = useState<{id:string;branch:string} | null>(null)
  const retryId = uploaded?.branch === branchId ? uploaded.id : existingAttachmentId
  async function upload(retry = false) {
    const file = fileRef.current?.files?.[0]
    if ((!retry && !file) || (retry && !retryId) || !branchId || busy) return
    setBusy(true); setMessage("")
    onBusyChange?.(true)
    const uploadBranch = branchId
    try {
      const body = new FormData()
      if (file) body.set("file", file)
      body.set("branch_id", branchId); body.set("mode", mode)
      const response = await fetch(retry ? `/api/invoice-documents/${retryId}` : "/api/invoice-documents", { method: "POST", ...(retry ? {} : {body}) })
      if (response.redirected || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Sesi berakhir. Silakan masuk kembali sebelum mengunggah dokumen.")
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Dokumen gagal diunggah.")
      if (currentBranch.current !== uploadBranch) { setMessage("Dokumen tersimpan di cabang semula. Cabang form berubah saat proses berlangsung; unggah kembali di cabang yang sesuai."); return }
      onAttachment?.(data.id)
      setUploaded({id:data.id,branch:uploadBranch})
      if (data.extracted) { setRecognizedText(data.extracted.text); onExtracted?.(data.extracted) }
      setMessage(data.warning || (data.extracted?.warnings?.length
        ? `Dokumen disimpan privat. ${data.extracted.warnings.join(" ")}`
        : "Dokumen disimpan privat. Hasil pembacaan sudah disalin; periksa setiap isian sebelum menyimpan."))
      if (fileRef.current) fileRef.current.value = ""
    } catch (error) { setMessage(error instanceof Error ? error.message : "Dokumen gagal diproses.") }
    finally { setBusy(false); onBusyChange?.(false) }
  }
  return <div className="space-y-3 rounded-xl border border-line bg-canvas p-4">
    <p className="text-sm font-semibold">Unggah {mode === "spk" ? "SPK" : "invoice"} dan baca dokumen</p>
    <p className="text-xs leading-5 text-muted">PDF digital dibaca langsung; PDF pindai dan PNG/JPEG dibaca dengan OCR Windows lokal. Maksimal 10 MB dan lima halaman. Hanya isian yang terbaca disalin ke form; periksa nominal, vendor, pajak, dan COA sebelum menyimpan.</p>
    <input ref={fileRef} type="file" accept="image/png,image/jpeg,application/pdf" disabled={disabled || busy || !branchId} className="block w-full text-sm" aria-label={`Dokumen ${mode}`} />
    <button type="button" onClick={() => upload()} disabled={disabled || busy || !branchId} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Memproses dokumen…" : "Unggah dan baca"}</button>
    {retryId && <button type="button" onClick={() => upload(true)} disabled={disabled || busy || !branchId} className="ml-3 rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">Baca ulang tanpa unggah</button>}
    {retryId && <a href={`/api/invoice-documents/${retryId}`} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg px-3 py-2 text-sm font-semibold text-brand">Lihat dokumen di tab baru ↗</a>}
    {message && <p role="status" className="text-sm leading-6">{message}</p>}
    {recognizedText && <details><summary className="cursor-pointer text-sm font-medium">Lihat teks hasil OCR</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs">{recognizedText}</pre></details>}
  </div>
}
