import { Card } from "@/components/ui/card"
import { LeaveWorkspace, type LeaveBalanceRow, type LeaveRequestRow } from "@/components/hr/leave-workspace"
import { requireWorkspace } from "@/lib/auth/context"
import { isWorkflowMissing } from "@/lib/workflow"

export default async function CutiPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const [query, workspace] = await Promise.all([searchParams, requireWorkspace()])
  const { supabase, organizationId, user, actorRole, role, isReadOnlyPreview, workAssignments } = workspace
  const year = new Date().getFullYear()

  const [balanceRes, requestsRes, branchesRes] = await Promise.all([
    supabase
      .from("leave_balances")
      .select("leave_year,annual_quota,used_days")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("leave_year", year)
      .maybeSingle(),
    supabase
      .from("leave_requests")
      .select("id,user_id,branch_id,leave_type,starts_on,ends_on,total_days,reason,status,review_note,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("business_units")
      .select("id,code,name")
      .eq("organization_id", organizationId)
      .eq("kind", "branch")
      .order("code"),
  ])

  const unavailable = isWorkflowMissing(balanceRes.error) || isWorkflowMissing(requestsRes.error)

  const canReview =
    actorRole === "owner" ||
    ["director", "hr"].includes(role) ||
    (workAssignments ?? []).some((job) => ["hr", "branch_manager"].includes(job.job_role))

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-brand">Pengajuan</p>
        <h1 className="mt-2 text-3xl font-bold">Cuti Karyawan</h1>
        <p className="mt-1 text-sm text-muted">
          Ajukan cuti tahunan, sakit, atau izin, pantau saldo cuti, dan kelola persetujuan atasan/SDM.
        </p>
      </header>

      {query.error && (
        <Card role="alert" className="border-red-300 bg-red-50 p-4 text-sm text-red-900">
          {query.error}
        </Card>
      )}
      {query.notice && (
        <Card role="status" className="border-green-300 bg-green-50 p-4 text-sm text-green-900">
          {query.notice}
        </Card>
      )}

      {unavailable ? (
        <Card className="border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          Tabel modul cuti belum diterapkan di database aktif. Jalankan migration{" "}
          <code>20261112000100_accounting_tax_hr_project_enhancements.sql</code> untuk mengaktifkan fitur ini.
        </Card>
      ) : (
        <LeaveWorkspace
          currentUserId={user.id}
          canReview={canReview}
          isOwner={actorRole === "owner"}
          isReadOnly={isReadOnlyPreview}
          balance={(balanceRes.data as LeaveBalanceRow | null) ?? null}
          branches={(branchesRes.data ?? []) as Array<{ id: string; code: string; name: string }>}
          requests={(requestsRes.data ?? []) as LeaveRequestRow[]}
        />
      )}
    </div>
  )
}
