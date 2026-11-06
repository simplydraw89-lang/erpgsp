"use client"

import { useState, type ReactNode } from "react"
import { DocumentUpload } from "@/components/sales/document-upload"

export function PaymentSectionForm({
  branchId,
  children,
}: {
  branchId: string
  children: ReactNode
}) {
  const [attachments, setAttachments] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  return (
    <div className="space-y-4">
      <input type="hidden" name="payment_attachments" value={JSON.stringify(attachments)} />
      {children}
      <div className="pt-2 border-t border-line">
        <DocumentUpload
          branchId={branchId}
          label="Bukti transfer / pelunasan (opsional)"
          attachments={attachments}
          onChange={setAttachments}
          onBusyChange={setBusy}
        />
      </div>
    </div>
  )
}
