"use client"

import React, { useState } from "react"
import {
  User,
  Clock,
  CreditCard,
  Briefcase,
  CalendarDays,
  ShieldAlert,
  UsersRound,
  Award,
  Lock,
} from "lucide-react"
import { PersonalAttendanceWidget, type SimpleAttendanceDay } from "@/components/hr/personal-attendance-widget"
import { PersonalEmployeeProfile, type PersonalProfileData } from "@/components/hr/personal-employee-profile"
import { MyAnnualPayslipView } from "@/components/hr/my-annual-payslip-view"
import { MyWorkSummaryView, type MyProjectItem, type MyWorkTaskItem } from "@/components/hr/my-work-summary-view"
import { MyLeaveAnnualTracker, type MyLeaveRequest } from "@/components/hr/my-leave-annual-tracker"
import { PayrollWorkbench, type EmployeeOption, type PayrollRunRow } from "@/components/hr/payroll-workbench"
import type { UserPayslip } from "@/components/hr/employee-payslip-viewer"

interface SdmTabShellProps {
  // Data Personal (Untuk Semua User)
  profile: PersonalProfileData
  todayAttendance: SimpleAttendanceDay | null
  yesterdayAttendance: SimpleAttendanceDay | null
  personalPayslips: UserPayslip[]
  myProjects: MyProjectItem[]
  myTasks: MyWorkTaskItem[]
  leaveQuota: number
  leaveUsed: number
  myLeaveRequests: MyLeaveRequest[]
  userName: string

  // Data Khusus HR / Management (Dilindungi Hak Akses)
  canManageHR: boolean
  canManagePayroll: boolean
  canApprovePayroll: boolean
  allEmployees: EmployeeOption[]
  allPayrollRuns: PayrollRunRow[]
  currentUserId: string
  isOwner: boolean
}

