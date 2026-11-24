"use client"

import React, { useState } from "react"
import { ShieldAlert, PlusCircle, AlertCircle, FileText, Printer, CheckCircle2 } from "lucide-react"
import { createDisciplinaryAction } from "@/app/(workspace)/modul/hr-actions"

export interface DisciplinaryActionItem {
  id: string
  employee_id: string
  employee_name: string
  sp_number: string
  level: "coaching" | "sp1" | "sp2" | "sp3"
  incident_date: string
  issue_description: string
  effective_until: string
  notes: string | null
  created_at: string
}

interface ManagementDisciplineSpViewProps {
  records: DisciplinaryActionItem[]
  employees: Array<{ id: string; full_name: string; employee_number: string }>
}

export function ManagementDisciplineSpView({ records, employees }: ManagementDisciplineSpViewProps) {
  const [showModal, setShowModal] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<DisciplinaryActionItem | null>(null)

  function getLevelBadge(level: string) {
    switch (level) {
      case "sp3":
        return (
          <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-black text-white uppercase">
            SP 3 (Peringatan Terakhir)
          </span>
        )
      case "sp2":
        return (
          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
            SP 2
          </span>
        )
      case "sp1":
        return (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            SP 1
          </span>
        )
      default:
        return (
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            Surat Teguran / Pembinaan
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="text-rose-600" size={18} />
            <h2 className="text-base font-bold text-ink">Manajemen Disiplin & Surat Peringatan (SP)</h2>
          </div>
          <p className="text-xs text-muted">
            Arsip rahasia (confidential) tindakan pembinaan, teguran tertulis, dan Surat Peringatan (SP1/SP2/SP3).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition"
        >
          <PlusCircle size={15} />
          <span>Terbitkan SP Baru</span>
        </button>
      </div>

      {/* Warning Notice */}
      <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-xs text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200 flex items-center gap-2.5">
        <AlertCircle size={16} className="text-rose-600 shrink-0" />
        <span>
          <strong>Kerahasiaan Tinggi:</strong> Data Surat Peringatan ini hanya dapat diakses oleh Direktur dan HR Manager. Rekan kerja atau karyawan lain tidak memiliki izin melihat data ini.
        </span>
      </div>

      {/* Tabel Tindakan Disiplin */}
      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-muted dark:bg-slate-800">
            <tr>
              <th scope="col" className="p-3 font-semibold">Nomor SP</th>
              <th scope="col" className="p-3 font-semibold">Nama Karyawan</th>
              <th scope="col" className="p-3 font-semibold">Tingkat SP</th>
              <th scope="col" className="p-3 font-semibold">Tgl Pelanggaran</th>
              <th scope="col" className="p-3 font-semibold">Klausul Pelanggaran</th>
              <th scope="col" className="p-3 font-semibold">Masa Berlaku</th>
              <th scope="col" className="p-3 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {records.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">
                  Belum ada catatan Surat Peringatan atau tindakan disiplin yang diterbitkan.
                </td>
              </tr>
            ) : (
              records.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-mono font-bold text-rose-600">{rec.sp_number}</td>
                  <td className="p-3 font-bold text-ink whitespace-nowrap">{rec.employee_name}</td>
                  <td className="p-3">{getLevelBadge(rec.level)}</td>
                  <td className="p-3 text-muted whitespace-nowrap">{rec.incident_date}</td>
                  <td className="p-3 text-muted max-w-xs">{rec.issue_description}</td>
                  <td className="p-3 whitespace-nowrap font-medium text-amber-700 dark:text-amber-400">
                    s/d {rec.effective_until}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedRecord(rec)}
                      className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <Printer size={12} />
                      <span>Cetak SP</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Terbitkan SP Baru */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-rose-600" size={18} />
                <h3 className="font-bold text-ink text-sm">Penerbitan Surat Peringatan (SP) Resmi</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-muted hover:text-ink text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form action={createDisciplinaryAction} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-ink mb-1">Pilih Karyawan Yang Diberi Sanksi *</label>
                <select
                  name="employee_id"
                  required
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Tingkat Surat Peringatan *</label>
                  <select
                    name="level"
                    required
                    className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                  >
                    <option value="coaching">Surat Teguran / Pembinaan</option>
                    <option value="sp1">Surat Peringatan 1 (SP 1)</option>
                    <option value="sp2">Surat Peringatan 2 (SP 2)</option>
                    <option value="sp3">Surat Peringatan 3 (SP 3 - Terakhir)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Nomor Surat SP *</label>
                  <input
                    type="text"
                    name="sp_number"
                    required
                    defaultValue={`SP/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`}
                    className="w-full rounded-xl border border-line bg-surface p-2.5 font-mono text-ink outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Tanggal Kejadian / Pelanggaran *</label>
                  <input
                    type="date"
                    name="incident_date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Masa Berlaku Sanksi s/d *</label>
                  <input
                    type="date"
                    name="effective_until"
                    required
                    defaultValue={(() => {
                      const d = new Date()
                      d.setMonth(d.getMonth() + 6)
                      return d.toISOString().slice(0, 10)
                    })()}
                    className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Klausul Pelanggaran / Alasan SP *</label>
                <textarea
                  name="issue_description"
                  required
                  rows={2}
                  placeholder="Contoh: Ketidakhadiran tanpa keterangan sah selama 3 hari kerja berturut-turut..."
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Catatan Pembinaan / Komitmen Karyawan</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Karyawan telah menandatangani komitmen perbaikan disiplin..."
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-line px-4 py-2 font-medium text-muted hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-rose-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-rose-700 transition"
                >
                  Terbitkan Surat Peringatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Format Cetak SP */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-line bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <FileText className="text-rose-600" size={18} />
                <h3 className="font-bold text-ink text-sm">Dokumen Surat Peringatan Resmi</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="text-muted hover:text-ink text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="rounded-xl border border-line bg-slate-50/50 p-5 text-xs text-ink space-y-4 dark:bg-slate-800/40">
              <div className="text-center border-b border-slate-300 pb-3 dark:border-slate-700">
                <h4 className="font-black text-sm uppercase tracking-wide">PT GLOBAL SOLUSI PRIMA</h4>
                <p className="text-[11px] text-muted">Divisi Manajemen Sumber Daya Manusia (SDM)</p>
                <p className="font-bold text-xs mt-2 underline uppercase text-rose-600">
                  {selectedRecord.level === "sp3"
                    ? "SURAT PERINGATAN KETIGA (SP-3)"
                    : selectedRecord.level === "sp2"
                    ? "SURAT PERINGATAN KEDUA (SP-2)"
                    : "SURAT PERINGATAN PERTAMA (SP-1)"}
                </p>
                <p className="font-mono text-[11px] text-muted">Nomor: {selectedRecord.sp_number}</p>
              </div>

              <div className="space-y-2">
                <p>Surat Peringatan ini diterbitkan kepada:</p>
                <div className="grid grid-cols-3 pl-2">
                  <span className="text-muted">Nama Karyawan</span>
                  <span className="col-span-2 font-bold">: {selectedRecord.employee_name}</span>
                </div>
                <div className="grid grid-cols-3 pl-2">
                  <span className="text-muted">Tanggal Kejadian</span>
                  <span className="col-span-2">: {selectedRecord.incident_date}</span>
                </div>
                <div className="grid grid-cols-3 pl-2">
                  <span className="text-muted">Dasar Pelanggaran</span>
                  <span className="col-span-2 text-rose-700 dark:text-rose-400 font-medium">
                    : {selectedRecord.issue_description}
                  </span>
                </div>
                <div className="grid grid-cols-3 pl-2">
                  <span className="text-muted">Masa Berlaku Sanksi</span>
                  <span className="col-span-2 font-semibold">: Sampai dengan {selectedRecord.effective_until}</span>
                </div>
              </div>

              <p className="text-[11px] text-muted leading-relaxed">
                Karyawan bersangkutan diharapkan segera melakukan perbaikan kedisiplinan dan kinerja kerja sesuai
                dengan Peraturan Perusahaan PT Global Solusi Prima.
              </p>

              <div className="grid grid-cols-2 pt-4 border-t border-slate-300 dark:border-slate-700 text-center">
                <div>
                  <p className="text-[11px] text-muted">Karyawan Bersangkutan</p>
                  <p className="font-bold text-xs mt-10">({selectedRecord.employee_name})</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted">Direktur / Manager SDM</p>
                  <p className="font-bold text-xs mt-10">( Manajemen GSP )</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="rounded-xl border border-line px-4 py-2 font-medium text-muted hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-rose-700 transition text-xs"
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
