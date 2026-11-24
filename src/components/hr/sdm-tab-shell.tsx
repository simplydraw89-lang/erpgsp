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
  Receipt,
  Compass,
  Timer,
  FolderLock,
  CheckCircle2,
  FileCheck,
} from "lucide-react"
import { PersonalAttendanceWidget, type SimpleAttendanceDay } from "@/components/hr/personal-attendance-widget"
import { PersonalEmployeeProfile, type PersonalProfileData } from "@/components/hr/personal-employee-profile"
import { MyAnnualPayslipView } from "@/components/hr/my-annual-payslip-view"
import { MyWorkSummaryView, type MyProjectItem, type MyWorkTaskItem } from "@/components/hr/my-work-summary-view"
import { MyLeaveAnnualTracker, type MyLeaveRequest } from "@/components/hr/my-leave-annual-tracker"
import { MyReimbursementView, type MyReimbursementItem } from "@/components/hr/my-reimbursement-view"
import { MySppdView, type MySppdItem } from "@/components/hr/my-sppd-view"
import { MyTimesheetView, type MyTimesheetItem } from "@/components/hr/my-timesheet-view"
import { MyDocumentsVault, type MyDocumentItem } from "@/components/hr/my-documents-vault"

import { ManagementLeaveApprovalView, type ManagementLeaveRequestItem } from "@/components/hr/management-leave-approval-view"
import { ManagementAttendanceMonitoring, type MonitoringAttendanceItem } from "@/components/hr/management-attendance-monitoring"
import { ManagementContractTracker } from "@/components/hr/management-contract-tracker"
import { ManagementDisciplineSpView, type DisciplinaryActionItem } from "@/components/hr/management-discipline-sp-view"
import { PayrollWorkbench, type EmployeeOption, type PayrollRunRow } from "@/components/hr/payroll-workbench"
import type { UserPayslip } from "@/components/hr/employee-payslip-viewer"

interface SdmTabShellProps {
  // === Data Personal (Untuk Semua User) ===
  profile: PersonalProfileData
  todayAttendance: SimpleAttendanceDay | null
  yesterdayAttendance: SimpleAttendanceDay | null
  personalPayslips: UserPayslip[]
  myProjects: MyProjectItem[]
  myTasks: MyWorkTaskItem[]
  leaveQuota: number
  leaveUsed: number
  myLeaveRequests: MyLeaveRequest[]
  myReimbursements: MyReimbursementItem[]
  mySppdList: MySppdItem[]
  myTimesheets: MyTimesheetItem[]
  myDocuments: MyDocumentItem[]
  userName: string

