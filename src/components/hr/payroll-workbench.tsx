import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MoneyInput } from "@/components/ui/money-input"
import { formatCurrency } from "@/lib/money"
import {
  approvePayrollRunAction,
  createPayrollRunAction,
} from "@/app/(workspace)/modul/hr-actions"

export type PayrollRunRow = {
  id: string
  period_month: string
  title: string
  status: string
  total_gross: number | string
  total_deductions: number | string
  total_net: number | string
  created_by: string | null
  created_at: string
}

export type EmployeeOption = {
  id: string
  employee_number: string
  full_name: string
  job_title: string | null
  employment_status: string
}

export function PayrollWorkbench({
  employees,
  runs,
  canCreate,
  canApprove,
  currentUserId,
  isOwner,
}: {
  employees: EmployeeOption[]
  runs: PayrollRunRow[]
  canCreate: boolean
  canApprove: boolean
  currentUserId: string
  isOwner: boolean
}) {
  const activeEmployees = employees.filter((e) => e.employment_status === "active")

  return (
    <Card className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-semibold">Payroll & Penggajian Dasar</h2>
        <p className="text-sm text-muted">
          Susun daftar gaji bulanan karyawan aktif beserta tunjangan, potongan, dan PPh 21, lalu ajukan persetujuan Finance/Direksi.
        </p>
      </div>

      {canCreate && (
        <form action={createPayrollRunAction} className="grid gap-3 rounded-lg border border-border bg-slate-50 p-4 md:grid-cols-4">
          <input
            type="month"
            name="period_month"
            required
            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
          />
          <input
            type="text"
            name="title"
            required
            placeholder="Judul (mis. Payroll Nov 2026)"
            className="h-9 rounded-md border border-border bg-white px-2 text-sm md:col-span-2"
          />
          <select name="employee_id" required className="h-9 rounded-md border border-border bg-white px-2 text-sm">
            <option value="">Pilih Karyawan</option>
            {activeEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.employee_number} · {emp.full_name}
              </option>
            ))}
          </select>
          <MoneyInput name="base_salary" placeholder="Gaji Pokok" required />
          <MoneyInput name="allowances" placeholder="Tunjangan" />
          <MoneyInput name="deductions" placeholder="Potongan / Kasbon" />
          <MoneyInput name="pph21_amount" placeholder="PPh 21" />
          <input
            type="text"
            name="notes"
            placeholder="Catatan slip gaji (opsional)"
            className="h-9 rounded-md border border-border bg-white px-2 text-sm md:col-span-3"
          />
          <Button type="submit" className="h-9">
            Buat Payroll Run
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Periode</th>
              <th className="px-3 py-2">Judul</th>
              <th className="px-3 py-2 text-right">Bruto</th>
              <th className="px-3 py-2 text-right">Potongan + PPh21</th>
              <th className="px-3 py-2 text-right">Total Bersih (THP)</th>
              <th className="px-3 py-2">Status & Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {runs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-xs text-muted">
                  Belum ada daftar payroll yang dibuat.
                </td>
              </tr>
            ) : (
              runs.map((run) => {
                const allowAct = canApprove && (run.created_by !== currentUserId || isOwner)
                return (
                  <tr key={run.id}>
                    <td className="px-3 py-2 font-mono text-xs">{run.period_month}</td>
                    <td className="px-3 py-2 font-medium">{run.title}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(run.total_gross)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-700">
                      {formatCurrency(run.total_deductions)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-700">
                      {formatCurrency(run.total_net)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">
                          {run.status}
                        </span>
                        {allowAct && run.status === "draft" && (
                          <form action={approvePayrollRunAction}>
                            <input type="hidden" name="run_id" value={run.id} />
                            <input type="hidden" name="next_status" value="approved" />
                            <Button type="submit" variant="secondary" className="h-7 px-2 text-xs">
                              Setujui
                            </Button>
                          </form>
                        )}
                        {allowAct && run.status === "approved" && (
                          <form action={approvePayrollRunAction}>
                            <input type="hidden" name="run_id" value={run.id} />
                            <input type="hidden" name="next_status" value="paid" />
                            <Button type="submit" className="h-7 px-2 text-xs">
                              Tandai Dibayar
                            </Button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
