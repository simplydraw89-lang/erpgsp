"use client"

import React from "react"
import { CompanyLetterhead } from "./company-letterhead"
import { DocumentQrCode } from "./qr-code"
import { SignatureStampBlock } from "./digital-stamp"
import { terbilang } from "./terbilang"
import { formatCurrency } from "@/lib/money"

export type PrintableReceiptProps = {
  receipt: {
    receipt_number: string
    invoice_number: string
    paid_at?: string
    paid_amount: number
    payment_method?: string
    bank_name?: string
    bank_reference?: string
    term_name?: string
    notes?: string
    payment_journal_number?: string
  }
  project: {
    code: string
    name: string
    client_name: string
    branch_name?: string
  }
  signerName?: string
  signerRole?: string
}

export function PrintableReceiptDocument({
  receipt,
  project,
  signerName = "Rina Kusuma Dewi, S.E.",
  signerRole = "Kasir & Perbendaharaan Finance",
}: PrintableReceiptProps) {
  const paidDateFormatted = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(receipt.paid_at || Date.now()))

  const receiptNumber = receipt.receipt_number || `KWT-${receipt.invoice_number.replace("INV/", "")}`
  const paidAmount = Number(receipt.paid_amount || 0)

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 md:p-12 text-slate-900 text-xs shadow-lg print:max-w-none print:p-0 print:shadow-none print:text-black">
      {/* KOP SURAT RESMI */}
      <CompanyLetterhead branchName={project.branch_name} />

      {/* HEADER KUITANSI */}
      <div className="flex flex-wrap items-center justify-between border-b-2 border-slate-900 pb-3 mb-6">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wider text-slate-950">
            KUITANSI PEMBAYARAN
          </h2>
          <p className="font-mono text-xs font-bold text-emerald-700 mt-0.5">
            NO: {receiptNumber}
          </p>
        </div>

        <div className="text-right">
          <span className="inline-block rounded bg-emerald-100 border border-emerald-300 px-3 py-1 font-bold text-emerald-800 text-xs tracking-wider uppercase">
            ✓ LUNAS / OFFICIAL RECEIPT
          </span>
          {receipt.payment_journal_number && (
            <p className="font-mono text-[9.5px] text-slate-500 mt-1">
              Ref Kas/Bank: {receipt.payment_journal_number}
            </p>
          )}
        </div>
      </div>

      {/* BODY KUITANSI RESMI FORMAT INDONESIA */}
      <div className="space-y-4 mb-6 text-sm">
        <div className="grid grid-cols-[160px_16px_1fr] items-baseline border-b border-dashed border-slate-200 pb-3">
          <span className="font-bold text-slate-700 text-xs uppercase">Telah Diterima Dari</span>
          <span className="font-bold">:</span>
          <span className="font-bold text-slate-950 text-base">{project.client_name}</span>
        </div>

        <div className="grid grid-cols-[160px_16px_1fr] items-baseline border-b border-dashed border-slate-200 pb-3">
          <span className="font-bold text-slate-700 text-xs uppercase">Uang Sejumlah</span>
          <span className="font-bold">:</span>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 font-bold italic text-slate-900 leading-relaxed text-xs">
            &ldquo;{terbilang(paidAmount)}&rdquo;
          </div>
        </div>

        <div className="grid grid-cols-[160px_16px_1fr] items-start border-b border-dashed border-slate-200 pb-3">
          <span className="font-bold text-slate-700 text-xs uppercase">Untuk Pembayaran</span>
          <span className="font-bold">:</span>
          <div className="space-y-1 text-xs">
            <p className="font-bold text-slate-900">
              Pelunasan {receipt.term_name || "Termin Penagihan"} atas Invoice No. <strong className="font-mono text-brand">{receipt.invoice_number}</strong>
            </p>
            <p className="text-slate-600">
              Pekerjaan: {project.name} (Kode SPK: {project.code})
            </p>
            {receipt.notes && (
              <p className="text-slate-500 text-[11px] italic mt-1">
                Keterangan tambahan: {receipt.notes}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[160px_16px_1fr] items-center border-b border-dashed border-slate-200 pb-3 text-xs">
          <span className="font-bold text-slate-700 uppercase">Metode Pembayaran</span>
          <span className="font-bold">:</span>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-900">
              {receipt.bank_name || receipt.payment_method || "Transfer Bank"}
            </span>
            {receipt.bank_reference && (
              <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                Ref: {receipt.bank_reference}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* KOTAK JUMLAH NOMINAL (RP) */}
      <div className="my-6 flex items-center justify-between rounded-xl border-2 border-slate-900 bg-slate-50 p-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            JUMLAH PEMBAYARAN SAH:
          </span>
          <span className="text-2xl font-black text-slate-950 tracking-tight">
            {formatCurrency(paidAmount)}
          </span>
        </div>

        <div className="text-right">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-3 py-1.5 rounded-lg shadow-sm">
            ✓ Pembayaran Sah & Diterima di Rekening Resmi PT. GSP
          </span>
        </div>
      </div>

      {/* FOOTER: QR CODE & TANDA TANGAN / STEMPEL LUNAS */}
      <div className="mt-8 pt-4 border-t border-slate-200 flex flex-wrap items-end justify-between gap-6">
        <DocumentQrCode
          value={`https://erp.globalsolusiprima.com/verify?receipt=${encodeURIComponent(receiptNumber)}`}
          documentNumber={receiptNumber}
        />

        <SignatureStampBlock
          signerName={signerName}
          signerRole={signerRole}
          dateCity="Sleman, D.I. Yogyakarta"
          dateFormatted={paidDateFormatted}
          documentNumber={receiptNumber}
          stampText="LUNAS / GSP"
          isReceipt
        />
      </div>
    </div>
  )
}
