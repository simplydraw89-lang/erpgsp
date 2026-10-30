import { requireWorkspace } from "@/lib/auth/context"
import { calendarDate,calendarDay, daysUntil, workspaceTimeZone } from "@/lib/dashboard"
import { isWorkflowMissing, labels, recordSpecs } from "@/lib/workflow"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { ApplicationGrid } from "@/components/dashboard/application-grid"

export default async function DashboardPage() {
  const { supabase, organizationId, user, role } = await requireWorkspace()
  const today = calendarDate()
  const canReadTaxes = recordSpecs.tax_record.readers.includes(role)
  const canReadPayments = recordSpecs.payment.readers.includes(role)
  const [processing, drafts, rejected, review, nextTax, overdue, unpaidPayments, nextPayment, latePayments] =
    await Promise.all([
      supabase
        .from("workflow_documents")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("created_by", user.id)
        .in("state", ["submitted", "approved"]),
      supabase
        .from("workflow_documents")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("created_by", user.id)
        .eq("state", "draft"),
      supabase
        .from("workflow_documents")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("created_by", user.id)
        .eq("state", "rejected"),
      supabase
        .from("approval_requests")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("required_role", role)
        .eq("status", "pending")
        .neq("requested_by", user.id),
      canReadTaxes
        ? supabase
            .from("tax_records")
            .select("id,tax_type,tax_period,due_on")
            .eq("organization_id", organizationId)
            .neq("status", "reported")
            .gte("due_on", today)
            .order("due_on")
            .limit(1)
        : Promise.resolve({ data: null, error: null }),
      canReadTaxes
        ? supabase
            .from("tax_records")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .neq("status", "reported")
            .lt("due_on", today)
        : Promise.resolve({ count: 0, error: null }),
      canReadPayments
        ? supabase
            .from("payment_records")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .eq("status", "unpaid")
        : Promise.resolve({ count: 0, error: null }),
      canReadPayments
        ? supabase
            .from("payment_records")
            .select("id,payment_number,payee_name,due_on,amount")
            .eq("organization_id", organizationId)
            .eq("status", "unpaid")
            .order("due_on")
            .limit(1)
        : Promise.resolve({ data: null, error: null }),
      canReadPayments
        ? supabase
            .from("payment_records")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .eq("status", "unpaid")
            .lt("due_on", today)
        : Promise.resolve({ count: 0, error: null }),
    ])
  const tax = nextTax.data?.[0]
  const due=calendarDay(tax?.due_on)
  const days = due ? daysUntil(due, today) : null
  const taxDate = due
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        timeZone: workspaceTimeZone,
      }).format(new Date(`${due}T12:00:00+07:00`))
    : ""
  const mySummaryError = processing.error || drafts.error || rejected.error
  const taxError = nextTax.error || overdue.error || (tax&&!due)
  const payment = nextPayment.data?.[0]
  const paymentDue = calendarDay(payment?.due_on)
  const paymentDays = paymentDue ? daysUntil(paymentDue, today) : null
  const paymentError = unpaidPayments.error || nextPayment.error || latePayments.error || (payment && !paymentDue)
  const paymentSchemaPending = isWorkflowMissing(unpaidPayments.error)
    || isWorkflowMissing(nextPayment.error)
    || isWorkflowMissing(latePayments.error)
  const draftCount = drafts.count ?? 0
  const rejectedCount = rejected.count ?? 0
  return (
    <div className="space-y-6">
      <section
        aria-label="Ringkasan pribadi"
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
      >
        <Link href="/approvals?scope=mine" className="portal-summary">
          <h2 className="text-xs text-slate-500">Pengajuan Anda</h2>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[30px] font-semibold leading-none tracking-tight text-slate-950">
              {mySummaryError ? "—" : (processing.count ?? 0)}
            </span>
            <span className="text-[13px] text-slate-600">sedang diproses</span>
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            {mySummaryError
              ? "Ringkasan belum dapat dimuat. Buka pengajuan untuk memeriksa."
              : draftCount || rejectedCount
                ? `${draftCount} draft belum diajukan · ${rejectedCount} perlu revisi`
                : "Tidak ada draft atau pengajuan yang perlu direvisi"}
          </p>
        </Link>
        {canReadTaxes ? (
          <Link
            href="/modul/perpajakan"
            className="portal-summary portal-summary-deadline"
          >
            <h2 className="text-xs text-slate-500">Tenggat pajak terdekat</h2>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="text-[30px] font-semibold leading-none tracking-tight text-slate-950">
                {taxError || days === null
                  ? "—"
                  : days === 0
                    ? "Hari ini"
                    : days}
              </span>
              {days !== null && days > 0 && !taxError && (
                <span className="text-[13px] text-slate-600">hari lagi</span>
              )}
            </p>
            <p className="mt-1.5 text-xs leading-5 text-[#b77709]">
              {taxError
                ? "Ringkasan tenggat belum dapat dimuat."
                : tax
                  ? `${labels[tax.tax_type] ?? tax.tax_type} · Masa ${tax.tax_period} · ${taxDate}${overdue.count ? ` · ${overdue.count} catatan lewat tenggat` : ""}`
                  : overdue.count
                    ? `${overdue.count} catatan lewat tenggat · Belum ada tenggat berikutnya`
                    : "Belum ada tenggat dari catatan pajak perusahaan"}
            </p>
          </Link>
        ) : (
          <Link
            href="/approvals?scope=review"
            className="portal-summary border-[#c7d8ee]"
          >
            <h2 className="text-xs text-slate-500">Perlu pemeriksaan Anda</h2>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="text-[30px] font-semibold leading-none text-slate-950">
                {review.error ? "—" : (review.count ?? 0)}
              </span>
              <span className="text-[13px] text-slate-600">pengajuan</span>
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              {review.error
                ? "Ringkasan belum dapat dimuat."
                : review.count
                  ? "Buka untuk memeriksa dokumen sesuai kewenangan Anda"
                  : "Belum ada permintaan yang memerlukan pemeriksaan Anda"}
            </p>
          </Link>
        )}
        {canReadPayments && (
          <Link href="/modul/pembayaran" className="portal-summary">
            <h2 className="text-xs text-slate-500">Pembayaran perusahaan</h2>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="text-[30px] font-semibold leading-none tracking-tight text-slate-950">
                {paymentError ? "—" : (unpaidPayments.count ?? 0)}
              </span>
              <span className="text-[13px] text-slate-600">belum lunas</span>
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              {paymentError
                ? paymentSchemaPending
                  ? "Modul menunggu setup database Pembayaran."
                  : "Ringkasan pembayaran belum dapat dimuat."
                : payment
                  ? `${paymentDays !== null && paymentDays < 0 ? "Terlambat" : paymentDays === 0 ? "Jatuh tempo hari ini" : `Jatuh tempo ${paymentDays} hari lagi`} · ${payment.payment_number} · ${payment.payee_name}${latePayments.count ? ` · ${latePayments.count} terlambat` : ""}`
                  : "Tidak ada tagihan pembayaran yang belum lunas"}
            </p>
          </Link>
        )}
      </section>
      <ApplicationGrid role={role} />
      <footer className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-400">
        <span>GSP Group · Enterprise Resource Planning</span>
        <span>Workspace pribadi · Aplikasi mengikuti hak akses Anda</span>
      </footer>
    </div>
  )
}