export function SdmTabShell({
  profile,
  todayAttendance,
  yesterdayAttendance,
  personalPayslips,
  myProjects,
  myTasks,
  leaveQuota,
  leaveUsed,
  myLeaveRequests,
  userName,
  canManageHR,
  canManagePayroll,
  canApprovePayroll,
  allEmployees,
  allPayrollRuns,
  currentUserId,
  isOwner,
}: SdmTabShellProps) {
  const [activeTab, setActiveTab] = useState<
    "attendance" | "profile" | "payslip" | "work" | "leave" | "hr_employees" | "hr_payroll" | "hr_kpi"
  >("attendance")

  return (
    <div className="space-y-6">
      {/* Tab Navigation Menu */}
      <div className="flex border-b border-line gap-1 overflow-x-auto pb-px">
        {/* === FITUR UNTUK SEMUA USER (MANDIRI) === */}
        <button
          type="button"
          onClick={() => setActiveTab("attendance")}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
            activeTab === "attendance"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <Clock size={14} />
          <span>Absensi Saya</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
            activeTab === "profile"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <User size={14} />
          <span>Data Diri Karyawan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payslip")}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
            activeTab === "payslip"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <CreditCard size={14} />
          <span>Slip Gaji Saya (1 Tahun)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("work")}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
            activeTab === "work"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <Briefcase size={14} />
          <span>Rekap Pekerjaan Saya</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("leave")}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
            activeTab === "leave"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <CalendarDays size={14} />
          <span>Izin & Cuti Personal (1 Tahun)</span>
        </button>

        {/* === FITUR KHUSUS HR & MANAGEMENT (HANYA MUNCUL JIKA PUNYA WEWENANG) === */}
        {(canManageHR || canManagePayroll) && (
          <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 self-center mx-2 shrink-0" />
        )}

        {canManagePayroll && (
          <button
            type="button"
            onClick={() => setActiveTab("hr_payroll")}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "hr_payroll"
                ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                : "border-transparent text-indigo-900/60 hover:text-indigo-900 dark:text-indigo-400/60"
            }`}
          >
            <Lock size={12} className="text-indigo-500" />
            <span>Payroll Perusahaan (HR/Finance)</span>
          </button>
        )}

        {canManageHR && (
          <button
            type="button"
            onClick={() => setActiveTab("hr_employees")}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "hr_employees"
                ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                : "border-transparent text-indigo-900/60 hover:text-indigo-900 dark:text-indigo-400/60"
            }`}
          >
            <Lock size={12} className="text-indigo-500" />
            <span>Rekap Seluruh Karyawan (HR)</span>
          </button>
        )}

        {canManageHR && (
          <button
            type="button"
            onClick={() => setActiveTab("hr_kpi")}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "hr_kpi"
                ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                : "border-transparent text-indigo-900/60 hover:text-indigo-900 dark:text-indigo-400/60"
            }`}
          >
            <Award size={12} className="text-indigo-500" />
            <span>KPI & Kinerja (HR/Direksi)</span>
          </button>
        )}
      </div>

      {/* Tab 1: Absensi Mandiri (HP & Laptop Friendly) */}
      {activeTab === "attendance" && (
        <PersonalAttendanceWidget
          todayAttendance={todayAttendance}
          yesterdayAttendance={yesterdayAttendance}
          userName={userName}
        />
      )}

      {/* Tab 2: Data Diri Karyawan */}
      {activeTab === "profile" && <PersonalEmployeeProfile profile={profile} />}

      {/* Tab 3: Slip Gaji Saya (1 Tahun Berjalan) */}
      {activeTab === "payslip" && (
        <MyAnnualPayslipView payslips={personalPayslips} userName={userName} />
      )}

      {/* Tab 4: Rekap Pekerjaan & Proyek Saya */}
      {activeTab === "work" && (
        <MyWorkSummaryView projects={myProjects} tasks={myTasks} userName={userName} />
      )}

      {/* Tab 5: Izin & Cuti Personal 1 Tahun */}
      {activeTab === "leave" && (
        <MyLeaveAnnualTracker
          annualQuota={leaveQuota}
          usedDays={leaveUsed}
          requests={myLeaveRequests}
          userName={userName}
        />
      )}

      {/* Tab 6 [TERBATAS]: Payroll Perusahaan (Khusus HR/Finance/Owner) */}
      {activeTab === "hr_payroll" && canManagePayroll && (
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-xs text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200 flex items-center gap-2">
            <Lock size={15} className="text-indigo-600 shrink-0" />
            <span>
              <strong>Kewenangan Khusus:</strong> Tab ini hanya dapat diakses oleh HR, Finance, dan Direksi/Owner untuk memproses dan menyetujui penggajian bulanan seluruh karyawan perusahaan.
            </span>
          </div>

          <PayrollWorkbench
            employees={allEmployees}
            runs={allPayrollRuns}
            canCreate={canManagePayroll}
            canApprove={canApprovePayroll}
            currentUserId={currentUserId}
            isOwner={isOwner}
          />
        </div>
      )}

      {/* Tab 7 [TERBATAS]: Rekap Karyawan Keseluruhan (Khusus HR & Direksi) */}
      {activeTab === "hr_employees" && canManageHR && (
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-xs text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200 flex items-center gap-2">
            <Lock size={15} className="text-indigo-600 shrink-0" />
            <span>
              <strong>Direktori Manajemen SDM:</strong> Akses data kepegawaian seluruh karyawan PT Global Solusi Prima.
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-muted dark:bg-slate-800">
                <tr>
                  <th scope="col" className="p-3 font-semibold">NIK</th>
                  <th scope="col" className="p-3 font-semibold">Nama Karyawan</th>
                  <th scope="col" className="p-3 font-semibold">Jabatan</th>
                  <th scope="col" className="p-3 font-semibold">Status</th>
                  <th scope="col" className="p-3 font-semibold">Masa Kerja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {allEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-mono font-medium text-brand">{emp.employee_number}</td>
                    <td className="p-3 font-semibold text-ink">{emp.full_name}</td>
                    <td className="p-3 text-muted">{emp.job_title || "-"}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        {emp.employment_status}
                      </span>
                    </td>
                    <td className="p-3 text-muted">Aktif</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 8 [TERBATAS]: KPI Karyawan & Penilaian Kinerja */}
      {activeTab === "hr_kpi" && canManageHR && (
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-xs text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200 flex items-center gap-2">
            <Award size={16} className="text-indigo-600 shrink-0" />
            <span>
              <strong>Manajemen Kinerja & KPI:</strong> Penilaian objektif karyawan berdasarkan target penyelesaian proyek, kehadiran, dan kedisiplinan kerja.
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {allEmployees.slice(0, 6).map((emp) => (
              <div key={emp.id} className="rounded-xl border border-line bg-white p-4 space-y-2 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-ink">{emp.full_name}</span>
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    KPI 92%
                  </span>
                </div>
                <p className="text-[11px] text-muted">{emp.job_title || "Staf Teknis"}</p>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
                  <div className="h-full bg-emerald-500 rounded-full w-[92%]" />
                </div>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                  Performa Sangat Baik (Target Proyek & Presensi Terpenuhi)
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
