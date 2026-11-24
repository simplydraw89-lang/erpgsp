"use client"

import React, { useState } from "react"
import {
  Users,
  Clock,
  CreditCard,
  CalendarDays,
  Briefcase,
  ShieldCheck,
} from "lucide-react"
import { AttendancePanel, type AttendanceRecord } from "@/components/hr/attendance-panel"
import { EmployeePayslipViewer, type UserPayslip } from "@/components/hr/employee-payslip-viewer"
import { LeaveManagementPanel, type LeaveRequestRow } from "@/components/hr/leave-management-panel"
import { PayrollWorkbench, type EmployeeOption, type PayrollRunRow } from "@/components/hr/payroll-workbench"

interface SdmTabShellProps {
  todayAttendance: AttendanceRecord | null
  attendanceRecords: AttendanceRecord[]
  payslips: UserPayslip[]
  employees: EmployeeOption[]
  payrollRuns: PayrollRunRow[]
  leaveQuota: number
  leaveUsed: number
  leaveRequests: LeaveRequestRow[]
  userName: string
  canManagePayroll: boolean
  canApprovePayroll: boolean
  currentUserId: string
  isOwner: boolean
}

export function SdmTabShell({
  todayAttendance,
  attendanceRecords,
  payslips,
  employees,
  payrollRuns,
  leaveQuota,
  leaveUsed,
  leaveRequests,
  userName,
  canManagePayroll,
  canApprovePayroll,
  currentUserId,
  isOwner,
}: SdmTabShellProps) {
  const [activeTab, setActiveTab] = useState<"attendance" | "payslip" | "leave" | "payroll" | "employees">("attendance")

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-line gap-2 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("attendance")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
            activeTab === "attendance"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <Clock size={14} />
          <span>Presensi & Absensi</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payslip")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
            activeTab === "payslip"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <CreditCard size={14} />
          <span>Slip Gaji Saya</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("leave")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
            activeTab === "leave"
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <CalendarDays size={14} />
          <span>Cuti & Izin</span>
        </button>

        {canManagePayroll && (
          <button
            type="button"
            onClick={() => setActiveTab("payroll")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "payroll"
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:border-line hover:text-ink"
            }`}
          >
            <Briefcase size={14} />
            <span>Manajemen Payroll (HR/Finance)</span>
          </button>
        )}
      </div>

      {/* Tab Contents */}
      {activeTab === "attendance" && (
        <AttendancePanel
          todayRecord={todayAttendance}
          records={attendanceRecords}
          canManage={canManagePayroll}
          employeeName={userName}
        />
      )}

      {activeTab === "payslip" && (
        <EmployeePayslipViewer payslips={payslips} userName={userName} />
      )}

      {activeTab === "leave" && (
        <LeaveManagementPanel
          annualQuota={leaveQuota}
          usedDays={leaveUsed}
          requests={leaveRequests}
          canManage={canManagePayroll}
        />
      )}

      {activeTab === "payroll" && canManagePayroll && (
        <PayrollWorkbench
          employees={employees}
          runs={payrollRuns}
          canCreate={canManagePayroll}
          canApprove={canApprovePayroll}
          currentUserId={currentUserId}
          isOwner={isOwner}
        />
      )}
    </div>
  )
}
