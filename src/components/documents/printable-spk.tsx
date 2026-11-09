"use client"

import React from "react"
import { CompanyLetterhead } from "./company-letterhead"
import { DocumentQrCode } from "./qr-code"
import { SignatureStampBlock } from "./digital-stamp"
import { terbilang } from "./terbilang"
import { formatCurrency } from "@/lib/money"

export type PrintableSpkProps = {
  document: {
    id: string
    document_number?: string | null
    sph_number?: number | string | null
    title: string
    amount?: number | string | null
    created_at: string
    valid_until?: string | null
    work_area?: string | null
    work_scopes?: string[] | null
    notes?: string | null
    client_snapshot?: any
    branch_name?: string
  }
  signerName?: string
  signerRole?: string
}

export function PrintableSpkDocument({
  document,
  signerName = "Ir. H. Bambang Sudaryanto, M.T.",
  signerRole = "Direktur Utama",
}: PrintableSpkProps) {
  const docNumber = document.document_number || `SPK-${document.id.slice(0, 8).toUpperCase()}`
  const dateFormatted = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(document.created_at || Date.now()))

  const amount = Number(document.amount || 0)
  const vatAmount = Math.round(amount * 0.11)
  const totalAmount = amount + vatAmount

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 md:p-12 text-slate-900 text-xs shadow-lg print:max-w-none print:p-0 print:shadow-none print:text-black">
      {/* KOP SURAT RESMI PT. GLOBAL SOLUSI PRIMA */}
      <CompanyLetterhead branchName={document.branch_name} />

      {/* HEADER DOKUMEN SPK */}
      <div className="text-center mb-6">
        <h2 className="text-base font-extrabold uppercase tracking-wide text-slate-950 underline">
          SURAT PERINTAH KERJA (SPK)
        </h2>
        <p className="font-mono font-bold text-xs text-brand mt-1">
          Nomor: {docNumber}
        </p>
        {document.sph_number && (
          <p className="text-[11px] text-slate-500 mt-0.5">
            Berdasarkan Surat Penawaran Harga (SPH) No: SPH/{document.sph_number}
          </p>
        )}
      </div>

      {/* PEMBUKA PERJANJIAN */}
      <div className="space-y-3 leading-relaxed mb-5">
        <p>
          Pada hari ini, tanggal <strong>{dateFormatted}</strong>, bertempat di Sleman, Daerah Istimewa Yogyakarta, yang bertanda tangan di bawah ini telah bersepakat mengadakan Perjanjian Perintah Kerja:
        </p>

        {/* IDENTITAS PARA PIHAK */}
        <div className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
          <div className="grid grid-cols-[100px_12px_1fr] gap-1">
            <span className="font-bold text-slate-800">PIHAK PERTAMA</span>
            <span>:</span>
            <div>
              <p className="font-bold text-slate-900">{document.client_snapshot?.name || "Mitra Klien"}</p>
              <p className="text-slate-600 text-[11px]">
                {document.client_snapshot?.address || "Alamat Klien"} &bull; U.p: {document.client_snapshot?.contact || "Pimpinan"}
              </p>
              <p className="text-[10px] text-slate-500 italic">Sebagai PEMBERI TUGAS / KLIEN</p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-2 grid grid-cols-[100px_12px_1fr] gap-1">
            <span className="font-bold text-slate-800">PIHAK KEDUA</span>
            <span>:</span>
            <div>
              <p className="font-bold text-slate-900">PT. GLOBAL SOLUSI PRIMA</p>
              <p className="text-slate-600 text-[11px]">
                Gedung GSP Tower, Jl. Ring Road Utara No. 88, Sleman, D.I. Yogyakarta 55284
              </p>
              <p className="text-[10px] text-slate-500 italic">Sebagai PELAKSANA PEKERJAAN / KONSULTAN</p>
            </div>
          </div>
        </div>

        <p>
          Kedua belah pihak sepakat mengikatkan diri dalam Surat Perintah Kerja ini dengan ketentuan sebagai berikut:
        </p>
      </div>

      {/* PASAL-PASAL PERJANJIAN */}
      <div className="space-y-4 mb-6 leading-relaxed">
        {/* PASAL 1 */}
        <div>
          <h3 className="font-bold text-xs uppercase text-slate-900 border-b border-slate-200 pb-1 mb-1.5">
            PASAL 1: LINGKUP PEKERJAAN & DELIVERABLES
          </h3>
          <p>
            PIHAK PERTAMA memberikan perintah kerja kepada PIHAK KEDUA, dan PIHAK KEDUA menerima penugasan untuk melaksanakan pekerjaan:
          </p>
          <div className="mt-1.5 rounded bg-slate-100 p-2.5 font-bold text-slate-900 border-l-4 border-slate-900">
            {document.title}
          </div>
          <p className="mt-1 text-[11px] text-slate-600">
            Wilayah Pelaksanaan: <strong>{document.work_area || "Sesuai Kerangka Acuan Kerja"}</strong> &bull; Lingkup Teknis: <strong>{(document.work_scopes || ["Kajian Teknis & Lingkungan"]).join(", ")}</strong>.
          </p>
        </div>

        {/* PASAL 2 */}
        <div>
          <h3 className="font-bold text-xs uppercase text-slate-900 border-b border-slate-200 pb-1 mb-1.5">
            PASAL 2: NILAI KONTRAK & KETENTUAN PERPAJAKAN
          </h3>
          <table className="w-full border-collapse border border-slate-300 text-xs mt-1.5">
            <tbody>
              <tr>
                <td className="border border-slate-300 p-2 text-slate-700">Nilai Jasa Konsultansi (DPP)</td>
                <td className="border border-slate-300 p-2 text-right font-bold w-48">{formatCurrency(amount)}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 p-2 text-slate-700">Pajak Pertambahan Nilai (PPN 11%)</td>
                <td className="border border-slate-300 p-2 text-right font-bold">{formatCurrency(vatAmount)}</td>
              </tr>
              <tr className="bg-slate-100 font-extrabold text-sm">
                <td className="border border-slate-300 p-2.5 text-slate-950">TOTAL NILAI KONTRAK SPK</td>
                <td className="border border-slate-300 p-2.5 text-right text-brand">{formatCurrency(totalAmount)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-1.5 rounded border border-slate-200 bg-slate-50 p-2 text-[11px] italic text-slate-700">
            <span className="font-semibold not-italic text-slate-900">Terbilang: </span>
            {terbilang(totalAmount)}
          </div>
        </div>

        {/* PASAL 3 */}
        <div>
          <h3 className="font-bold text-xs uppercase text-slate-900 border-b border-slate-200 pb-1 mb-1.5">
            PASAL 3: KETENTUAN PENAGIHAN & METODE PEMBAYARAN
          </h3>
          <p className="text-[11px] text-slate-600">
            1. Penagihan dilakukan berdasarkan penerbitan Invoice Resmi dan Faktur Pajak dari PT. Global Solusi Prima sesuai termin pencapaian milestone/deliverables.
          </p>
          <p className="text-[11px] text-slate-600 mt-1">
            2. Pembayaran ditransfer ke rekening resmi: <strong>Bank Mandiri KCP Yogyakarta No. Rekening: 137-00-1234567-8 a.n. PT. Global Solusi Prima</strong>.
          </p>
        </div>
      </div>

      {/* FOOTER: QR CODE & TANDA TANGAN DUA BELAH PIHAK */}
      <div className="mt-8 pt-4 border-t border-slate-200 flex flex-wrap items-end justify-between gap-6">
        <DocumentQrCode
          value={`https://erp.globalsolusiprima.com/verify?doc=${encodeURIComponent(docNumber)}`}
          documentNumber={docNumber}
        />

        <SignatureStampBlock
          signerName={signerName}
          signerRole={signerRole}
          counterpartyName={document.client_snapshot?.contact || document.client_snapshot?.name || "Pimpinan Mitra Klien"}
          counterpartyRole="PIHAK PERTAMA (PEMBERI TUGAS)"
          dateCity="Sleman, D.I. Yogyakarta"
          dateFormatted={dateFormatted}
          documentNumber={docNumber}
          stampText="DIREKSI GSP"
        />
      </div>
    </div>
  )
}
