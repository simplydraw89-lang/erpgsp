import { requireWorkspace } from "@/lib/auth/context"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { SalesMenu } from "@/components/sales/sales-menu"
import { ProcurementMessage } from "@/components/procurement/section-nav"
import { BillingWorkspace, type ProjectBillingItem } from "@/components/sales/billing-workspace"

export default async function SalesBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const { error, notice } = await searchParams
  const w = await requireWorkspace()

  // Ambil daftar proyek aktif dengan rincian klien, cabang, dan jurnal akuntansi terkait
  const [projectsRes, invoicesRes, journalsRes] = await Promise.all([
    w.supabase
      .from("crm_projects")
      .select(`
        id,
        code,
        name,
        status,
        approval_status,
        branch_id,
        client_id,
        contract_amount,
        payment_terms,
        business_units:branch_id (id, name, code),
        sales_clients:client_id (id, name)
      `)
      .eq("organization_id", w.organizationId)
      .order("created_at", { ascending: false })
      .limit(200),
    w.supabase
      .from("sales_invoices")
      .select("*")
      .eq("organization_id", w.organizationId)
      .order("created_at", { ascending: false })
      .limit(500),
    w.supabase
      .from("accounting_journals")
      .select("id, journal_number, status, source_id, source_type, journal_date")
      .eq("organization_id", w.organizationId)
      .in("source_type", ["receivable", "payment"])
      .limit(1000),
  ])

  const rawProjects = projectsRes.data ?? []
  const rawInvoices = invoicesRes.data ?? []
  const rawJournals = journalsRes.data ?? []

  // Map ke ProjectBillingItem dengan fallback jika sales_invoices belum ada di database
  const billingProjects: ProjectBillingItem[] = rawProjects.map((p: any) => {
    const branch = Array.isArray(p.business_units) ? p.business_units[0] : p.business_units
    const client = Array.isArray(p.sales_clients) ? p.sales_clients[0] : p.sales_clients
    const terms = Array.isArray(p.payment_terms) ? p.payment_terms : []

    // Ambil invoice dari tabel sales_invoices yang sesuai proyek ini dan hubungkan dengan jurnal akuntansi
    const projectInvoices = rawInvoices
      .filter((inv: any) => inv.project_id === p.id)
      .map((inv: any) => {
        const invJrn = rawJournals.find(
          (j: any) =>
            j.id === inv.invoice_journal_id ||
            (j.source_id === inv.id && j.source_type === "receivable")
        )
        const pmtJrn = rawJournals.find(
          (j: any) =>
            j.id === inv.payment_journal_id ||
            (j.source_id === inv.id && j.source_type === "payment")
        )
        return {
          ...inv,
          invoice_journal_id: invJrn?.id ?? inv.invoice_journal_id,
          invoice_journal_number: invJrn?.journal_number,
          invoice_journal_status: invJrn?.status,
          payment_journal_id: pmtJrn?.id ?? inv.payment_journal_id,
          payment_journal_number: pmtJrn?.journal_number,
          payment_journal_status: pmtJrn?.status,
        }
      })

    // Jika di tabel sales_invoices belum ada tetapi di payment_terms ada status invoiced/paid,
    // buat invoice virtual dari payment_terms agar data termin tetap muncul utuh
    if (projectInvoices.length === 0 && terms.length > 0) {
      for (const t of terms) {
        if (t.status === "invoiced" || t.status === "paid") {
          projectInvoices.push({
            id: t.invoice_id || `term-${t.index}`,
            invoice_number: t.invoice_number || `INV/${p.code}/${t.index}`,
            term_name: t.name || `Termin ${t.index}`,
            term_index: t.index,
            percentage: t.percentage || 0,
            invoice_date: t.invoice_date || new Date().toISOString().slice(0, 10),
            due_date: t.due_date || new Date().toISOString().slice(0, 10),
            amount: t.amount || 0,
            vat_amount: t.vat_amount || Math.round((t.amount || 0) * 0.11),
            wht_amount: t.wht_amount || Math.round((t.amount || 0) * 0.02),
            total_amount: t.total_amount || Math.round((t.amount || 0) * 1.11),
            net_receivable: t.total_amount
              ? t.total_amount - (t.wht_amount || Math.round((t.amount || 0) * 0.02))
              : Math.round((t.amount || 0) * 1.09),
            status: t.status === "paid" ? "paid" : "unpaid",
            paid_amount: t.paid_amount,
            paid_at: t.paid_at,
            receipt_number: t.receipt_number,
          })
        }
      }
    }

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      status: p.status,
      approval_status: p.approval_status,
      branch_name: branch?.name ?? "Pusat",
      branch_code: branch?.code ?? "PUSAT",
      client_name: client?.name ?? "Klien",
      client_id: p.client_id,
      contract_amount: Number(p.contract_amount || 0),
      payment_terms: terms,
      invoices: projectInvoices,
    }
  })

  return (
    <div className="space-y-6">
      <Link href="/pengajuan/penjualan" className="text-sm font-medium text-brand">
        ← Kembali ke Penjualan
      </Link>

      <header>
        <p className="text-sm font-medium text-brand">Penjualan & Keuangan</p>
        <h1 className="mt-2 text-3xl font-bold">Penagihan & Penerimaan Pembayaran (Termin)</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Kelola rencana termin penagihan berdasarkan progres proyek, terbitkan Invoice Penjualan resmi (INV) lengkap
          dengan rincian PPN dan PPh 23, serta catat penerimaan kas/bank dan kuitansi pelunasan (KWT).
        </p>
      </header>

      <SalesMenu active="penagihan" />

      <ProcurementMessage error={error} notice={notice} />

      <BillingWorkspace projects={billingProjects} disabled={w.isReadOnlyPreview} />
    </div>
  )
}
