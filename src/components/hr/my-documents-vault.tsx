"use client"

import React, { useState } from "react"
import { ShieldCheck, PlusCircle, FileText, CheckCircle2, Clock, XCircle, Award, ExternalLink } from "lucide-react"
import { uploadEmployeeDocumentAction } from "@/app/(workspace)/modul/hr-actions"

export interface MyDocumentItem {
  id: string
  doc_type: "ktp" | "npwp" | "bpjs_kes" | "bpjs_tk" | "diploma" | "certificate_ska" | "certificate_k3" | "other"
  title: string
  file_url: string
  certificate_expiry: string | null
  verification_status: "pending" | "verified" | "rejected"
  created_at: string
}

interface MyDocumentsVaultProps {
  documents: MyDocumentItem[]
  userName: string
}

export function MyDocumentsVault({ documents, userName }: MyDocumentsVaultProps) {
  const [showModal, setShowModal] = useState(false)

  function getDocTypeLabel(type: string) {
    switch (type) {
      case "ktp":
        return "KTP (Kartu Tanda Penduduk)"
      case "npwp":
        return "NPWP Pribadi"
      case "bpjs_kes":
        return "Kartu BPJS Kesehatan"
      case "bpjs_tk":
        return "BPJS Ketenagakerjaan"
      case "diploma":
        return "Ijazah & Transkrip Terakhir"
      case "certificate_ska":
        return "Sertifikat Keahlian Kerja (SKA/SKK)"
      case "certificate_k3":
        return "Sertifikat K3 / Ahli K3"
      default:
        return "Dokumen Lainnya"
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "verified":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 size={11} /> Terverifikasi HR
          </span>
        )
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            <XCircle size={11} /> Ditolak
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <Clock size={11} /> Menunggu Verifikasi
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-ink">Pusat Berkas & Sertifikasi Karyawan ({userName})</h2>
          <p className="text-xs text-muted">
            Penyimpanan digital aman untuk identitas, ijazah, serta sertifikat keahlian tender (SKA/SKK/K3).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition"
        >
          <PlusCircle size={15} />
          <span>Unggah Dokumen / Sertifikat</span>
        </button>
      </div>

      {/* Grid Dokumen Vault */}
      <div className="grid gap-4 sm:grid-cols-3">
        {documents.length === 0 ? (
          <div className="col-span-3 rounded-xl border border-line bg-white p-8 text-center text-muted dark:bg-slate-900">
            <ShieldCheck size={32} className="mx-auto text-muted/50 mb-2" />
            <p className="font-semibold text-ink text-sm">Belum Ada Dokumen Tersimpan</p>
            <p className="text-xs mt-1">
              Klik &quot;Unggah Dokumen / Sertifikat&quot; untuk mengamankan KTP, NPWP, BPJS, atau Sertifikasi keahlian Anda.
            </p>
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="rounded-xl border border-line bg-white p-4 shadow-sm flex flex-col justify-between space-y-3 dark:bg-slate-900"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="rounded-lg bg-blue-50 p-2 text-brand dark:bg-blue-950">
                    <Award size={18} />
                  </div>
                  {getStatusBadge(doc.verification_status)}
                </div>
                <h4 className="font-bold text-ink text-xs mt-3">{doc.title}</h4>
                <p className="text-[11px] text-muted mt-0.5">{getDocTypeLabel(doc.doc_type)}</p>
                {doc.certificate_expiry && (
                  <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium mt-1">
                    Masa Berlaku s/d: {doc.certificate_expiry}
                  </p>
                )}
              </div>

              <div className="border-t border-line pt-2.5 flex items-center justify-between text-xs">
                <span className="text-[10px] text-muted">{doc.created_at.slice(0, 10)}</span>
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                >
                  <span>Buka Berkas</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Upload Berkas */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-brand" size={18} />
                <h3 className="font-bold text-ink text-sm">Unggah Dokumen / Sertifikat Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-muted hover:text-ink text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form action={uploadEmployeeDocumentAction} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-ink mb-1">Jenis Berkas / Sertifikat *</label>
                <select
                  name="doc_type"
                  required
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                >
                  <option value="ktp">KTP (Kartu Tanda Penduduk)</option>
                  <option value="npwp">NPWP Pribadi</option>
                  <option value="bpjs_kes">BPJS Kesehatan</option>
                  <option value="bpjs_tk">BPJS Ketenagakerjaan</option>
                  <option value="diploma">Ijazah & Transkrip Akademik</option>
                  <option value="certificate_ska">Sertifikat Keahlian (SKA/SKK)</option>
                  <option value="certificate_k3">Sertifikat K3 / Ahli K3</option>
                  <option value="other">Dokumen Pendukung Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Nama / Judul Dokumen *</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="Contoh: SKA Ahli Geoteknik Madya LPJK"
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Link Dokumen (Google Drive / Cloud URL) *</label>
                <input
                  type="url"
                  name="file_url"
                  required
                  placeholder="https://drive.google.com/... atau URL dokumen"
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                />
                <p className="text-[10px] text-muted mt-1">
                  Masukkan link Google Drive atau penyimpanan cloud yang dapat diakses oleh tim SDM/HR.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Masa Berlaku (Khusus Sertifikasi)</label>
                <input
                  type="date"
                  name="certificate_expiry"
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-brand"
                />
                <p className="text-[10px] text-muted mt-1">Kosongkan jika dokumen berlaku seumur hidup (KTP/Ijazah).</p>
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
                  className="rounded-xl bg-brand px-5 py-2 font-semibold text-white shadow-sm hover:opacity-90 transition"
                >
                  Simpan ke Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
