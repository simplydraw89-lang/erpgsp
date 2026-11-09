"use client"

import React from "react"
import { CompanyLetterhead } from "./company-letterhead"
import { DocumentQrCode } from "./qr-code"
import { SignatureStampBlock } from "./digital-stamp"
import { terbilang } from "./terbilang"
import { formatCurrency } from "@/lib/money"

export type PrintableSphProps = {
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
    deal_status?: string | null
    client_snapshot?: any
    branch_name?: string
  }
  signerName?: string
  signerRole?: string
}

export function PrintableSphDocument({
  document,
  signerName = "Ir. H. Bambang Sudaryanto, M.T.",
  signerRole = "Direktur Utama",
}: PrintableSphProps) {
  const docNumber = document.document_number || (document.sph_number ? `SPH/${document.sph_number}` : `SPH-${document.id.slice(0, 8).toUpperCase()}`)
  const dateFormatted = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(document.created_at || Date.now()))

  const validUntilFormatted = document.valid_until
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(new Date(document.valid_until))
    : "30 (Tiga Puluh) Hari Kalender"

  const amount = Number(document.amount || 0)
  const vatAmount = Math.round(amount * 0.11)
  const totalAmount = amount + vatAmount

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 md:p-12 text-slate-900 text-xs shadow-lg print:max-w-none print:p-0 print:shadow-none print:text-black">
      {/* KOP SURAT RESMI PT. GLOBAL SOLUSI PRIMA */}
      <CompanyLetterhead branchName={document.branch_name} />

      {/* METADATA SURAT */}
      <div className="flex flex-wrap justify-between gap-4 mb-6">
        <table className="text-xs">
          <tbody>
            <tr>
              <td className="w-24 font-semibold text-slate-700 py-0.5">Nomor</td>
              <td className="w-4 py-0.5">:</td>
              <td className="font-mono font-bold text-slate-900 py-0.5">{docNumber}</td>
            </tr>
            <tr>
              <td className="font-semibold text-slate-700 py-0.5">Lampiran</td>
              <td className="py-0.5">:</td>
              <td className="py-0.5">1 (Satu) Berkas Rincian RAB & Teknis</td>
            </tr>
            <tr>
              <td className="font-semibold text-slate-700 py-0.5">Perihal</td>
              <td className="py-0.5">:</td>
              <td className="font-bold text-slate-900 py-0.5">Surat Penawaran Harga (SPH)</td>
            </tr>
          </tbody>
        </table>

        <div className="text-right text-xs">
          <p className="text-slate-600">Sleman, {dateFormatted}</p>
        </div>
      </div>

      {/* TUJUAN SURAT (KLIEN / MITRA) */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
        <p className="font-semibold text-slate-700">Kepada Yth.</p>
        <p className="font-bold text-sm text-slate-900 mt-0.5">
          Pimpinan {document.client_snapshot?.name || "Mitra Bisnis / Klien"}
        </p>
        {document.client_snapshot?.contact && (
          <p className="text-slate-600 mt-0.5">U.p.: {document.client_snapshot.contact}</p>
        )}
        {document.client_snapshot?.address && (
          <p className="text-slate-600 mt-0.5 max-w-md">{document.client_snapshot.address}</p>
        )}
        {document.client_snapshot?.email && (
          <p className="text-slate-500 text-[11px] mt-0.5">{document.client_snapshot.email}</p>
        )}
      </div>

      {/* SALAM PEMBUKA & NARASI */}
      <div className="space-y-3 leading-relaxed mb-6">
        <p>Dengan hormat,</p>
        <p>
          Sehubungan dengan kebutuhan pelaksanaan pekerjaan konsultan lingkungan dan rekayasa teknis, kami dari <strong>PT. Global Solusi Prima</strong> dengan ini mengajukan Surat Penawaran Harga untuk pelaksanaan pekerjaan:
        </p>
        <div className="rounded-lg bg-slate-100 p-3 font-semibold text-slate-900 border-l-4 border-slate-900">
          {document.title}
        </div>
        <p>
          Lingkup pelaksanaan pekerjaan ini mencakup <strong>{(document.work_scopes || ["Kajian Lingkungan & Studi Kelayakan"]).join(", ")}</strong> yang berlokasi di wilayah <strong>{document.work_area || "Sesuai Penugasan Klien"}</strong>.
        </p>
      </div>

      {/* TABEL RINCIAN NILAI PENAWARAN */}
      <div className="mb-6">
        <table className="w-full border-collapse border border-slate-300 text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-800">
              <th className="border border-slate-300 p-2.5 text-center w-12">No.</th>
              <th className="border border-slate-300 p-2.5 text-left">Deskripsi Layanan / Pekerjaan</th>
              <th className="border border-slate-300 p-2.5 text-right w-36">Jumlah (Rp)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-300 p-3 text-center align-top">1</td>
              <td className="border border-slate-300 p-3">
                <p className="font-bold text-slate-900">{document.title}</p>
                <p className="text-slate-600 mt-1">
                  Pelaksanaan jasa konsultansi profesional, tenaga ahli bersertifikat, analisa laboratorium, dan penyusunan laporan akhir terpadu.
                </p>
                {document.notes && (
                  <p className="text-slate-500 text-[11px] mt-2 italic bg-slate-50 p-2 rounded">
                    Catatan teknis: {document.notes}
                  </p>
                )}
              </td>
              <td className="border border-slate-300 p-3 text-right font-bold align-top">
                {formatCurrency(amount)}
              </td>
            </tr>
            <tr className="bg-slate-50">
              <td colSpan={2} className="border border-slate-300 p-2 text-right font-semibold text-slate-700">
                Dasar Pengenaan Pajak (DPP):
              </td>
              <td className="border border-slate-300 p-2 text-right font-bold text-slate-900">
                {formatCurrency(amount)}
              </td>
            </tr>
            <tr className="bg-slate-50">
              <td colSpan={2} className="border border-slate-300 p-2 text-right font-semibold text-slate-700">
                Pajak Pertambahan Nilai (PPN 11%):
              </td>
              <td className="border border-slate-300 p-2 text-right font-bold text-slate-900">
                {formatCurrency(vatAmount)}
              </td>
            </tr>
            <tr className="bg-slate-100 font-extrabold text-slate-950 text-sm">
              <td colSpan={2} className="border border-slate-300 p-3 text-right">
                TOTAL NILAI PENAWARAN (TERMASUK PPN):
              </td>
              <td className="border border-slate-300 p-3 text-right text-brand">
                {formatCurrency(totalAmount)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* TERBILANG RUPIAH */}
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-700 italic">
          <span className="font-semibold not-italic text-slate-900">Terbilang: </span>
          {terbilang(totalAmount)}
        </div>
      </div>

      {/* SYARAT & KETENTUAN PENAWARAN */}
      <div className="mb-6 space-y-1.5 text-[11px] text-slate-600 leading-relaxed border-l-2 border-slate-300 pl-3">
        <p className="font-bold text-slate-800 text-xs">Syarat & Ketentuan Penawaran:</p>
        <p>1. Masa berlaku penawaran harga ini sampai dengan: <strong>{validUntilFormatted}</strong>.</p>
        <p>2. Pembayaran ditransfer ke rekening resmi <strong>PT. Global Solusi Prima</strong> (Bank Mandiri No. Rek: 137-00-1234567-8 atau BCA No. Rek: 037-1234567).</p>
        <p>3. Kesepakatan atas penawaran ini dituangkan lebih lanjut dalam Surat Perintah Kerja (SPK) / Kontrak Perjanjian Kerjasama resmi.</p>
      </div>

      {/* FOOTER: QR CODE VERIFIKASI & TANDA TANGAN / STEMPEL RESMI */}
      <div className="mt-8 pt-4 border-t border-slate-200 flex flex-wrap items-end justify-between gap-6">
        <DocumentQrCode
          value={`https://erp.globalsolusiprima.com/verify?doc=${encodeURIComponent(docNumber)}`}
          documentNumber={docNumber}
        />

        <SignatureStampBlock
          signerName={signerName}
          signerRole={signerRole}
          dateCity="Sleman, D.I. Yogyakarta"
          dateFormatted={dateFormatted}
          documentNumber={docNumber}
          stampText="DIREKSI GSP"
        />
      </div>
    </div>
  )
}
