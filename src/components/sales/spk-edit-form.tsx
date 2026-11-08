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
  status,
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
  status?: string
  disabled: boolean
  roleHint?: string
}) {
  const [attachments, setAttachments] = useState<string[]>(initialAttachments)
  const [uploading, setUploading] = useState(false)
  const isDraftOrRevision = status === "draft" || status === "revision_requested"

  return (
    <form action={updateSalesSpk} className="mt-4">
      <fieldset disabled={disabled || uploading} className="space-y-4">
        <input type="hidden" name="document_id" value={id} />
        <input type="hidden" name="version" value={version} />

        {status === "revision_requested" && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950">
            <p className="font-semibold flex items-center gap-2">
              <span>⚡ Fast-Track Pengajuan Ulang ke Direktur Utama</span>
            </p>
            <p className="mt-1">
              SPK ini sebelumnya diminta revisi oleh <strong>Direktur Utama</strong>. Setelah Anda memperbaiki data dan mengajukannya, pengajuan akan <strong>langsung kembali ke meja Direktur Utama</strong>.
            </p>
          </div>
        )}

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

        <div className="flex flex-col-reverse gap-3 pt-3 border-t border-line sm:flex-row sm:items-center">
          <SubmitButton
            name="intent"
            value="draft"
            secondary
            disabled={uploading}
          >
            {isDraftOrRevision ? "Simpan Perubahan Draft" : "Simpan Perubahan SPK"}
          </SubmitButton>
          {isDraftOrRevision && (
            <SubmitButton
              name="intent"
              value="submit"
              disabled={uploading}
            >
              {status === "revision_requested"
                ? "Kirim Perbaikan Langsung ke Direktur Utama"
                : "Kirim Pengajuan SPK ke Direktur Utama"}
            </SubmitButton>
          )}
        </div>
      </fieldset>
    </form>
  )
}
