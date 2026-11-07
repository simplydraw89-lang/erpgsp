import { requireWorkspace } from "@/lib/auth/context"
import { calendarDate,calendarDay, daysUntil, workspaceTimeZone } from "@/lib/dashboard"
import { isWorkflowMissing, labels, recordSpecs } from "@/lib/workflow"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { ApplicationGrid } from "@/components/dashboard/application-grid"
import { BusinessSummary } from "@/components/dashboard/business-summary"
import { loadBusinessSummary } from "@/lib/business-summary"
import { SphConversionChart } from "@/components/dashboard/sph-conversion-chart"
import { loadSphConversionSummary } from "@/lib/director-dashboard"

export default async function DashboardPage() {
  const { supabase, organizationId, user, role, navigationRoles, relationshipStatus, actorRole, workAssignments } = await requireWorkspace()
  const isExecutive =
    role === "owner" ||
    role === "director" ||
    actorRole === "owner" ||
    actorRole === "director" ||
    workAssignments?.some((j: any) =>
      ["president", "finance_director", "technical_director"].includes(j.job_role)
    )
  if (!navigationRoles.length) return <div className="space-y-6">
    <section className="portal-summary"><h1 className="text-xl font-semibold">Ruang pribadi & proyek Anda</h1>
      <p className="mt-2 text-sm text-slate-600">Hubungan dengan perusahaan: {relationshipStatus === "client" ? "Klien" : relationshipStatus === "vendor" ? "Vendor" : "Konsultan / tenaga ahli"}.</p>
      <p className="mt-2 text-sm text-slate-600">Informasi tersedia sesuai penugasan proyek aktif dan dokumen yang dibagikan perusahaan.</p>
      <Link href="/portal-proyek" className="mt-4 inline-block text-sm font-semibold text-brand">Buka portal proyek →</Link>
    </section><ApplicationGrid role={role} navigationRoles={navigationRoles} />
  </div>
  const businessSummaryPromise = loadBusinessSummary(supabase, organizationId)
  const sphConversionPromise = isExecutive ? loadSphConversionSummary(supabase, organizationId) : Promise.resolve(null)
  const today = calendarDate()
  const canReadTaxes = recordSpecs.tax_record.readers.includes(role)
  const canReadPayments = recordSpecs.payment.readers.includes(role)
  const [processing, rejected, review, nextTax, overdue, unpaidPayments, nextPayment, latePayments] =
    await Promise.all([
      Promise.all([
        supabase.from("workflow_documents").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("created_by", user.id).in("state", ["submitted", "approved"]),
        supabase.from("purchase_requests").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("created_by", user.id).not("status", "in", '("draft","paid","rejected")'),
        supabase.from("sales_documents").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("created_by", user.id).not("status", "in", '("draft","approved","rejected")')
      ]).then(([wf, pr, sd]) => ({ count: (wf.count ?? 0) + (pr.count ?? 0) + (sd.count ?? 0), error: wf.error || pr.error || sd.error })),
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
  const mySummaryError = processing.error || rejected.error
  const taxError = nextTax.error || overdue.error || (tax&&!due)
  const payment = nextPayment.data?.[0]
  const paymentDue = calendarDay(payment?.due_on)
  const paymentDays = paymentDue ? daysUntil(paymentDue, today) : null
  const paymentError = unpaidPayments.error || nextPayment.error || latePayments.error || (payment && !paymentDue)
  const paymentSchemaPending = isWorkflowMissing(unpaidPayments.error)
    || isWorkflowMissing(nextPayment.error)
    || isWorkflowMissing(latePayments.error)
  const rejectedCount = rejected.count ?? 0
  const [businessSummary, sphConversion] = await Promise.all([businessSummaryPromise, sphConversionPromise])
  return (
    <div className="space-y-6">
      {sphConversion && <SphConversionChart summary={sphConversion} />}
      <BusinessSummary summary={businessSummary} />
      <section
        aria-label="Ringkasan pribadi"
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
      >
        <Link href="/pekerjaan-saya/pengajuan" target="_blank" rel="noopener noreferrer" className="portal-summary">
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
              : rejectedCount
                ? `${rejectedCount} pengajuan perlu revisi di Pengajuan saya`
                : "Tidak ada pengajuan yang perlu direvisi"}
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
        ) : null}
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
      <ApplicationGrid role={role} navigationRoles={navigationRoles} />
      <footer className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-400">
        <span>GSP Group · Enterprise Resource Planning</span>
        <span>Workspace pribadi · Aplikasi mengikuti hak akses Anda</span>
      </footer>
    </div>
  )
}
