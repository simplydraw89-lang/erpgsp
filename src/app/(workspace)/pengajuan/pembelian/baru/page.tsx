import Link from "next/link"
import { requireWorkspace } from "@/lib/auth/context"
import { PurchaseForm } from "@/components/procurement/purchase-form"
import { ProcurementMessage, ProcurementUnavailable } from "@/components/procurement/section-nav"
import { isProcurementMissing, type BusinessUnit, type ProcurementVendor, type ProcurementAccount } from "@/lib/procurement-ui"
import { Card } from "@/components/ui/card"
import { SubmitButton } from "@/components/procurement/submit-button"
import { initializePurchasing } from "../../actions"
import { calendarDate } from "@/lib/dashboard"
export default async function NewPurchasePage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const q = await searchParams
  const { supabase, organizationId, user, actorRole, isReadOnlyPreview, workAssignments } = await requireWorkspace()
  const [units, jobs, vendors, accounts, periods] = await Promise.all([
    supabase.from("business_units").select("id,code,name,kind,entity_id").eq("organization_id", organizationId).in("kind", ["branch", "center"]),
    supabase.from("work_assignments").select("branch_id").eq("organization_id", organizationId).eq("user_id", user.id),
    supabase.from("procurement_vendors").select("*").eq("organization_id", organizationId).eq("status", "approved"),
    supabase.from("finance_accounts").select("id,code,name,account_type,posting_category,is_postable").eq("organization_id", organizationId).eq("is_active", true).eq("is_postable", true).order("code"),
    supabase.from("accounting_periods").select("entity_id").eq("organization_id", organizationId).eq("period_status", "open"),
  ])
  const errors = [units.error, jobs.error, vendors.error, accounts.error, periods.error]
  const missing = errors.some(isProcurementMissing)
  if (!missing && errors.some(Boolean)) {
    console.error("purchase_form_reference_query_failed", errors.map((error,index) => error ? { source:["branches","assignments","vendors","accounts","periods"][index],code:error.code } : null).filter(Boolean))
    throw new Error("Formulir pengajuan gagal dimuat.")
  }
  const central = actorRole === "owner" || (workAssignments ?? []).some(job => !job.branch_id && ["president", "finance_director", "technical_director", "finance", "accounting_tax"].includes(job.job_role))
  const branches = ((units.data ?? []) as BusinessUnit[]).filter(b => central || (workAssignments ?? []).some(j => j.branch_id === b.id))
  const firstRun = !missing && (!accounts.data?.length || units.data?.some(b => !b.entity_id || !periods.data?.some(p => p.entity_id === b.entity_id))) && actorRole === "owner" ? <Card className="space-y-4 border-brand/20 p-5">
    <h2 className="font-semibold">Siapkan data awal pengajuan pembelian</h2>
    <p className="text-sm leading-6 text-muted">Siapkan pemetaan pusat pelaporan, tiga cabang dan satu bulan pembukuan. Rekomendasi COA berjenjang meliputi aset, liabilitas, ekuitas, penghasilan, beban, penghasilan lain dan penghasilan komprehensif lain. Data yang sudah ada tidak ditimpa; tidak membuat saldo awal atau transaksi.</p>
    <form action={initializePurchasing} className="flex flex-wrap items-end gap-3"><label className="text-sm font-medium">Bulan pembukuan<input name="month" type="month" required defaultValue={calendarDate().slice(0,7)} disabled={isReadOnlyPreview} className="mt-1 block rounded-lg border border-line px-3 py-2" /></label><SubmitButton disabled={isReadOnlyPreview}>Siapkan pembukuan pembelian</SubmitButton></form>
  </Card> : null
  return <div className="space-y-6"><Link href="/pengajuan" className="text-sm text-brand">← Daftar pengajuan</Link><header><p className="text-sm text-brand">Pembelian barang / jasa</p><h1 className="mt-2 text-3xl font-bold">Pengajuan pembelian baru</h1><p className="mt-2 text-sm text-muted">Mulai dari invoice, periksa COA dan pajak, lalu kirim melalui persetujuan berjenjang.</p></header><ProcurementMessage error={q.error} notice={q.notice} />{missing ? <ProcurementUnavailable /> : <>{firstRun}{!branches.length && <p role="status" className="rounded-lg bg-amber-50 p-4 text-sm">Belum ada penugasan cabang untuk akun Anda. Hubungi Super Admin untuk penetapan akses.</p>}{!accounts.data?.length && <p role="status" className="rounded-lg bg-amber-50 p-4 text-sm">Bagan akun belum tersedia. Lengkapi COA melalui menu Bagan Akun sebelum mengisi tagihan.</p>}<PurchaseForm branches={branches} vendors={(vendors.data ?? []) as ProcurementVendor[]} accounts={(accounts.data ?? []) as ProcurementAccount[]} disabled={isReadOnlyPreview || !branches.length} /></>}</div>
}
