"use client"

import React from "react"
import { CompanyLetterhead } from "./company-letterhead"
import { DocumentQrCode } from "./qr-code"
import { SignatureStampBlock } from "./digital-stamp"
import { terbilang } from "./terbilang"
import { formatCurrency } from "@/lib/money"

export type PrintableInvoiceProps = {
  invoice: {
    id: string
    invoice_number: string
    invoice_date: string
    due_date?: string
    term_name: string
    percentage: number
    amount: number // DPP
    vat_amount: number // PPN 11%
    wht_amount: number // PPh 23 2%
    total_amount: number
    net_receivable: number
    notes?: string
    invoice_journal_number?: string
  }
  project: {
    code: string
    name: string
    client_name: string
    branch_name?: string
    client_address?: string
    client_npwp?: string
  }
  signerName?: string
  signerRole?: string
}

export function PrintableInvoiceDocument({
  invoice,
  project,
  signerName = "Dra. Hj. Siti Rahmawati, M.M., Ak.",
  signerRole = "Direktur Keuangan & Akuntansi",
}: PrintableInvoiceProps) {
  const invoiceDateFormatted = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(invoice.invoice_date || Date.now()))

  const dueDateFormatted = invoice.due_date
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(new Date(invoice.due_date))
    : "14 Hari Setelah Invoice Diterbitkan"

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 md:p-12 text-slate-900 text-xs shadow-lg print:max-w-none print:p-0 print:shadow-none print:text-black">
      {/* KOP SURAT RESMI */}
      <CompanyLetterhead branchName={project.branch_name} />

      {/* HEADER DOKUMEN INVOICE */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold uppercase tracking-wide text-slate-950">
            INVOICE PENAGIHAN
          </h2>
          <p className="font-mono text-sm font-bold text-brand mt-1">
            No: {invoice.invoice_number}
          </p>
          {invoice.invoice_journal_number && (
            <p className="font-mono text-[10px] text-slate-500 mt-0.5">
              Ref Jurnal ERP: {invoice.invoice_journal_number}
            </p>
          )}
        </div>

        <div className="text-right text-xs">
          <p className="text-slate-600">
            Tanggal Terbit: <strong className="text-slate-900">{invoiceDateFormatted}</strong>
          </p>
          <p className="text-amber-800 font-semibold mt-0.5">
            Jatuh Tempo: {dueDateFormatted}
          </p>
        </div>
      </div>

      {/* REKAP KLIEN & KONTRAK */}
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">TAGIHAN KEPADA:</p>
          <p className="font-bold text-sm text-slate-900 mt-1">{project.client_name}</p>
          {project.client_address && (
            <p className="text-slate-600 text-[11px] mt-0.5">{project.client_address}</p>
          )}
          {project.client_npwp && (
            <p className="text-slate-500 font-mono text-[10px] mt-1">NPWP: {project.client_npwp}</p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">REFERENSI PROYEK:</p>
          <p className="font-bold text-slate-900 mt-1">{project.name}</p>
          <p className="text-slate-600 font-mono text-[11px] mt-0.5">Kode Proyek: {project.code}</p>
          <p className="text-slate-500 text-[10px] mt-0.5">Unit Operasional: Cabang {project.branch_name || "Pusat"}</p>
        </div>
      </div>

      {/* TABEL RINCIAN TAGIHAN */}
      <div className="mb-6">
        <table className="w-full border-collapse border border-slate-300 text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-800">
              <th className="border border-slate-300 p-2.5 text-center w-12">No.</th>
              <th className="border border-slate-300 p-2.5 text-left">Deskripsi Termin Penagihan</th>
              <th className="border border-slate-300 p-2.5 text-center w-20">Bobot (%)</th>
              <th className="border border-slate-300 p-2.5 text-right w-36">Jumlah (Rp)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-300 p-3 text-center align-top">1</td>
              <td className="border border-slate-300 p-3">
                <p className="font-bold text-slate-900">{invoice.term_name}</p>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Pembayaran termin jasa konsultansi sesuai perjanjian kerja No. {project.code}.
                </p>
                {invoice.notes && (
                  <p className="text-slate-500 text-[10px] mt-1.5 italic bg-slate-50 p-1.5 rounded">
                    Catatan: {invoice.notes}
                  </p>
                )}
              </td>
              <td className="border border-slate-300 p-3 text-center font-bold align-top">
                {invoice.percentage}%
              </td>
              <td className="border border-slate-300 p-3 text-right font-bold align-top">
                {formatCurrency(invoice.amount)}
              </td>
            </tr>

            {/* SUB TOTAL & PAJAK */}
            <tr className="bg-slate-50">
              <td colSpan={3} className="border border-slate-300 p-2 text-right font-semibold text-slate-700">
                Dasar Pengenaan Pajak (DPP):
              </td>
              <td className="border border-slate-300 p-2 text-right font-bold text-slate-900">
                {formatCurrency(invoice.amount)}
              </td>
            </tr>
            <tr className="bg-slate-50">
              <td colSpan={3} className="border border-slate-300 p-2 text-right font-semibold text-slate-700">
                PPN Keluaran (11%):
              </td>
              <td className="border border-slate-300 p-2 text-right font-bold text-slate-900">
                {formatCurrency(invoice.vat_amount)}
              </td>
            </tr>
            <tr className="bg-slate-100 font-bold text-slate-900">
              <td colSpan={3} className="border border-slate-300 p-2 text-right">
                Total Tagihan Kotor:
              </td>
              <td className="border border-slate-300 p-2 text-right font-bold">
                {formatCurrency(invoice.total_amount)}
              </td>
            </tr>
            {invoice.wht_amount > 0 && (
              <tr className="bg-amber-50/50 text-amber-900">
                <td colSpan={3} className="border border-slate-300 p-2 text-right font-semibold">
                  Dipungut PPh Pasal 23 (2%):
                </td>
                <td className="border border-slate-300 p-2 text-right font-bold">
                  - {formatCurrency(invoice.wht_amount)}
                </td>
              </tr>
            )}
            <tr className="bg-slate-900 text-white font-extrabold text-sm">
              <td colSpan={3} className="border border-slate-900 p-3 text-right">
                JUMLAH BERSIH YANG HARUS DIBAYAR (NET):
              </td>
              <td className="border border-slate-900 p-3 text-right">
                {formatCurrency(invoice.net_receivable)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* TERBILANG RUPIAH */}
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-700 italic">
          <span className="font-semibold not-italic text-slate-900">Terbilang: </span>
          {terbilang(invoice.net_receivable)}
        </div>
      </div>

      {/* INSTRUKSI PEMBAYARAN REKENING BANK RESMI */}
      <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3.5 space-y-1.5 text-xs text-indigo-950">
        <p className="font-bold flex items-center gap-1.5 uppercase tracking-wide">
          Instruksi Transfer Pembayaran Resmi:
        </p>
        <p className="text-[11px] text-slate-700">
          Pembayaran mohon ditransfer hanya ke rekening resmi perusahaan atas nama <strong>PT. GLOBAL SOLUSI PRIMA</strong>:
        </p>
        <div className="grid gap-2 sm:grid-cols-2 pt-1 font-mono text-[11px]">
          <div className="bg-white p-2 rounded border border-indigo-100">
            <span className="block font-sans text-[10px] text-slate-500">Bank Mandiri KCP Sleman:</span>
            <strong className="text-slate-900 text-xs">137-00-1234567-8</strong>
          </div>
          <div className="bg-white p-2 rounded border border-indigo-100">
            <span className="block font-sans text-[10px] text-slate-500">Bank Central Asia (BCA) KCU Yogyakarta:</span>
            <strong className="text-slate-900 text-xs">037-1234567</strong>
          </div>
        </div>
      </div>

      {/* FOOTER: QR CODE & TANDA TANGAN KEUANGAN */}
      <div className="mt-8 pt-4 border-t border-slate-200 flex flex-wrap items-end justify-between gap-6">
        <DocumentQrCode
          value={`https://erp.globalsolusiprima.com/verify?invoice=${encodeURIComponent(invoice.invoice_number)}`}
          documentNumber={invoice.invoice_number}
        />

        <SignatureStampBlock
          signerName={signerName}
          signerRole={signerRole}
          dateCity="Sleman, D.I. Yogyakarta"
          dateFormatted={invoiceDateFormatted}
          documentNumber={invoice.invoice_number}
          stampText="FINANCE GSP"
        />
      </div>
    </div>
  )
}
