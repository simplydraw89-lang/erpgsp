"use client"

import React, { useState } from "react"
import Image from "next/image"
import { Printer, Download, X, Eye, ShieldCheck, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

export function DocumentPrintModal({
  isOpen,
  onClose,
  title = "Pratinjau Dokumen Resmi",
  documentNumber,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  title?: string
  documentNumber?: string
  children: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  function handlePrint() {
    window.print()
  }

  function handleCopyVerifyLink() {
    const url = `https://erp.globalsolusiprima.com/verify?doc=${encodeURIComponent(documentNumber || "")}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200 print:p-0 print:bg-transparent print:static">
      <div className="relative flex max-h-[96vh] w-full max-w-5xl flex-col rounded-2xl bg-slate-100 shadow-2xl border border-line overflow-hidden print:max-h-none print:w-auto print:rounded-none print:border-none print:bg-white print:shadow-none">
        {/* Modal Toolbar (Disembunyikan saat Cetak PDF) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-5 py-3.5 print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white p-1 shadow-xs">
              <Image
                src="/gsp-brand-logo.jpg"
                alt="PT. Global Solusi Prima"
                width={40}
                height={40}
                priority
                unoptimized
                className="h-full w-full object-contain select-none"
              />
            </span>
            <div>
              <h3 className="font-bold text-sm text-ink">{title}</h3>
              {documentNumber && (
                <p className="font-mono text-[11px] text-muted">No: {documentNumber}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {documentNumber && (
              <button
                type="button"
                onClick={handleCopyVerifyLink}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                title="Salin tautan verifikasi online"
              >
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <ShieldCheck className="size-3.5 text-slate-500" />}
                {copied ? "Tersalin!" : "Salin Link QR"}
              </button>
            )}

            <Button
              type="button"
              onClick={handlePrint}
              className="gap-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold shadow-md"
            >
              <Printer className="size-3.5" /> Cetak / Simpan PDF (A4)
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-ink transition-colors ml-1"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Container with A4 preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/70 print:p-0 print:bg-white print:overflow-visible">
          <div className="print:m-0 print:p-0">
            {children}
          </div>
        </div>

        {/* Modal Footer (Disembunyikan saat cetak) */}
        <div className="flex items-center justify-between border-t border-line bg-white px-5 py-2.5 text-[11px] text-muted print:hidden">
          <span>
            Tips: Gunakan opsi &quot;Save as PDF&quot; di dialog cetak browser Anda untuk menyimpan sebagai file PDF resolusi tinggi.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-semibold text-brand hover:underline"
          >
            Tutup Pratinjau
          </button>
        </div>
      </div>
    </div>
  )
}
