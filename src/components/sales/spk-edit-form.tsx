"use client"

import { useState } from "react"
import { updateSalesSpk } from "@/app/(workspace)/pengajuan/penjualan/actions"
import { SubmitButton } from "@/components/procurement/submit-button"
import { DocumentUpload } from "./document-upload"
import { procurementInput as input, procurementLabel as label } from "@/lib/procurement-ui"

export function SpkEditForm({
  id,
  version,
  branchId,
  initialTitle,
  initialSource,
  initialNotes,
  initialAttachments,
  disabled,
  roleHint,
}: {
  id: string
  version: number
  branchId: string
  initialTitle: string
  initialSource: string
  initialNotes: string
  initialAttachments: string[]
  disabled: boolean
  roleHint?: string
}) {
  const [attachments, setAttachments] = useState<string[]>(initialAttachments)
  const [uploading, setUploading] = useState(false)

  return (
    <form action={updateSalesSpk} className="mt-4">
      <fieldset disabled={disabled || uploading} className="space-y-4">
        <input type="hidden" name="document_id" value={id} />
        <input type="hidden" name="version" value={version} />

        {roleHint && (
          <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900 border border-blue-200">
            {roleHint}
          </p>
        )}

        <label className={label}>
          Judul / Nomor SPK
          <input
            name="title"
            required
            maxLength={300}
            defaultValue={initialTitle}
            className={input}
          />
        </label>

        <label className={label}>
          SPK Diterbitkan Oleh
          <select name="source" defaultValue={initialSource} className={input}>
            <option value="company">Perusahaan</option>
            <option value="client">Klien</option>
          </select>
        </label>

        <label className={label}>
          Informasi Tambahan / Catatan SPK
          <textarea
            name="notes"
            rows={3}
            defaultValue={initialNotes}
            placeholder="Catatan pengerjaan atau detail kontrak..."
            className={input}
          />
        </label>

        <DocumentUpload
          branchId={branchId}
          label="Dokumen Lampiran SPK"
          attachments={attachments}
          onChange={setAttachments}
          onBusyChange={setUploading}
          disabled={disabled || uploading}
        />
        <input type="hidden" name="attachment_ids" value={JSON.stringify(attachments)} />

        <div className="pt-2">
          <SubmitButton disabled={uploading}>
            Simpan Perubahan SPK
          </SubmitButton>
        </div>
      </fieldset>
    </form>
  )
}
