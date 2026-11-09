"use client"

import React, { useState } from "react"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DocumentPrintModal } from "@/components/documents/document-print-modal"
import { PrintableSpkDocument, type PrintableSpkProps } from "@/components/documents/printable-spk"

export function SpkPrintTrigger({ document }: { document: PrintableSpkProps["document"] }) {
  const [isOpen, setIsOpen] = useState(false)
  const docNumber = document.document_number || `SPK-${document.id.slice(0, 8).toUpperCase()}`

  return (
    <>
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
        className="gap-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold shadow-sm"
      >
        <Printer className="size-3.5" /> Cetak SPK Resmi (PDF Kop & QR)
      </Button>

      <DocumentPrintModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Dokumen Resmi: Surat Perintah Kerja (SPK)"
        documentNumber={docNumber}
      >
        <PrintableSpkDocument document={document} />
      </DocumentPrintModal>
    </>
  )
}