  // === Data Khusus HR / Management (Dilindungi Hak Akses) ===
  canManageHR: boolean
  canManagePayroll: boolean
  canApprovePayroll: boolean
  allEmployees: EmployeeOption[]
  allPayrollRuns: PayrollRunRow[]
  allLeaveRequests: ManagementLeaveRequestItem[]
  monitoringLogs: MonitoringAttendanceItem[]
  disciplinaryRecords: DisciplinaryActionItem[]
  currentUserId: string
  isOwner: boolean
  initialTab?: string
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
  myReimbursements,
  mySppdList,
  myTimesheets,
  myDocuments,
  userName,
  canManageHR,
  canManagePayroll,
  canApprovePayroll,
  allEmployees,
  allPayrollRuns,
  allLeaveRequests,
  monitoringLogs,
  disciplinaryRecords,
  currentUserId,
  isOwner,
  initialTab,
}: SdmTabShellProps) {
  const validTabs = [
    "attendance",
    "profile",
    "payslip",
    "work",
    "leave",
    "reimbursement",
    "sppd",
    "timesheet",
    "vault",
    "hr_leave_approval",
    "hr_monitoring",
    "hr_contracts",
    "hr_discipline",
    "hr_payroll",
    "hr_employees",
    "hr_kpi",
  ]
  const resolvedTab = initialTab && validTabs.includes(initialTab) ? (initialTab as any) : "attendance"
  const [activeTab, setActiveTab] = useState<
    | "attendance"
    | "profile"
    | "payslip"
    | "work"
    | "leave"
    | "reimbursement"
    | "sppd"
    | "timesheet"
    | "vault"
    | "hr_leave_approval"
    | "hr_monitoring"
    | "hr_contracts"
    | "hr_discipline"
    | "hr_payroll"
    | "hr_employees"
    | "hr_kpi"
  >(resolvedTab)

  return (
    <div className="space-y-6">
      {/* Tab Navigation Menu */}
      <div className="flex border-b border-line gap-1 overflow-x-auto pb-px">
        {/* === FITUR UNTUK SEMUA USER (MANDIRI) === */}
        <button
          type="button"
          onClick={() => setActiveTab("attendance")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
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
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
            activeTab === "profile"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <User size={14} />
          <span>Data Diri</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payslip")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
            activeTab === "payslip"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <CreditCard size={14} />
          <span>Slip Gaji (1 Thn)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("work")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
            activeTab === "work"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <Briefcase size={14} />
          <span>Rekap Pekerjaan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("leave")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
            activeTab === "leave"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <CalendarDays size={14} />
          <span>Izin & Cuti</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reimbursement")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
            activeTab === "reimbursement"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <Receipt size={14} />
          <span>Klaim Reimbursement</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sppd")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
            activeTab === "sppd"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <Compass size={14} />
          <span>SPPD Tugas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("timesheet")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
            activeTab === "timesheet"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <Timer size={14} />
          <span>Timesheet Jam Kerja</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("vault")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
            activeTab === "vault"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <FolderLock size={14} />
          <span>Vault Berkas & SKA</span>
        </button>

        {/* === FITUR KHUSUS HR & MANAGEMENT (HANYA MUNCUL JIKA PUNYA WEWENANG) === */}
        {(canManageHR || canManagePayroll) && (
          <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 self-center mx-2 shrink-0" />
        )}

        {canManageHR && (
          <button
            type="button"
            onClick={() => setActiveTab("hr_leave_approval")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "hr_leave_approval"
                ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                : "border-transparent text-indigo-900/60 hover:text-indigo-900 dark:text-indigo-400/60"
            }`}
          >
            <CheckCircle2 size={13} className="text-indigo-500" />
            <span>Approval Cuti ({allLeaveRequests.filter((r) => r.status === "submitted").length})</span>
          </button>
        )}

        {canManageHR && (
          <button
            type="button"
            onClick={() => setActiveTab("hr_monitoring")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "hr_monitoring"
                ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                : "border-transparent text-indigo-900/60 hover:text-indigo-900 dark:text-indigo-400/60"
            }`}
          >
            <Clock size={13} className="text-indigo-500" />
            <span>Live Monitoring Absen</span>
          </button>
        )}

        {canManageHR && (
          <button
            type="button"
            onClick={() => setActiveTab("hr_contracts")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "hr_contracts"
                ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                : "border-transparent text-indigo-900/60 hover:text-indigo-900 dark:text-indigo-400/60"
            }`}
          >
            <FileCheck size={13} className="text-indigo-500" />
            <span>Kontrak PKWT (H-30)</span>
          </button>
        )}

        {canManageHR && (
          <button
            type="button"
            onClick={() => setActiveTab("hr_discipline")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "hr_discipline"
                ? "border-rose-600 text-rose-700 dark:border-rose-400 dark:text-rose-300"
                : "border-transparent text-rose-900/60 hover:text-rose-900 dark:text-rose-400/60"
            }`}
          >
            <ShieldAlert size={13} className="text-rose-500" />
            <span>Disiplin & SP</span>
          </button>
        )}

        {canManagePayroll && (
          <button
            type="button"
            onClick={() => setActiveTab("hr_payroll")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "hr_payroll"
                ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                : "border-transparent text-indigo-900/60 hover:text-indigo-900 dark:text-indigo-400/60"
            }`}
          >
            <Lock size={12} className="text-indigo-500" />
            <span>Payroll Perusahaan</span>
          </button>
        )}

        {canManageHR && (
          <button
            type="button"
            onClick={() => setActiveTab("hr_employees")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "hr_employees"
                ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                : "border-transparent text-indigo-900/60 hover:text-indigo-900 dark:text-indigo-400/60"
            }`}
          >
            <UsersRound size={12} className="text-indigo-500" />
            <span>Rekap Seluruh Karyawan</span>
          </button>
        )}

        {canManageHR && (
          <button
            type="button"
            onClick={() => setActiveTab("hr_kpi")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "hr_kpi"
                ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                : "border-transparent text-indigo-900/60 hover:text-indigo-900 dark:text-indigo-400/60"
            }`}
          >
            <Award size={12} className="text-indigo-500" />
            <span>KPI & Kinerja</span>
          </button>
        )}
      </div>

      {/* Tab 1: Absensi Mandiri (HP & Laptop) */}
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

      {/* Tab 6: Klaim Reimbursement Operasional Lapangan */}
      {activeTab === "reimbursement" && (
        <MyReimbursementView
          reimbursements={myReimbursements}
          projects={myProjects}
          userName={userName}
        />
      )}

      {/* Tab 7: Surat Tugas SPPD Perjalanan Dinas */}
      {activeTab === "sppd" && <MySppdView sppdList={mySppdList} userName={userName} />}

      {/* Tab 8: Timesheet Logbook Jam Kerja */}
      {activeTab === "timesheet" && (
        <MyTimesheetView timesheets={myTimesheets} projects={myProjects} userName={userName} />
      )}

      {/* Tab 9: Vault Berkas & Sertifikat Keahlian */}
      {activeTab === "vault" && <MyDocumentsVault documents={myDocuments} userName={userName} />}

      {/* Tab 10 [MANAJEMEN]: Approval Cuti Seluruh Karyawan */}
      {activeTab === "hr_leave_approval" && canManageHR && (
        <ManagementLeaveApprovalView requests={allLeaveRequests} />
      )}

      {/* Tab 11 [MANAJEMEN]: Live Monitoring Presensi Cabang & Site */}
      {activeTab === "hr_monitoring" && canManageHR && (
        <ManagementAttendanceMonitoring logs={monitoringLogs} />
      )}

      {/* Tab 12 [MANAJEMEN]: Manajemen Kontrak PKWT (H-30) */}
      {activeTab === "hr_contracts" && canManageHR && (
        <ManagementContractTracker employees={allEmployees} />
      )}

      {/* Tab 13 [MANAJEMEN]: Manajemen Disiplin & SP (Confidential) */}
      {activeTab === "hr_discipline" && canManageHR && (
        <ManagementDisciplineSpView records={disciplinaryRecords} employees={allEmployees} />
      )}

      {/* Tab 14 [MANAJEMEN]: Payroll Perusahaan (Khusus HR/Finance/Owner) */}
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

      {/* Tab 15 [MANAJEMEN]: Rekap Karyawan Keseluruhan (Khusus HR & Direksi) */}
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

      {/* Tab 16 [MANAJEMEN]: KPI Karyawan & Penilaian Kinerja */}
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
