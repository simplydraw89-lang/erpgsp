"use client"

import { useState } from "react"
import { reviewSpkRequest } from "@/app/(workspace)/pengajuan/penjualan/actions"
import { SubmitButton } from "@/components/procurement/submit-button"
import { procurementInput as input, procurementLabel as label } from "@/lib/procurement-ui"

export function SpkReviewForm({
  id,
  version,
  disabled,
}: {
  id: string
  version: number
  disabled: boolean
}) {
  const [decision, setDecision] = useState("approve")

  return (
    <form action={reviewSpkRequest} className="mt-4">
      <fieldset disabled={disabled} className="space-y-4">
        <input type="hidden" name="document_id" value={id} />
        <input type="hidden" name="version" value={version} />

        <label className={label}>
          Keputusan Persetujuan SPK (Direktur Utama)
          <select
            name="decision"
            value={decision}
            onChange={(event) => setDecision(event.target.value)}
            className={input}
          >
            <option value="approve">Setujui SPK & Buat Proyek Otomatis</option>
            <option value="revise">Minta Revisi ke Admin / Pengaju</option>
            <option value="reject">Tolak SPK</option>
          </select>
        </label>

        <label className={label}>
          {decision === "approve"
            ? "Catatan / Arahan Pelaksanaan Proyek (Opsional)"
            : "Alasan Revisi / Penolakan (Wajib Diisi)"}
          <textarea
            name="note"
            required={decision !== "approve"}
            maxLength={5000}
            rows={3}
            placeholder={
              decision === "approve"
                ? "Tambahkan instruksi pengerjaan proyek atau arahan teknis..."
                : "Tuliskan bagian mana yang perlu diperbaiki..."
            }
            className={input}
          />
        </label>

        <SubmitButton>
          {decision === "approve"
            ? "Setujui SPK & Buat Proyek"
            : decision === "revise"
            ? "Kirim Permintaan Revisi"
            : "Tolak SPK"}
        </SubmitButton>
      </fieldset>
    </form>
  )
}
