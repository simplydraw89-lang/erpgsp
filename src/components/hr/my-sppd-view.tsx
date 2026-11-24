"use client"

import React, { useState } from "react"
import { Compass, Calendar, MapPin, Download, CheckCircle2, AlertCircle, FileText, Printer } from "lucide-react"

export interface MySppdItem {
  id: string
  sppd_number: string
  destination_city: string
  departure_date: string
  return_date: string
  purpose: string
  daily_allowance: number
  status: "active" | "completed" | "cancelled"
  field_report_notes: string | null
  created_at: string
}

interface MySppdViewProps {
  sppdList: MySppdItem[]
  userName: string
}

export function MySppdView({ sppdList, userName }: MySppdViewProps) {
  const [selectedSppd, setSelectedSppd] = useState<MySppdItem | null>(null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-ink">Surat Perintah Perjalanan Dinas (SPPD) - {userName}</h2>
          <p className="text-xs text-muted">
            Daftar surat tugas resmi penugasan luar kota / site proyek beserta rincian akomodasi dan uang saku per diem.
          </p>
        </div>
      </div>

      {/* Grid SPPD Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {sppdList.length === 0 ? (
          <div className="col-span-2 rounded-xl border border-line bg-white p-8 text-center text-muted dark:bg-slate-900">
            <Compass size={32} className="mx-auto text-muted/50 mb-2" />
            <p className="font-semibold text-ink text-sm">Tidak Ada Surat Tugas Aktif</p>
            <p className="text-xs mt-1">Saat ini Anda tidak memiliki agenda perjalanan dinas atau penugasan luar kota.</p>
          </div>
        ) : (
          sppdList.map((sppd) => (
            <div
              key={sppd.id}
              className="rounded-xl border border-line bg-white p-5 shadow-sm space-y-3 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-brand">{sppd.sppd_number}</span>
                  <div className="flex items-center gap-1.5 text-ink font-semibold text-sm mt-0.5">
                    <MapPin size={14} className="text-rose-500" />
                    <span>{sppd.destination_city}</span>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    sppd.status === "active"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : sppd.status === "completed"
                      ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                  }`}
                >
                  {sppd.status === "active" ? "Tugas Aktif" : sppd.status === "completed" ? "Selesai" : "Dibatalkan"}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50 p-2.5 text-xs space-y-1.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-muted" />
                  <span>
                    <strong>Jadwal:</strong> {sppd.departure_date} s/d {sppd.return_date}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText size={13} className="text-muted" />
                  <span>
                    <strong>Tujuan:</strong> {sppd.purpose}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-line pt-2.5 text-xs">
                <div>
                  <span className="text-muted text-[11px]">Uang Saku (Per Diem):</span>
                  <p className="font-mono font-bold text-ink">
                    Rp {sppd.daily_allowance.toLocaleString("id-ID")} / hari
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSppd(sppd)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 font-semibold text-ink hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <Printer size={13} />
                  <span>Format Cetak</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Preview / Cetak Surat Tugas Resmi */}
      {selectedSppd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-line bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <FileText className="text-brand" size={18} />
                <h3 className="font-bold text-ink text-sm">Surat Perintah Perjalanan Dinas Resmi</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSppd(null)}
                className="text-muted hover:text-ink text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {/* Dokumen SPPD Print Preview */}
            <div className="rounded-xl border border-line bg-slate-50/50 p-5 text-xs text-ink space-y-4 dark:bg-slate-800/40">
              <div className="text-center border-b border-slate-300 pb-3 dark:border-slate-700">
                <h4 className="font-black text-sm uppercase tracking-wide">PT GLOBAL SOLUSI PRIMA</h4>
                <p className="text-[11px] text-muted">Engineering, Geotechnical & Management Consulting</p>
                <p className="font-bold text-xs mt-2 underline">SURAT PERINTAH PERJALANAN DINAS (SPPD)</p>
                <p className="font-mono text-[11px] text-brand">Nomor: {selectedSppd.sppd_number}</p>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-3">
                  <span className="text-muted">Nama Pejabat/Staf</span>
                  <span className="col-span-2 font-bold">: {userName}</span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="text-muted">Maksud Perjalanan</span>
                  <span className="col-span-2">: {selectedSppd.purpose}</span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="text-muted">Tempat Tujuan</span>
                  <span className="col-span-2 font-semibold">: {selectedSppd.destination_city}</span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="text-muted">Lama Perjalanan</span>
                  <span className="col-span-2">
                    : Dari {selectedSppd.departure_date} s/d {selectedSppd.return_date}
                  </span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="text-muted">Hak Uang Saku Harian</span>
                  <span className="col-span-2 font-mono font-bold">
                    : Rp {selectedSppd.daily_allowance.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-300 pt-3 dark:border-slate-700 text-right">
                <p className="text-[11px] text-muted">Ditetapkan oleh Direksi / HR Operasional</p>
                <p className="font-bold text-xs mt-8">PT Global Solusi Prima</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setSelectedSppd(null)}
                className="rounded-xl border border-line px-4 py-2 font-medium text-muted hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2 font-semibold text-white shadow-sm hover:opacity-90 transition text-xs"
              >
                <Printer size={14} />
                <span>Cetak / Simpan PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
