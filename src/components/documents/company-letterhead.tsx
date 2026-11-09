"use client"

import React from "react"

export function CompanyLetterhead({
  branchName,
}: {
  branchName?: string
}) {
  return (
    <header className="border-b-2 border-slate-900 pb-3 mb-6">
      <div className="flex items-center justify-between gap-4">
        {/* Logo & Emblem */}
        <div className="flex items-center gap-3.5 shrink-0">
          <div className="flex size-16 items-center justify-center rounded-xl bg-slate-900 text-white font-extrabold text-2xl tracking-tighter shadow-sm border border-slate-700">
            GSP
          </div>
        </div>

        {/* Info Korporat Resmi */}
        <div className="flex-1 text-center">
          <h1 className="text-xl font-extrabold tracking-wider text-slate-900 uppercase">
            PT. GLOBAL SOLUSI PRIMA
          </h1>
          <p className="text-[11px] font-semibold tracking-wide text-brand uppercase mt-0.5">
            Konsultan Lingkungan Hidup, AMDAL, UKL-UPL, Studi Kelayakan & Engineering
          </p>
          <p className="text-[10px] text-slate-600 mt-1 leading-tight">
            Kantor Pusat: Jl. Ring Road Utara No. 88, Sleman, D.I. Yogyakarta 55284 • Telp: (0274) 889900
          </p>
          <p className="text-[9.5px] text-slate-500 mt-0.5 leading-tight">
            Email: <span className="text-slate-700 font-medium">corporate@globalsolusiprima.com</span> • Website: <span className="text-slate-700 font-medium">www.globalsolusiprima.com</span> • NPWP: <span className="text-slate-700 font-medium">94.123.456.7-542.000</span>
          </p>
          {branchName && branchName !== "Pusat" && (
            <p className="text-[9.5px] font-semibold text-slate-700 mt-0.5">
              Unit Operasional: Kantor Cabang {branchName}
            </p>
          )}
        </div>

        {/* ISO / Akreditasi Badge */}
        <div className="hidden sm:flex flex-col items-center justify-center border border-slate-300 rounded-lg p-2 text-center text-[8.5px] leading-tight text-slate-600 shrink-0 bg-slate-50">
          <span className="font-extrabold text-slate-900">TERLISENSI & TERAKREDITASI</span>
          <span className="text-[8px] text-slate-500 mt-0.5">KLHK & LPSE REPUBLIK INDONESIA</span>
          <span className="font-mono text-[7.5px] text-brand mt-0.5 font-bold">ISO 9001:2015 / 14001</span>
        </div>
      </div>

      {/* Garis Ganda Kop Surat Resmi (Double Line khas Dokumen Indonesia) */}
      <div className="mt-3.5 space-y-[2px]">
        <div className="h-[2.5px] bg-slate-900 w-full" />
        <div className="h-[0.75px] bg-slate-500 w-full" />
      </div>
    </header>
  )
}
