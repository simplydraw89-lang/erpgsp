"use client"

import React, { useState } from "react"
import {
  FileText,
  Printer,
  Download,
  Eye,
  CheckCircle2,
  Calendar,
  Building2,
  CreditCard,
  ShieldCheck,
  ChevronRight,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/money"

export interface UserPayslip {
  id: string
  period_month: string
  title: string
  status: string
  base_salary: number
  allowances: number
  deductions: number
  pph21_amount: number
  net_pay: number
  notes?: string | null
  created_at: string
  employee_name: string
  job_title?: string | null
  department?: string | null
  employee_number?: string | null
}

interface EmployeePayslipViewerProps {
  payslips: UserPayslip[]
  userName: string
}

export function EmployeePayslipViewer({ payslips, userName }: EmployeePayslipViewerProps) {
  const [selectedPayslip, setSelectedPayslip] = useState<UserPayslip | null>(payslips[0] || null)
  const [showPrintModal, setShowPrintModal] = useState(false)

  function openPrintModal(slip: UserPayslip) {
    setSelectedPayslip(slip)
    setShowPrintModal(true)
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="rounded-2xl border border-line bg-gradient-to-r from-blue-50/40 via-teal-50/30 to-slate-50/50 p-6 dark:from-slate-900/60 dark:to-slate-800/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <CreditCard size={22} />
            </div>
            <div>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                Portal Mandiri Karyawan
              </span>
              <h2 className="mt-1 text-xl font-bold text-ink">Informasi Slip Gaji Saya</h2>
              <p className="text-xs text-muted">
                Riwayat slip gaji bulanan resmi PT Global Solusi Prima yang dapat dilihat dan dicetak langsung.
              </p>
            </div>
          </div>

          {selectedPayslip && (
            <Button
              type="button"
              onClick={() => openPrintModal(selectedPayslip)}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
            >
              <Printer size={14} />
              <span>Cetak / Unduh Slip Gaji ({selectedPayslip.period_month})</span>
            </Button>
          )}
        </div>
      </div>

      {/* Grid Slip Gaji & Rincian */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Daftar Periode Slip Gaji */}
        <Card className="p-4 space-y-3 lg:col-span-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Calendar size={14} className="text-brand" />
            <span>Pilih Periode Slip Gaji</span>
          </h3>

          <div className="space-y-2">
            {payslips.length ? (
              payslips.map((slip) => {
                const isSelected = selectedPayslip?.id === slip.id
                return (
                  <button
                    key={slip.id}
                    type="button"
                    onClick={() => setSelectedPayslip(slip)}
                    className={`w-full rounded-xl border p-3.5 text-left transition ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/60 shadow-sm dark:bg-blue-950/40 dark:border-blue-700"
                        : "border-line bg-white hover:bg-slate-50 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-ink">{slip.period_month}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          slip.status === "paid"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        }`}
                      >
                        {slip.status === "paid" ? "Sudah Dibayar" : "Disetujui"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-brand">
                      {formatCurrency(slip.net_pay)}
                    </p>
                    <p className="text-[10px] text-muted">{slip.title}</p>
                  </button>
                )
              })
            ) : (
              <div className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-muted">
                Belum ada slip gaji yang diterbitkan untuk akun Anda.
              </div>
            )}
          </div>
        </Card>

        {/* Panel Rincian Slip Gaji Terpilih */}
        <Card className="p-6 space-y-5 lg:col-span-2">
          {selectedPayslip ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <div>
                  <h3 className="text-base font-bold text-ink">
                    Rincian Penghasilan Periode {selectedPayslip.period_month}
                  </h3>
                  <p className="text-xs text-muted">
                    Karyawan: <span className="font-semibold text-ink">{userName}</span>
                  </p>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => openPrintModal(selectedPayslip)}
                  className="gap-1.5 text-xs font-semibold"
                >
                  <Eye size={13} />
                  <span>Lihat Format Cetak</span>
                </Button>
              </div>

              {/* Rincian Komponen Gaji */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Penerimaan */}
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    A. Penerimaan (Gross)
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted">Gaji Pokok:</span>
                      <span className="font-semibold text-ink tabular-nums">
                        {formatCurrency(selectedPayslip.base_salary)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Tunjangan Operasional:</span>
                      <span className="font-semibold text-ink tabular-nums">
                        {formatCurrency(selectedPayslip.allowances)}
                      </span>
                    </div>
                    <div className="border-t border-emerald-200/60 pt-2 flex justify-between font-bold text-emerald-900 dark:text-emerald-300">
                      <span>Total Penerimaan:</span>
                      <span className="tabular-nums">
                        {formatCurrency(selectedPayslip.base_salary + selectedPayslip.allowances)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Potongan */}
                <div className="rounded-xl border border-red-100 bg-red-50/40 p-4 space-y-3 dark:border-red-900/30 dark:bg-red-950/20">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-red-800 dark:text-red-300">
                    B. Potongan
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted">Potongan Lain / Kasbon:</span>
                      <span className="font-semibold text-ink tabular-nums">
                        {formatCurrency(selectedPayslip.deductions)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">PPh Pasal 21:</span>
                      <span className="font-semibold text-ink tabular-nums">
                        {formatCurrency(selectedPayslip.pph21_amount)}
                      </span>
                    </div>
                    <div className="border-t border-red-200/60 pt-2 flex justify-between font-bold text-red-900 dark:text-red-300">
                      <span>Total Potongan:</span>
                      <span className="tabular-nums">
                        {formatCurrency(selectedPayslip.deductions + selectedPayslip.pph21_amount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Take Home Pay Box */}
              <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-xs text-blue-200 block">GAJI BERSIH DITERIMA (TAKE HOME PAY)</span>
                    <span className="text-2xl font-bold font-mono tracking-tight mt-1 block">
                      {formatCurrency(selectedPayslip.net_pay)}
                    </span>
                  </div>
                  <div className="text-right text-xs text-blue-100">
                    <p>Status: <strong className="text-white uppercase">{selectedPayslip.status}</strong></p>
                    <p className="mt-0.5 text-[11px] text-blue-200">Transfer Bank Perusahaan</p>
                  </div>
                </div>
              </div>

              {selectedPayslip.notes && (
                <div className="rounded-lg bg-slate-50 p-3 text-xs text-muted dark:bg-slate-900">
                  <strong>Catatan HRD:</strong> {selectedPayslip.notes}
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center text-sm text-muted">
              Pilih salah satu periode slip gaji di samping untuk melihat rincian.
            </div>
          )}
        </Card>
      </div>

      {/* Modal Format Cetak Resmi Slip Gaji */}
      {showPrintModal && selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm print:p-0 print:bg-white">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-8 shadow-2xl text-slate-900 print:max-h-none print:shadow-none print:p-6 dark:bg-slate-900 dark:text-white">
            {/* Header Dokumen Cetak */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 dark:border-slate-100">
              <div>
                <h2 className="text-xl font-black tracking-wider uppercase text-blue-900 dark:text-blue-400">
                  PT GLOBAL SOLUSI PRIMA
                </h2>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Engineering, Consulting & Environmental Solutions
                </p>
                <p className="text-[10px] text-slate-500">
                  Jakarta · Surabaya · Jogjakarta
                </p>
              </div>
              <div className="text-right">
                <span className="rounded bg-slate-100 px-2.5 py-1 text-xs font-mono font-bold uppercase text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                  SLIP GAJI
                </span>
                <p className="mt-1 text-xs font-mono text-slate-600 dark:text-slate-400">
                  Periode: {selectedPayslip.period_month}
                </p>
              </div>
            </div>

            {/* Identitas Karyawan */}
            <div className="grid grid-cols-2 gap-4 py-4 text-xs border-b border-slate-200 dark:border-slate-800">
              <div>
                <p><span className="text-slate-500">Nama Karyawan:</span> <strong>{userName}</strong></p>
                <p className="mt-1"><span className="text-slate-500">NIK:</span> {selectedPayslip.employee_number || "GSP-EMP"}</p>
              </div>
              <div className="text-right">
                <p><span className="text-slate-500">Jabatan:</span> {selectedPayslip.job_title || "Staf Teknis"}</p>
                <p className="mt-1"><span className="text-slate-500">Status:</span> Karyawan Aktif</p>
              </div>
            </div>

            {/* Tabel Rincian Pendapatan & Potongan */}
            <div className="grid grid-cols-2 gap-6 py-4 text-xs border-b-2 border-slate-900 dark:border-slate-100">
              <div className="space-y-2">
                <h4 className="font-bold uppercase tracking-wider text-emerald-800 text-[11px] border-b pb-1">
                  Penerimaan
                </h4>
                <div className="flex justify-between">
                  <span>Gaji Pokok</span>
                  <span className="font-mono">{formatCurrency(selectedPayslip.base_salary)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tunjangan Operasional</span>
                  <span className="font-mono">{formatCurrency(selectedPayslip.allowances)}</span>
                </div>
                <div className="border-t pt-1 flex justify-between font-bold text-slate-900 dark:text-white">
                  <span>Total (A)</span>
                  <span className="font-mono">{formatCurrency(selectedPayslip.base_salary + selectedPayslip.allowances)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold uppercase tracking-wider text-red-800 text-[11px] border-b pb-1">
                  Potongan
                </h4>
                <div className="flex justify-between">
                  <span>Potongan Kasbon/Lainnya</span>
                  <span className="font-mono">{formatCurrency(selectedPayslip.deductions)}</span>
                </div>
                <div className="flex justify-between">
                  <span>PPh Pasal 21</span>
                  <span className="font-mono">{formatCurrency(selectedPayslip.pph21_amount)}</span>
                </div>
                <div className="border-t pt-1 flex justify-between font-bold text-slate-900 dark:text-white">
                  <span>Total (B)</span>
                  <span className="font-mono">{formatCurrency(selectedPayslip.deductions + selectedPayslip.pph21_amount)}</span>
                </div>
              </div>
            </div>

            {/* Total Gaji Bersih */}
            <div className="py-4 bg-slate-50 p-4 rounded-xl my-4 text-xs dark:bg-slate-800">
              <div className="flex justify-between items-center text-sm font-bold text-blue-900 dark:text-blue-300">
                <span>GAJI BERSIH DITERIMA (TAKE HOME PAY)</span>
                <span className="text-lg font-mono">{formatCurrency(selectedPayslip.net_pay)}</span>
              </div>
            </div>

            {/* Kolom Tanda Tangan */}
            <div className="grid grid-cols-2 gap-8 pt-6 text-center text-xs text-slate-600 dark:text-slate-400">
              <div>
                <p>Diterima Oleh,</p>
                <div className="h-14" />
                <p className="font-bold text-slate-900 dark:text-white border-t border-slate-300 pt-1 inline-block min-w-32">
                  {userName}
                </p>
              </div>
              <div>
                <p>Finance & HR Department,</p>
                <div className="h-14" />
                <p className="font-bold text-slate-900 dark:text-white border-t border-slate-300 pt-1 inline-block min-w-32">
                  PT Global Solusi Prima
                </p>
              </div>
            </div>

            {/* Tombol Aksi Modal */}
            <div className="mt-8 flex justify-end gap-2 border-t border-slate-200 pt-4 print:hidden">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowPrintModal(false)}
              >
                Tutup
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handlePrint}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Printer size={13} />
                <span>Cetak / Simpan PDF</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
