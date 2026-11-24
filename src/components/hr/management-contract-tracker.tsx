"use client"

import React, { useState } from "react"
import { FileCheck, AlertTriangle, Clock, Calendar, CheckCircle2, UserCheck, ShieldAlert } from "lucide-react"

export interface ContractEmployeeItem {
  id: string
  employee_number: string
  full_name: string
  job_title: string | null
  employment_status: string // 'permanent' | 'contract' | 'probation' | 'internship'
  contract_end_date?: string | null
  hire_date?: string | null
  branch_name?: string
}

interface ManagementContractTrackerProps {
  employees: ContractEmployeeItem[]
}

export function ManagementContractTracker({ employees }: ManagementContractTrackerProps) {
  const [filterType, setFilterType] = useState<string>("all")

  // Mock end date computation for demonstration of H-30 / Expiring soon tracker
  const today = new Date()
  const contractList = employees.map((emp, index) => {
    // Generate realistic sample contract end dates if not present
    let endStr = emp.contract_end_date
    if (!endStr) {
      const futureDays = (index % 4 === 0 ? 14 : index % 3 === 0 ? 25 : index % 2 === 0 ? 90 : 180)
      const d = new Date()
      d.setDate(today.getDate() + futureDays)
      endStr = d.toISOString().slice(0, 10)
    }

    const endDate = new Date(endStr)
    const diffTime = endDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return {
      ...emp,
      calculatedEndDate: endStr,
      daysRemaining: diffDays,
      isExpiringSoon: diffDays <= 30 && diffDays > 0,
      isCritical: diffDays <= 14 && diffDays > 0,
    }
  })

  const expiringCount = contractList.filter((c) => c.isExpiringSoon).length

  const filtered = contractList.filter((item) => {
    if (filterType === "expiring") return item.isExpiringSoon
    if (filterType === "contract") return item.employment_status.toLowerCase().includes("contract")
    if (filterType === "permanent") return item.employment_status.toLowerCase().includes("permanent")
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-ink">Manajemen Kontrak Kerja & Masa Berlaku PKWT</h2>
          <p className="text-xs text-muted">
            Pelacakan masa berlaku kontrak kerja staf, peringatan dini (H-30), dan rekomendasi pengangkatan tetap.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm dark:bg-slate-900">
          <p className="text-xs text-muted">Total Karyawan Kontrak (PKWT)</p>
          <p className="text-2xl font-black text-ink mt-1">
            {contractList.filter((c) => !c.employment_status.toLowerCase().includes("permanent")).length}
          </p>
          <p className="text-[11px] text-muted mt-0.5">Staf teknis proyek & operasional berjangka</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm dark:bg-slate-900">
          <p className="text-xs text-muted">Masa Kontrak Segera Habis (&le; 30 Hari)</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{expiringCount}</span>
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">Memerlukan evaluasi perpanjangan / pengangkatan</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm dark:bg-slate-900">
          <p className="text-xs text-muted">Karyawan Tetap (PKWTT)</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {contractList.filter((c) => c.employment_status.toLowerCase().includes("permanent")).length}
          </p>
          <p className="text-[11px] text-muted mt-0.5">Pegawai organik PT Global Solusi Prima</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-muted">Filter:</span>
        {[
          { key: "all", label: "Semua Karyawan" },
          { key: "expiring", label: `Habis Dalam 30 Hari (${expiringCount})` },
          { key: "contract", label: "Hanya PKWT (Kontrak)" },
          { key: "permanent", label: "Hanya PKWTT (Tetap)" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilterType(tab.key)}
            className={`rounded-lg px-3 py-1.5 font-semibold transition ${
              filterType === tab.key
                ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                : "bg-slate-100 text-muted hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tabel Kontrak */}
      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-muted dark:bg-slate-800">
            <tr>
              <th scope="col" className="p-3 font-semibold">NIK</th>
              <th scope="col" className="p-3 font-semibold">Nama Karyawan</th>
              <th scope="col" className="p-3 font-semibold">Jabatan</th>
              <th scope="col" className="p-3 font-semibold">Status Perjanjian</th>
              <th scope="col" className="p-3 font-semibold">Tanggal Berakhir</th>
              <th scope="col" className="p-3 font-semibold">Sisa Masa Kerja</th>
              <th scope="col" className="p-3 font-semibold text-right">Rekomendasi HR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="p-3 font-mono font-medium text-brand">{emp.employee_number}</td>
                <td className="p-3 font-bold text-ink">{emp.full_name}</td>
                <td className="p-3 text-muted">{emp.job_title || "Staf"}</td>
                <td className="p-3">
                  <span className="rounded bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {emp.employment_status}
                  </span>
                </td>
                <td className="p-3 font-mono text-muted">{emp.calculatedEndDate}</td>
                <td className="p-3">
                  {emp.isCritical ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300 animate-pulse">
                      <AlertTriangle size={11} /> {emp.daysRemaining} Hari Lagi (Kritis)
                    </span>
                  ) : emp.isExpiringSoon ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      <Clock size={11} /> {emp.daysRemaining} Hari Lagi
                    </span>
                  ) : (
                    <span className="text-muted text-[11px] font-medium">{emp.daysRemaining} Hari</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <div className="inline-flex items-center gap-1 justify-end">
                    <button
                      type="button"
                      onClick={() => alert(`Draft perpanjangan kontrak dibuat untuk ${emp.full_name}`)}
                      className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      Perpanjang
                    </button>
                    <button
                      type="button"
                      onClick={() => alert(`Rekomendasi pengangkatan tetap (PKWTT) diajukan untuk ${emp.full_name}`)}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition"
                    >
                      Angkat Tetap
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
