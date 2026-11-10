"use client"

import React, { useState } from "react"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DocumentPrintModal } from "@/components/documents/document-print-modal"
import { PrintableSphDocument, type PrintableSphProps } from "@/components/documents/printable-sph"
import { formatOfficialSalesNumber } from "@/lib/sales"

export function SphPrintTrigger({ document }: { document: PrintableSphProps["document"] }) {
  const [isOpen, setIsOpen] = useState(false)
  const docNumber = formatOfficialSalesNumber(document, "sph")

  return (
    <>
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
        className="gap-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold shadow-sm"
      >
        <Printer className="size-3.5" /> Cetak SPH Resmi (PDF Kop & QR)
      </Button>

      <DocumentPrintModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Dokumen Resmi: Surat Penawaran Harga (SPH)"
        documentNumber={docNumber}
      >
        <PrintableSphDocument document={document} />
      </DocumentPrintModal>
    </>
  )
}
