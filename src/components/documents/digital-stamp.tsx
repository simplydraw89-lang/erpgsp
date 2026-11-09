"use client"

import React from "react"
import { ShieldCheck } from "lucide-react"

export function DigitalCorporateStamp({
  text = "DIREKSI",
  dateStr,
  variant = "blue",
}: {
  text?: string
  dateStr?: string
  variant?: "blue" | "emerald" | "amber"
}) {
  const colorClass =
    variant === "emerald"
      ? "border-emerald-700 text-emerald-800"
      : variant === "amber"
      ? "border-amber-700 text-amber-800"
      : "border-indigo-800 text-indigo-900"

  const bgHue =
    variant === "emerald"
      ? "bg-emerald-50/70"
      : variant === "amber"
      ? "bg-amber-50/70"
      : "bg-indigo-50/70"

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center size-28 rounded-full border-2 border-dashed ${colorClass} ${bgHue} p-2 text-center select-none rotate-[-6deg] shadow-sm`}
      style={{
        boxShadow: "inset 0 0 0 2px currentColor",
      }}
    >
      {/* Outer Circle Label */}
      <div className="text-[7.5px] font-extrabold tracking-widest uppercase">
        ★ PT. GLOBAL SOLUSI PRIMA ★
      </div>

      {/* Middle Box */}
      <div className="my-0.5 border-y-2 border-current px-2 py-0.5 w-full text-center">
        <span className="block text-[11px] font-black tracking-wider uppercase">
          {text}
        </span>
        <span className="block text-[6.5px] font-mono tracking-tighter">
          DIGITALLY CERTIFIED
        </span>
      </div>

      {/* Date & Location */}
      <div className="text-[7px] font-bold tracking-tight">
        {dateStr ? dateStr.toUpperCase() : "INDONESIA"}
      </div>
    </div>
  )
}

export function SignatureStampBlock({
  signerName,
  signerRole = "Direktur Utama",
  dateCity = "Sleman, D.I. Yogyakarta",
  dateFormatted,
  documentNumber,
  stampText = "APPROVED",
  isReceipt = false,
  counterpartyName,
  counterpartyRole = "Pihak Kedua (Klien / Mitra)",
}: {
  signerName: string
  signerRole?: string
  dateCity?: string
  dateFormatted: string
  documentNumber: string
  stampText?: string
  isReceipt?: boolean
  counterpartyName?: string
  counterpartyRole?: string
}) {
  return (
    <div className="mt-8 pt-4 border-t border-slate-200">
      <div className="flex flex-wrap items-end justify-between gap-8 text-xs">
        {/* Kolom Pihak Kedua (jika SPK / Kontrak Dua Belah Pihak) */}
        {counterpartyName ? (
          <div className="w-56 text-center">
            <p className="text-slate-500 mb-1">{dateCity}, {dateFormatted}</p>
            <p className="font-semibold text-slate-800">{counterpartyRole}</p>
            <div className="h-24 flex items-center justify-center">
              <span className="text-[11px] text-slate-400 italic">
                (Tanda Tangan & Stempel Klien)
              </span>
            </div>
            <p className="font-bold text-slate-900 border-t border-slate-400 pt-1">
              {counterpartyName}
            </p>
            <p className="text-[11px] text-slate-500">Pimpinan / Pejabat Berwenang</p>
          </div>
        ) : (
          <div className="text-[11px] text-slate-400 max-w-xs">
            <p className="font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              Catatan Keabsahan Dokumen:
            </p>
            <p>
              Dokumen ini diterbitkan secara sah dan terekam di sistem Enterprise Resource Planning (ERP) PT. Global Solusi Prima dengan nomor registrasi unik: <strong className="font-mono text-slate-700">{documentNumber}</strong>.
            </p>
          </div>
        )}

        {/* Kolom Pihak Pertama (PT. Global Solusi Prima) */}
        <div className="w-64 text-center ml-auto">
          <p className="text-slate-500 mb-1">{dateCity}, {dateFormatted}</p>
          <p className="font-semibold text-slate-800">
            {isReceipt ? "Penerima Pembayaran" : "PT. GLOBAL SOLUSI PRIMA"}
          </p>

          {/* Area Tanda Tangan & Stempel Digital Resmi */}
          <div className="relative h-24 flex items-center justify-center">
            {/* Stempel Digital Melayang */}
            <div className="absolute -left-2 z-10 pointer-events-none opacity-90">
              <DigitalCorporateStamp
                text={stampText}
                dateStr={dateFormatted}
                variant={isReceipt ? "emerald" : "blue"}
              />
            </div>

            {/* Tanda Tangan Digital Resmi */}
            <div className="z-0 text-center">
              <span className="font-serif italic text-base text-slate-700 font-bold block tracking-wider">
                {signerName}
              </span>
              <span className="block text-[8px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5">
                ✓ Verified Digital Signature
              </span>
            </div>
          </div>

          <p className="font-bold text-slate-900 border-t border-slate-400 pt-1">
            {signerName}
          </p>
          <p className="text-[11px] text-slate-600 font-medium">
            {signerRole}
          </p>
        </div>
      </div>
    </div>
  )
}
