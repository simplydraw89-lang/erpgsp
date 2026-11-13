import { MoneyInput } from "@/components/ui/money-input"
import { notFound, redirect } from "next/navigation"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RecordForm } from "@/components/workflow/record-form"
import { MigrationNotice } from "@/components/workflow/migration-notice"
import { ModuleFilters } from "@/components/workflow/module-filters"
import { AccountingWorkbench } from "@/components/accounting/accounting-workbench"
import { ChartOfAccounts } from "@/components/accounting/chart-of-accounts"
import { FinancialReportsView } from "@/components/accounting/financial-reports-view"
import {
  BankStatementReconciler,
  type BankStatementLineRow,
} from "@/components/accounting/bank-statement-reconciler"
import {
  TaxRecapView,
  type FiscalAdjustmentRow,
  type PurchaseTaxRow,
  type SalesTaxRow,
} from "@/components/accounting/tax-recap-view"
import {
  buildFinancialStatements,
  type CoaMetaRow,
  type TrialBalanceRow,
} from "@/lib/accounting/financial-reports"
import {
  PayrollWorkbench,
  type EmployeeOption,
  type PayrollRunRow,
} from "@/components/hr/payroll-workbench"
import {
  AssetDepreciationPanel,
  type AssetDepreciationRow,
} from "@/components/asset/asset-depreciation-panel"
import type { CoaAccount } from "@/lib/accounting/coa"
import {
  reviewCashAdvanceSettlement,
  submitCashAdvanceSettlement,
} from "@/app/(workspace)/modul/accounting-actions"
import { requireWorkspace } from "@/lib/auth/context"
import { getModule } from "@/lib/modules"
import {
  recordSpecs,
  isRecordType,
  isWorkflowMissing,
  displayValue,
  labels,
  type RecordType,
  type WorkflowDocument,
} from "@/lib/workflow"
import { loadReferences } from "@/lib/workflow-server"
import { calendarDate } from "@/lib/dashboard"
import { BusinessSummary } from "@/components/dashboard/business-summary"
import { loadBusinessSummary } from "@/lib/business-summary"

type Row = Record<string, unknown> & { id: string; row_version?: number }

function validDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : undefined
}

export default async function ModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>
  searchParams: Promise<{
    type?: string
    edit?: string
    q?: string
    field?: string
    dateField?: string
    from?: string
    to?: string
    status?: string
    error?: string
    notice?: string
  }>
}) {
  const [{ module: key }, query, workspace] = await Promise.all([
    params,
    searchParams,
    requireWorkspace(),
  ])
  const definition = getModule(key)
  if (!definition) notFound()
  const { supabase, organizationId, role } = workspace
  const Icon = definition.icon
  if (key === "struktur-perusahaan") redirect("/struktur-akses")
  if (
    workspace.actorRole !== "owner" &&
    !["akuntansi", "keuangan", "manajemen", "perpajakan", "sdm", "asset"].includes(key)
  ) {
    return <Card className="space-y-3 p-6"><h1 className="text-xl font-semibold">{definition.name}</h1>
      <p className="text-sm leading-6 text-muted">Data modul sebelumnya belum dipetakan ke cabang. Akses pengguna perusahaan dibuka setelah data dan alur modul ini memiliki cakupan yang sesuai.</p>
      <Link href="/pengajuan" className="inline-block text-sm font-semibold text-brand">Buka pengajuan bisnis per cabang →</Link>
    </Card>
  }
  if (key === "keuangan") {
    const [accounts, permission] = await Promise.all([
      supabase.from("finance_accounts").select("id,code,name,account_type,normal_balance,parent_account_id,is_postable,is_active,report_section,posting_category,row_version").eq("organization_id", organizationId).order("code"),
      supabase.rpc("has_business_job", { p_org: organizationId, p_branch: null, p_roles: ["accounting_tax", "finance"] }),
    ])
    if (accounts.error || permission.error) throw new Error("Bagan akun gagal dimuat.")
    return <div className="space-y-5">{query.error && <Card role="alert" className="bg-red-50 p-4 text-sm">{query.error}</Card>}{query.notice && <Card role="status" className="bg-green-50 p-4 text-sm">{query.notice}</Card>}<ChartOfAccounts accounts={(accounts.data ?? []) as CoaAccount[]} editable={Boolean(permission.data) && !workspace.isReadOnlyPreview} editId={query.edit} /></div>
  }
  if (key === "akuntansi") {
    const [entityResult, periodResult, accountResult, journalResult, ledgerResult, receivableResult, payableResult, employeeAdvanceResult, bankResult, trialBalanceResult, journalHeadersResult, reconciliationsResult, membersResult, bankStatementLinesResult] = await Promise.all([
      supabase.from("company_entities").select("id,entity_code,legal_name,entity_type,parent_entity_id,functional_currency,is_reporting_parent,is_active").eq("organization_id", organizationId).order("entity_code"),
      supabase.from("accounting_periods").select("id,entity_id,period_code,starts_on,ends_on,period_status").eq("organization_id", organizationId).order("starts_on", { ascending: false }).limit(36),
      supabase.from("finance_accounts").select("id,code,account_code,name,account_type,normal_balance,is_active,parent_account_id,is_postable").eq("organization_id", organizationId).order("code"),
      supabase.from("general_journal").select("journal_id,entity_code,period_code,journal_number,journal_date,source_type,description,status,line_number,account_code,account_name,debit,credit").eq("organization_id", organizationId).order("journal_date", { ascending: false }).limit(1000),
      supabase.from("general_ledger_summary").select("entity_id,period_id,account_code,account_name,debit_total,credit_total,net_debit_balance").eq("organization_id", organizationId).limit(500),
      supabase.from("subledger_receivables_summary").select("entity_id,account_code,account_name,counterparty_id,debit_total,credit_total,balance").eq("organization_id", organizationId).limit(500),
      supabase.from("subledger_payables_summary").select("entity_id,account_code,account_name,counterparty_id,debit_total,credit_total,balance").eq("organization_id", organizationId).limit(500),
      supabase.from("employee_advances_summary").select("entity_id,account_code,account_name,counterparty_id,debit_total,credit_total,outstanding_balance").eq("organization_id", organizationId).limit(500),
      supabase.from("bank_ledger_summary").select("entity_id,account_code,account_name,currency,debit_total,credit_total,bank_balance").eq("organization_id", organizationId).limit(500),
      supabase.from("trial_balance").select("entity_id,period_id,account_code,account_name,debit_total,credit_total,net_debit_balance").eq("organization_id", organizationId).limit(500),
      supabase.from("accounting_journals").select("id,entity_id,period_id,journal_number,journal_date,description,status,reversal_of").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
      supabase.from("bank_reconciliations").select("id,account_id,statement_date,statement_balance,book_balance,difference,status,note").eq("organization_id", organizationId).order("statement_date", { ascending: false }).limit(100),
      supabase.from("organization_members").select("user_id,role").eq("organization_id", organizationId).neq("role", "owner").order("role"),
      supabase.from("bank_statement_lines").select("id,entity_id,account_id,statement_date,reference_no,description,debit,credit,match_status,matched_journal_id").eq("organization_id", organizationId).order("statement_date", { ascending: false }).limit(100),
    ])
    const reportErrors = [entityResult.error, periodResult.error, accountResult.error, journalResult.error, ledgerResult.error, receivableResult.error, payableResult.error, employeeAdvanceResult.error, bankResult.error, trialBalanceResult.error, journalHeadersResult.error, reconciliationsResult.error, membersResult.error]
    const reportUnavailable = reportErrors.some(isWorkflowMissing)
    if (reportErrors.some((error) => error && !isWorkflowMissing(error))) throw new Error("Laporan akuntansi gagal dimuat.")
    const statementLines = (bankStatementLinesResult.error ? [] : (bankStatementLinesResult.data ?? [])) as BankStatementLineRow[]
    const entities = entityResult.data ?? []
    const formatMoney = (value: number | string | null | undefined) => displayValue(value ?? 0, { name: "amount", label: "Saldo", type: "money" })
    const entityName = (entityId: string) => entities.find((entity) => entity.id === entityId)?.entity_code ?? entityId.slice(0, 8)
    if (!reportUnavailable && !["owner", "director", "finance", "auditor"].includes(role)) return <Card className="p-6">Anda tidak memiliki akses laporan akuntansi.</Card>
    return (
      <div className="space-y-6">
        <div><Icon className="mb-3 text-brand" size={30} /><h1 className="text-3xl font-bold">Akuntansi & Buku Besar</h1><Link href="/modul/keuangan" className="mt-2 inline-block text-sm font-semibold text-brand">Kelola bagan akun (COA)</Link><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Administrasi entitas, periode, jurnal double-entry, dan rekonsiliasi saldo kas/bank.</p></div>
        {query.error && <Card role="alert" className="border-red-300 bg-red-50 p-4 text-sm text-red-900">{query.error}</Card>}
        {query.notice && <Card role="status" className="border-green-300 bg-green-50 p-4 text-sm text-green-900">{query.notice}</Card>}
        {reportUnavailable && <MigrationNotice />}
        <Card className="border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950"><strong>Fondasi laporan.</strong> Neraca saldo dan buku besar tersedia setelah jurnal mulai diposting. Penyajian laporan posisi keuangan dan laba rugi sesuai PSAK/ISAK memerlukan pemetaan akun, kebijakan akuntansi, dan periode pelaporan yang disetujui perusahaan; laporan formal belum dihitung dari register transaksi lama.</Card>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[{label:"Entitas/cabang",value:entities.length},{label:"Periode akuntansi",value:periodResult.data?.length ?? 0},{label:"Akun aktif",value:accountResult.data?.filter((row)=>row.is_active).length ?? 0},{label:"Baris jurnal terbaru",value:journalResult.data?.length ?? 0}].map((item)=><Card key={item.label} className="p-5"><p className="text-sm text-muted">{item.label}</p><p className="mt-2 text-2xl font-bold">{reportUnavailable?"—":item.value}</p></Card>)}
        </section>
        {!reportUnavailable && <>
          {workspace.actorRole === "owner" && <AccountingWorkbench
            role={role}
            entities={entities}
            periods={periodResult.data ?? []}
            accounts={accountResult.data ?? []}
            journals={journalHeadersResult.data ?? []}
            journalLines={journalResult.data ?? []}
            reconciliations={reconciliationsResult.data ?? []}
            members={membersResult.data ?? []}
          />}
          <FinancialReportsView
            entities={entities}
            periods={periodResult.data ?? []}
            accounts={accountResult.data ?? []}
            trialBalance={trialBalanceResult.data ?? []}
          />
          <BankStatementReconciler
            entities={entities}
            accounts={accountResult.data ?? []}
            journals={journalHeadersResult.data ?? []}
            lines={statementLines}
            canEdit={["owner", "finance"].includes(role) && !workspace.isReadOnlyPreview}
          />
          <section className="grid gap-4 xl:grid-cols-2"><Card className="overflow-hidden"><div className="border-b border-line p-5"><h2 className="font-semibold">Buku Besar Ringkasan</h2><p className="mt-1 text-xs text-muted">Saldo per akun dari jurnal posted.</p></div><div className="max-h-[420px] overflow-auto">{ledgerResult.data?.length ? <table className="w-full text-left text-xs"><thead className="sticky top-0 bg-canvas"><tr><th className="p-3">Entitas</th><th className="p-3">Akun</th><th className="p-3 text-right">Debit bersih</th></tr></thead><tbody>{ledgerResult.data.map((row,index)=><tr key={`${row.entity_id}-${row.period_id}-${row.account_code}-${index}`} className="border-t border-line"><td className="p-3">{entityName(row.entity_id)}</td><td className="p-3">{row.account_code} · {row.account_name}</td><td className="p-3 text-right">{formatMoney(row.net_debit_balance)}</td></tr>)}</tbody></table>:<p className="p-6 text-sm text-muted">Belum ada jurnal yang diposting.</p>}</div></Card><Card className="overflow-hidden"><div className="border-b border-line p-5"><h2 className="font-semibold">Neraca Saldo</h2><p className="mt-1 text-xs text-muted">Debit/kredit per akun dan periode.</p></div><div className="max-h-[420px] overflow-auto">{trialBalanceResult.data?.length ? <table className="w-full text-left text-xs"><thead className="sticky top-0 bg-canvas"><tr><th className="p-3">Entitas / akun</th><th className="p-3 text-right">Debit</th><th className="p-3 text-right">Kredit</th></tr></thead><tbody>{trialBalanceResult.data.map((row,index)=><tr key={`${row.entity_id}-${row.period_id}-${row.account_code}-${index}`} className="border-t border-line"><td className="p-3">{entityName(row.entity_id)} · {row.account_code} · {row.account_name}</td><td className="p-3 text-right">{formatMoney(Math.max(Number(row.net_debit_balance),0))}</td><td className="p-3 text-right">{formatMoney(Math.max(-Number(row.net_debit_balance),0))}</td></tr>)}</tbody></table>:<p className="p-6 text-sm text-muted">Neraca saldo muncul setelah jurnal posted tersedia.</p>}</div></Card></section>
          <section className="grid gap-4 xl:grid-cols-2">
            {[{title:"Buku Pembantu Piutang · Ringkasan",rows:(receivableResult.data ?? []).map((row)=>({entity_id:row.entity_id,account_code:row.account_code,account_name:row.account_name,counterparty_id:row.counterparty_id,currency:null,amount:row.balance}))},{title:"Buku Pembantu Utang · Ringkasan",rows:(payableResult.data ?? []).map((row)=>({entity_id:row.entity_id,account_code:row.account_code,account_name:row.account_name,counterparty_id:row.counterparty_id,currency:null,amount:row.balance}))},{title:"Piutang karyawan / Kasbon",rows:(employeeAdvanceResult.data ?? []).map((row)=>({entity_id:row.entity_id,account_code:row.account_code,account_name:row.account_name,counterparty_id:row.counterparty_id,currency:null,amount:row.outstanding_balance}))},{title:"Buku Bank",rows:(bankResult.data ?? []).map((row)=>({entity_id:row.entity_id,account_code:row.account_code,account_name:row.account_name,counterparty_id:null,currency:row.currency,amount:row.bank_balance}))}].map((section)=><Card key={section.title} className="overflow-hidden"><div className="border-b border-line p-5"><h2 className="font-semibold">{section.title}</h2><p className="mt-1 text-xs text-muted">Saldo berdasarkan akun dan pihak transaksi pada jurnal.</p></div>{section.rows.length?<div className="divide-y divide-line">{section.rows.slice(0,30).map((row,index)=><div key={`${row.entity_id}-${row.account_code}-${row.counterparty_id ?? ""}-${index}`} className="flex justify-between gap-3 p-4 text-xs"><span>{entityName(row.entity_id)} · {row.account_code} · {row.account_name}{row.currency?` · ${row.currency}`:""}{row.counterparty_id?` · ${String(row.counterparty_id).slice(0,8)}`:""}</span><strong>{formatMoney(row.amount)}</strong></div>)}</div>:<p className="p-5 text-sm text-muted">Belum ada transaksi jurnal untuk laporan ini.</p>}</Card>)}
          </section>
          <Card className="overflow-hidden"><div className="border-b border-line p-5"><h2 className="font-semibold">Jurnal Umum & Buku Besar Rincian</h2><p className="mt-1 text-xs text-muted">100 baris terbaru. Buku besar lengkap tersedia pada view general_ledger_detail.</p></div><div className="max-h-[560px] overflow-auto">{journalResult.data?.length?<table className="w-full min-w-[920px] text-left text-xs"><thead className="sticky top-0 bg-canvas"><tr>{["Tanggal","Entitas","Nomor jurnal","Akun","Uraian","Debit","Kredit","Status"].map((title)=><th key={title} className="p-3">{title}</th>)}</tr></thead><tbody>{journalResult.data.map((row,index)=><tr key={`${row.journal_number}-${row.line_number}-${index}`} className="border-t border-line"><td className="p-3">{row.journal_date}</td><td className="p-3">{row.entity_code}</td><td className="p-3">{row.journal_number}</td><td className="p-3">{row.account_code} · {row.account_name}</td><td className="p-3">{row.description}</td><td className="p-3 text-right">{formatMoney(row.debit)}</td><td className="p-3 text-right">{formatMoney(row.credit)}</td><td className="p-3">{labels[row.status] ?? row.status}</td></tr>)}</tbody></table>:<p className="p-6 text-sm text-muted">Jurnal umum menunggu jurnal pertama diposting.</p>}</div></Card>
          <Card className="p-5"><h2 className="font-semibold">Laporan dan kontrol audit yang perlu dilengkapi</h2><ul className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2">{["Laporan posisi keuangan (Neraca) dan laba rugi dengan pemetaan PSAK/ISAK","Arus kas langsung/tidak langsung dan perubahan ekuitas","Gabungan laporan tiga cabang dalam satu badan usaha dan satu pelaporan pajak","Rekonsiliasi bank, aging piutang/utang, kartu aset dan penyusutan","Buku pajak, rekonsiliasi fiskal, e-Faktur/e-Bupot, dan kalender kewajiban","Audit trail dokumen sumber, bukti lampiran, siapa/apa/kapan, serta ekspor bukti","Tutup buku, jurnal penyesuaian, accrual, deferred tax, dan jurnal pembalik","Anggaran, pusat biaya, proyek, persediaan, dan margin per cabang"].map((item)=><li key={item}>• {item}</li>)}</ul></Card>
        </>}
      </div>
    )
  }
  if (key === "manajemen") {
    if (!["owner", "director"].includes(role))
      return (
        <Card className="p-6">
          Anda tidak memiliki akses laporan manajemen.
        </Card>
      )
    const businessSummary = await loadBusinessSummary(supabase, organizationId)
    if (workspace.actorRole !== "owner") return <div className="space-y-6"><h1 className="text-3xl font-bold">Manajemen & Laporan</h1><BusinessSummary summary={businessSummary} /><p className="text-sm text-muted">Laporan modul berikutnya akan ditambahkan setelah data lama dipetakan ke cabang.</p></div>
    const metrics = await Promise.all(
      Object.entries(recordSpecs).map(async ([type, spec]) => {
        const { count, error } = await supabase
          .from(spec.table)
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
        if (error && !isWorkflowMissing(error))
          throw new Error("Ringkasan gagal dimuat.")
        return { type, label: spec.label, count: count ?? 0, missing: !!error }
      }),
    )
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Manajemen & Laporan</h1>
        <BusinessSummary summary={businessSummary} />
        <p className="text-sm text-muted">
          Jumlah record resmi yang sudah dicatat. Draft dan pengajuan belum
          dieksekusi tidak dihitung.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {metrics.map((metric) => (
            <Card key={metric.type} className="p-5">
              <p className="text-sm text-muted">{metric.label}</p>
              <p className="mt-3 text-3xl font-bold">
                {metric.missing ? "Belum aktif" : metric.count}
              </p>
            </Card>
          ))}
        </div>
      </div>
    )
  }
  const types = (Object.keys(recordSpecs) as RecordType[]).filter(
    (type) => recordSpecs[type].module === key,
  )
  const readable = types.filter((type) =>
    recordSpecs[type].readers.includes(role),
  )
  if (!readable.length)
    return <Card className="p-6">Anda tidak memiliki akses ke modul ini.</Card>
  const selected =
    query.type && isRecordType(query.type) && readable.includes(query.type)
      ? query.type
      : readable[0]
  const spec = recordSpecs[selected]
  const isPaymentModule = key === "pembayaran" && selected === "payment"
  const isFinanceModule = key === "keuangan" && selected === "account"
  const isHrModule = key === "sdm" && selected === "employee"
  const today = calendarDate()
  const monthStart = `${today.slice(0, 7)}-01`
  let liveQuery = supabase
    .from(spec.table)
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100)
  const searchableFields = spec.fields.filter((field) =>
    [
      "code",
      "employee_number",
      "reference_number",
      "serial_number",
      "phone",
      "email",
      "payee_name",
      "payment_number",
      "tax_period",
      "title",
      "name",
      "full_name",
    ].includes(field.name),
  )
  const dateFields = spec.fields.filter((field) => field.type === "date")
  const searchField = searchableFields.some((field) => field.name === query.field)
    ? query.field!
    : searchableFields[0]?.name
  const dateField = dateFields.some((field) => field.name === query.dateField)
    ? query.dateField!
    : dateFields[0]?.name
  if (query.q && searchField)
    liveQuery = liveQuery.ilike(searchField, `%${query.q.slice(0, 100)}%`)
  const configuredStatusField = spec.fields.find(
    (field) => field.name === "status" || field.name === "employment_status",
  ) ?? (selected === "advance"
    ? { name: "advance_status", label: "Status kasbon", type: "select" as const, options: ["approved", "disbursed", "settled"] }
    : spec.fields.some((field) => field.name === "is_active")
    ? { name: "is_active", label: "Status akun", type: "select" as const, options: ["true", "false"] }
    : undefined)
  const statusField = selected === "payment" && configuredStatusField
    ? { ...configuredStatusField, options: [...(configuredStatusField.options ?? []), "overdue"] }
    : configuredStatusField
  if (selected === "payment" && query.status === "overdue")
    liveQuery = liveQuery.eq("status", "unpaid").lt("due_on", today)
  else if (configuredStatusField?.options?.includes(query.status ?? ""))
    liveQuery = liveQuery.eq(configuredStatusField.name, query.status!)
  const fromDate = validDate(query.from)
  const toDate = validDate(query.to)
  if (dateField && fromDate) liveQuery = liveQuery.gte(dateField, fromDate)
  if (dateField && toDate) liveQuery = liveQuery.lte(dateField, toDate)
  const loadPaymentAmounts = async (
    status: "unpaid" | "paid",
    dueBefore?: string,
    paidFrom?: string,
  ) => {
    const rows: { amount: number | string }[] = []
    for (let from = 0; ; from += 1000) {
      let amountQuery = supabase
        .from("payment_records")
        .select("amount")
        .eq("organization_id", organizationId)
        .eq("status", status)
      if (dueBefore) amountQuery = amountQuery.lt("due_on", dueBefore)
      if (paidFrom) amountQuery = amountQuery.gte("paid_on", paidFrom).lte("paid_on", today)
      const { data, error } = await amountQuery.range(from, from + 999)
      if (error) return { rows: [] as { amount: number | string }[], error }
      rows.push(...(data ?? []))
      if ((data?.length ?? 0) < 1000) return { rows, error: null }
    }
  }
  const [recordsResult, documentsResult, references, paymentSummary, accountSummary, employeeSummary, settlementsResult] = await Promise.all([
    liveQuery,
    supabase
      .from("workflow_documents")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("module_key", key)
      .order("created_at", { ascending: false })
      .limit(100),
    loadReferences(supabase, organizationId, selected),
    isPaymentModule
      ? Promise.all([
          supabase
            .from("payment_records")
            .select("amount", { count: "exact" })
            .eq("organization_id", organizationId)
            .eq("status", "unpaid"),
          supabase
            .from("payment_records")
            .select("amount", { count: "exact" })
            .eq("organization_id", organizationId)
            .eq("status", "unpaid")
            .lt("due_on", today),
          supabase
            .from("payment_records")
            .select("id,payment_number,payee_name,amount,status,paid_on,due_on,created_at")
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false })
            .limit(5),
        ])
      : Promise.resolve(null),
    isFinanceModule
      ? Promise.all([
          supabase
            .from("finance_accounts")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .eq("is_active", true),
          loadPaymentAmounts("unpaid"),
          loadPaymentAmounts("unpaid", today),
          loadPaymentAmounts("paid", undefined, monthStart),
          supabase
            .from("payment_records")
            .select("id,payment_number,payee_name,amount,paid_on")
            .eq("organization_id", organizationId)
            .eq("status", "paid")
            .gte("paid_on", monthStart)
            .lte("paid_on", today)
            .order("paid_on", { ascending: false })
            .limit(5),
        ])
      : Promise.resolve(null),
    isHrModule
      ? Promise.all([
          supabase
            .from("hr_employees")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId),
          supabase
            .from("hr_employees")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .eq("employment_status", "active"),
          supabase
            .from("hr_employees")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .eq("employment_status", "on_leave"),
          supabase
            .from("hr_employees")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .eq("employment_status", "resigned"),
        ])
      : Promise.resolve(null),
    selected === "advance"
        ? supabase
            .from("cash_advance_settlements")
            .select("id,advance_id,expense_total,cash_returned,additional_due,additional_due_on,expense_note,receipt_references,state,submitted_by,review_note")
            .eq("organization_id", organizationId)
            .order("submitted_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
  ])
  for (const result of [recordsResult, documentsResult, settlementsResult])
    if (result.error && !isWorkflowMissing(result.error))
        throw new Error(`Data modul gagal dimuat: ${result.error.message}`)
  const migrationPending = !!recordsResult.error || !!documentsResult.error || !!settlementsResult.error
  const summaryError = paymentSummary?.some(({ error }) => error)
  if (summaryError && paymentSummary?.some(({ error }) => error && !isWorkflowMissing(error)))
    throw new Error("Ringkasan pembayaran gagal dimuat.")
  const unpaidRows = paymentSummary?.[0].data ?? []
  const overdueRows = paymentSummary?.[1].data ?? []
  const latestPayments = paymentSummary?.[2].data ?? []
  const sumAmount = (rows: { amount: number | string }[]) =>
    rows.reduce((sum, row) => sum + Number(row.amount), 0)
  const financeSummaryError = accountSummary?.some(
    (item) => "error" in item && Boolean(item.error),
  )
  const financeSummaryMissing = accountSummary?.some(
    (item) => "error" in item && isWorkflowMissing(item.error),
  )
  if (financeSummaryError && !financeSummaryMissing)
    throw new Error("Ringkasan keuangan gagal dimuat.")
  const financeAccountCount = accountSummary?.[0].count ?? 0
  const financeUnpaid = accountSummary?.[1].rows ?? []
  const financeOverdue = accountSummary?.[2].rows ?? []
  const financePaidThisMonth = accountSummary?.[3].rows ?? []
  const financeRecentPayments = accountSummary?.[4].data ?? []
  const employeeSummaryError = employeeSummary?.some(({ error }) => error)
  const employeeSummaryMissing = employeeSummary?.some(
    ({ error }) => error && isWorkflowMissing(error),
  )
  if (employeeSummaryError && !employeeSummaryMissing)
    throw new Error("Ringkasan data karyawan gagal dimuat.")
  const records = (recordsResult.data ?? []) as Row[]
  const documents = (documentsResult.data ?? []) as WorkflowDocument[]
  const settlements = settlementsResult.data ?? []
  const settlementByAdvance = new Map(
    settlements.map((settlement) => [settlement.advance_id, settlement]),
  )
  const canWrite = spec.writers.includes(role)
  let editing: Row | null = null
  if (query.edit && canWrite && !migrationPending) {
    const { data, error } = await supabase
      .from(spec.table)
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", query.edit)
      .maybeSingle()
    if (error || !data) notFound()
    editing = data as Row
  }
  const lockedPaidPayment = selected === "payment" && editing?.status === "paid"
  return (
    <div className="space-y-7">
    {query.error && <Card role="alert" className="border-red-300 bg-red-50 p-4 text-sm text-red-900">{query.error}</Card>}
    {query.notice && <Card role="status" className="border-green-300 bg-green-50 p-4 text-sm text-green-900">{query.notice}</Card>}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Icon className="mb-3 text-brand" size={30} />
          <h1 className="text-3xl font-bold">{definition.name}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {definition.description}
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/approvals">Pusat persetujuan</Link>
        </Button>
      </div>
      <Card className="border-brand/20 bg-brand-light/40 p-4 text-sm leading-6">
        Draft → Diajukan → Disetujui / Ditolak → Dieksekusi. Data resmi berubah
        setelah eksekusi. Dokumen yang diajukan terkunci; versi yang ditolak
        dapat direvisi dan diajukan ulang.
      </Card>
      {migrationPending && <MigrationNotice />}
      {isFinanceModule && financeSummaryMissing && <MigrationNotice />}
      {isHrModule && employeeSummaryMissing && <MigrationNotice />}
      {isPaymentModule && !summaryError && (
        <section aria-label="Ringkasan pembayaran" className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm text-muted">Total belum lunas</p>
            <p className="mt-2 text-2xl font-bold">{displayValue(sumAmount(unpaidRows), { name: "amount", label: "Jumlah", type: "money" })}</p>
            <p className="mt-1 text-xs text-muted">{unpaidRows.length} tagihan</p>
          </Card>
          <Card className="border-amber-200 p-5">
            <p className="text-sm text-muted">Jatuh tempo / terlambat</p>
            <p className="mt-2 text-2xl font-bold">{displayValue(sumAmount(overdueRows), { name: "amount", label: "Jumlah", type: "money" })}</p>
            <p className="mt-1 text-xs text-muted">{overdueRows.length} tagihan lewat tanggal jatuh tempo</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted">Pembayaran terbaru</p>
            {latestPayments.length ? (
              <ul className="mt-3 space-y-2">
                {latestPayments.slice(0, 3).map((payment) => (
                  <li key={payment.id} className="flex justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate">{payment.payment_number} · {payment.payee_name}</span>
                    <span className="shrink-0 font-medium">{displayValue(payment.amount, { name: "amount", label: "Jumlah", type: "money" })}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">Belum ada pembayaran tercatat.</p>
            )}
          </Card>
        </section>
      )}
      {isFinanceModule && !financeSummaryError && (
        <section aria-label="Ringkasan keuangan" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="p-5">
              <p className="text-sm text-muted">Akun keuangan aktif</p>
              <p className="mt-2 text-2xl font-bold">{financeAccountCount}</p>
              <p className="mt-1 text-xs text-muted">Bagan akun perusahaan</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted">Tagihan belum lunas</p>
              <p className="mt-2 text-xl font-bold">{displayValue(sumAmount(financeUnpaid), { name: "amount", label: "Jumlah", type: "money" })}</p>
              <p className="mt-1 text-xs text-muted">{financeUnpaid.length} tagihan aktif</p>
            </Card>
            <Card className="border-amber-200 p-5">
              <p className="text-sm text-muted">Tagihan terlambat</p>
              <p className="mt-2 text-xl font-bold">{displayValue(sumAmount(financeOverdue), { name: "amount", label: "Jumlah", type: "money" })}</p>
              <p className="mt-1 text-xs text-muted">{financeOverdue.length} melewati tanggal jatuh tempo</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted">Dibayar bulan ini</p>
              <p className="mt-2 text-xl font-bold">{displayValue(sumAmount(financePaidThisMonth), { name: "amount", label: "Jumlah", type: "money" })}</p>
              <p className="mt-1 text-xs text-muted">{financePaidThisMonth.length} pembayaran sejak {monthStart}</p>
            </Card>
          </div>
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Pembayaran terbaru bulan ini</h2>
                <p className="mt-1 text-xs text-muted">Pengeluaran yang sudah disetujui dan dicatat lunas.</p>
              </div>
              <Link href="/modul/pembayaran" className="text-sm font-semibold text-brand">Buka pembayaran →</Link>
            </div>
            {financeRecentPayments.length ? (
              <ul className="mt-4 divide-y divide-line">
                {financeRecentPayments.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                    <span>{payment.payment_number} · {payment.payee_name}</span>
                    <span className="font-medium">{displayValue(payment.amount, { name: "amount", label: "Jumlah", type: "money" })}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted">Belum ada pembayaran tercatat lunas bulan ini.</p>
            )}
          </Card>
          <p className="text-xs text-muted">Saldo kas, laba-rugi, dan neraca belum ditampilkan karena modul jurnal dan buku besar belum tersedia.</p>
        </section>
      )}
      {isHrModule && !employeeSummaryError && employeeSummary && (
        <section aria-label="Ringkasan karyawan" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total karyawan", count: employeeSummary[0].count ?? 0, detail: "Profil tercatat di perusahaan" },
            { label: "Aktif", count: employeeSummary[1].count ?? 0, detail: "Sedang bekerja" },
            { label: "Cuti", count: employeeSummary[2].count ?? 0, detail: "Status cuti tercatat" },
            { label: "Tidak aktif", count: employeeSummary[3].count ?? 0, detail: "Karyawan yang sudah keluar" },
          ].map((metric) => (
            <Card key={metric.label} className="p-5">
              <p className="text-sm text-muted">{metric.label}</p>
              <p className="mt-2 text-2xl font-bold">{metric.count}</p>
              <p className="mt-1 text-xs text-muted">{metric.detail}</p>
            </Card>
          ))}
        </section>
      )}
      {types.length > 1 && (
        <nav className="flex gap-3">
          {readable.map((type) => (
            <Link
              key={type}
              href={`/modul/${key}?type=${type}`}
              className={`rounded-lg border px-4 py-2 text-sm ${selected === type ? "border-brand bg-brand-light text-brand" : "border-line"}`}
            >
              {recordSpecs[type].label}
            </Link>
          ))}
        </nav>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[250px_minmax(0,1fr)]">
        <ModuleFilters
          key={`${selected}-${JSON.stringify(query)}`}
          type={selected}
          searchableFields={searchableFields.map(({ name, label }) => ({ name, label }))}
          dateFields={dateFields.map(({ name, label }) => ({ name, label }))}
          statusField={statusField}
          asset={key === "asset"}
        />
        <div className="grid min-w-0 items-start gap-6 2xl:grid-cols-[0.85fr_1.5fr]">
        {canWrite && !migrationPending && !lockedPaidPayment ? (
          <Card className="p-5">
            <h2 className="mb-4 text-lg font-semibold">
              {editing
                ? `Usulan perubahan ${spec.label.toLowerCase()}`
                : `Draft ${spec.label.toLowerCase()} baru`}
            </h2>
            {editing && (
              <p className="mb-4 text-xs text-muted">
                Versi record saat ini: {editing.row_version}. Data resmi tetap
                berlaku selama usulan diperiksa.
              </p>
            )}
            <RecordForm
              key={`${selected}-${editing?.id ?? "new"}`}
              type={selected}
              values={editing ?? undefined}
              references={references}
              targetId={editing?.id}
              targetVersion={editing?.row_version}
            />
          </Card>
        ) : (
          <Card className="p-5 text-sm text-muted">
            {migrationPending
              ? "Pembuatan draft tersedia setelah pembaruan database."
              : lockedPaidPayment
                ? "Pembayaran yang sudah lunas dikunci dan tidak dapat diubah."
              : "Akses baca. Peran Anda tidak dapat membuat perubahan pada jenis data ini."}
          </Card>
        )}
        <Card className="overflow-hidden">
          <div className="border-b border-line p-5">
            <h2 className="text-lg font-semibold">
              {key === "asset"
                ? "Daftar aset perusahaan"
                : key === "pembayaran"
                  ? "Daftar pembayaran perusahaan"
                  : "Data resmi"}
            </h2>
            <p className="mt-1 text-xs text-muted">
              {records.length} record ditampilkan, maksimal 100. Data lama
              sebelum workflow tetap dipertahankan.
            </p>
          </div>
          <div className="divide-y divide-line">
            {!records.length && (
              <p className="p-8 text-center text-sm text-muted">
                Belum ada data yang sesuai.
              </p>
            )}
            {records.map((row) => (
              <article key={row.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {String(
                        row.name ??
                          row.title ??
                          row.full_name ??
                          row.payee_name ??
                          row.advance_number ??
                          row.tax_period,
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {String(
                        row.code ??
                          row.employee_number ??
                          row.payment_number ??
                          row.advance_number ??
                          row.reference_number ??
                          spec.label,
                      )}{" "}
                      · Versi {row.row_version ?? 1}
                    </p>
                  </div>
                  <span className="rounded-full bg-canvas px-3 py-1 text-xs">
                    {statusField
                      ? displayValue(
                          selected === "payment" &&
                            row.status === "unpaid" &&
                            String(row.due_on ?? "") < calendarDate()
                            ? "overdue"
                            : selected === "advance" && row.advance_status === "approved"
                              ? "awaiting_disbursement"
                              : row[statusField.name],
                        )
                      : displayValue(row.is_active)}
                  </span>
                </div>
                <dl className="mt-4 grid gap-x-5 gap-y-3 text-xs sm:grid-cols-2">
                  {spec.fields
                    .filter(
                      (field) =>
                        ![
                          "name",
                          "title",
                          "full_name",
                          "notes",
                          "description",
                        ].includes(field.name),
                    )
                    .map((field) => (
                      <div key={field.name}>
                        <dt className="text-muted">{field.label}</dt>
                        <dd className="mt-1 break-words text-ink">
                          {references[field.name]?.find(
                            (option) => option.value === row[field.name],
                          )?.label ?? displayValue(row[field.name], field)}
                        </dd>
                      </div>
                    ))}
                </dl>
                {canWrite && selected !== "advance" &&
                  !migrationPending &&
                  !(selected === "payment" && row.status === "paid") && (
                  <Link
                    href={`/modul/${key}?type=${selected}&edit=${row.id}`}
                    className="mt-4 inline-block text-sm font-semibold text-brand"
                  >
                    Usulkan perubahan →
                  </Link>
                )}
                {selected === "advance" && ["disbursed", "settled"].includes(String(row.advance_status)) && (() => {
                  const settlement = settlementByAdvance.get(row.id)
                  const maySubmit = !migrationPending &&
                    (row.created_by === workspace.user.id || role === "finance" || role === "owner") &&
                    settlement?.state !== "submitted" &&
                    settlement?.state !== "approved"
                  return (
                    <div className="mt-4 rounded-lg border border-line bg-canvas p-4">
                      <h3 className="font-semibold">Pertanggungjawaban kasbon</h3>
                      {settlement && (
                        <div className="mt-2 text-sm">
                          <p>Status: {settlement.state === "submitted" ? "Menunggu Finance" : settlement.state === "approved" ? "Disetujui" : "Ditolak — ajukan revisi"}</p>
                          <p className="mt-1 text-muted">{settlement.expense_note}</p>
                          <p className="mt-1 text-xs text-muted">Realisasi {displayValue(settlement.expense_total, { name: "amount", label: "Realisasi", type: "money" })} · Pengembalian {displayValue(settlement.cash_returned, { name: "amount", label: "Pengembalian", type: "money" })} · Tambahan {displayValue(settlement.additional_due, { name: "amount", label: "Tambahan", type: "money" })}{settlement.additional_due_on ? ` · Jatuh tempo ${settlement.additional_due_on}` : ""}</p>
                          {settlement.receipt_references && <p className="mt-1 text-xs text-muted">Referensi bukti: {settlement.receipt_references}</p>}
                          {settlement.review_note && <p className="mt-1 text-xs text-muted">Catatan Finance: {settlement.review_note}</p>}
                        </div>
                      )}
                      {maySubmit && (
                        <form action={submitCashAdvanceSettlement} className="mt-3 grid gap-3 sm:grid-cols-2">
                          <input type="hidden" name="advance_id" value={row.id} />
                          <label className="text-sm">Total biaya aktual
                            <MoneyInput required name="expense_total"  min="0"  className="mt-1 w-full rounded border border-line bg-white p-2"  />
                          </label>
                          <label className="text-sm">Kas dikembalikan
                            <MoneyInput required name="cash_returned"  min="0"  defaultValue="0" className="mt-1 w-full rounded border border-line bg-white p-2"  />
                          </label>
                          <label className="text-sm">Tambahan yang harus dibayar
                            <MoneyInput required name="additional_due"  min="0"  defaultValue="0" className="mt-1 w-full rounded border border-line bg-white p-2"  />
                          </label>
                          <label className="text-sm">Jatuh tempo tambahan (jika ada)
                            <input name="additional_due_on" type="date" className="mt-1 w-full rounded border border-line bg-white p-2" />
                          </label>
                          <label className="text-sm">Referensi kuitansi/bukti
                            <input name="receipt_references" maxLength={4000} placeholder="Nomor kuitansi atau referensi dokumen" className="mt-1 w-full rounded border border-line bg-white p-2" />
                          </label>
                          <label className="text-sm sm:col-span-2">Rincian penggunaan
                            <textarea required name="expense_note" maxLength={4000} rows={3} className="mt-1 w-full rounded border border-line bg-white p-2" />
                          </label>
                          <p className="text-xs text-muted sm:col-span-2">Biaya aktual + pengembalian kas harus sama dengan uang muka + tambahan yang ditagihkan. Cantumkan referensi bukti; unggahan file privat belum disiapkan.</p>
                          <button className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white sm:col-span-2">Ajukan pertanggungjawaban</button>
                        </form>
                      )}
                      {settlement?.state === "submitted" && role === "finance" && settlement.submitted_by !== workspace.user.id && (
                        <form action={reviewCashAdvanceSettlement} className="mt-3 grid gap-3 sm:grid-cols-3">
                          <input type="hidden" name="settlement_id" value={settlement.id} />
                          <select required name="decision" className="rounded border border-line bg-white p-2">
                            <option value="approved">Setujui dan tutup</option>
                            <option value="rejected">Tolak untuk revisi</option>
                          </select>
                          <input required name="review_note" maxLength={2000} placeholder="Catatan pemeriksaan Finance" className="rounded border border-line bg-white p-2 sm:col-span-2" />
                          <button className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white sm:col-span-3">Simpan keputusan</button>
                        </form>
                      )}
                    </div>
                  )
                })()}
              </article>
            ))}
          </div>
        </Card>
        </div>
      </div>
      <Card className="overflow-hidden">
        <div className="border-b border-line p-5">
          <h2 className="text-lg font-semibold">Dokumen & pengajuan</h2>
          <p className="mt-1 text-xs text-muted">
            Buka dokumen untuk mengedit draft, mengajukan, memeriksa, atau
            mengeksekusi.
          </p>
        </div>
        <div className="divide-y divide-line">
          {!documents.length && (
            <p className="p-6 text-sm text-muted">
              Belum ada dokumen workflow.
            </p>
          )}
          {documents.map((document) => (
            <Link
              key={document.id}
              href={`/dokumen/${document.id}`}
              className="flex items-center justify-between gap-4 p-5 hover:bg-canvas"
            >
              <div>
                <p className="text-sm font-semibold">{document.title}</p>
                <p className="mt-1 text-xs text-muted">
                  {recordSpecs[document.record_type]?.label} ·{" "}
                  {labels[document.operation]} · v{document.version}
                </p>
              </div>
              <span className="rounded-full bg-brand-light px-3 py-1 text-xs text-brand">
                {labels[document.state]}
              </span>
            </Link>
          ))}
        </div>
      </Card>
      {key === "perpajakan" && (
        <TaxRecapLoader
          supabase={supabase}
          organizationId={organizationId}
          canEditFiscal={
            !workspace.isReadOnlyPreview &&
            (workspace.actorRole === "owner" ||
              ["finance", "accounting_tax"].includes(role) ||
              (workspace.workAssignments ?? []).some((j) =>
                ["accounting_tax", "finance"].includes(j.job_role),
              ))
          }
        />
      )}
      {key === "sdm" && (
        <PayrollLoader
          supabase={supabase}
          organizationId={organizationId}
          employees={(recordsResult.data ?? []) as unknown as EmployeeOption[]}
          role={role}
          actorRole={workspace.actorRole}
          currentUserId={workspace.user.id}
          isReadOnly={workspace.isReadOnlyPreview}
        />
      )}
      {key === "asset" && (
        <AssetDepreciationPanel assets={(recordsResult.data ?? []) as unknown as AssetDepreciationRow[]} />
      )}
    </div>
  )
}

async function TaxRecapLoader({
  supabase,
  organizationId,
  canEditFiscal,
}: {
  supabase: Awaited<ReturnType<typeof requireWorkspace>>["supabase"]
  organizationId: string
  canEditFiscal: boolean
}) {
  const [purchaseRes, salesRes, branchesRes, fiscalRes, trialRes, coaRes] = await Promise.all([
    supabase
      .from("purchase_requests")
      .select(
        "id,branch_id,invoice_number,invoice_date,tax_invoice_number,tax_invoice_date,vendor_snapshot,subtotal,vat_amount,vat_creditable,withholding_code,withholding_amount,status",
      )
      .eq("organization_id", organizationId)
      .order("invoice_date", { ascending: false })
      .limit(300),
    supabase
      .from("sales_invoices")
      .select(
        "id,branch_id,invoice_number,invoice_date,amount,vat_amount,wht_amount,wht_proof_number,total_amount,status",
      )
      .eq("organization_id", organizationId)
      .order("invoice_date", { ascending: false })
      .limit(300),
    supabase
      .from("business_units")
      .select("id,code,name")
      .eq("organization_id", organizationId)
      .eq("kind", "branch")
      .order("code"),
    supabase
      .from("tax_fiscal_adjustments")
      .select("id,fiscal_year,adjustment_type,difference_kind,account_code,description,amount,tax_rule_ref")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("trial_balance")
      .select("entity_id,period_id,account_code,account_name,debit_total,credit_total,net_debit_balance")
      .eq("organization_id", organizationId)
      .limit(500),
    supabase
      .from("finance_accounts")
      .select("code,name,account_type,normal_balance")
      .eq("organization_id", organizationId),
  ])

  const financial = buildFinancialStatements(
    (trialRes.error ? [] : (trialRes.data ?? [])) as TrialBalanceRow[],
    (coaRes.error ? [] : (coaRes.data ?? [])) as CoaMetaRow[],
  )

  return (
    <TaxRecapView
      purchases={(purchaseRes.data ?? []) as PurchaseTaxRow[]}
      salesInvoices={(salesRes.data ?? []) as SalesTaxRow[]}
      branches={(branchesRes.data ?? []) as Array<{ id: string; code: string; name: string }>}
      fiscalAdjustments={
        (fiscalRes.error ? [] : (fiscalRes.data ?? [])) as FiscalAdjustmentRow[]
      }
      commercialNetIncome={financial.incomeStatement.netIncome}
      canEditFiscal={canEditFiscal}
    />
  )
}

async function PayrollLoader({
  supabase,
  organizationId,
  employees,
  role,
  actorRole,
  currentUserId,
  isReadOnly,
}: {
  supabase: Awaited<ReturnType<typeof requireWorkspace>>["supabase"]
  organizationId: string
  employees: EmployeeOption[]
  role: string
  actorRole: string
  currentUserId: string
  isReadOnly: boolean
}) {
  const runsRes = await supabase
    .from("payroll_runs")
    .select("id,period_month,title,status,total_gross,total_deductions,total_net,created_by,created_at")
    .eq("organization_id", organizationId)
    .order("period_month", { ascending: false })
    .limit(24)

  if (isWorkflowMissing(runsRes.error)) return null
  return (
    <PayrollWorkbench
      employees={employees}
      runs={(runsRes.data ?? []) as PayrollRunRow[]}
      canCreate={!isReadOnly && (actorRole === "owner" || ["hr", "finance"].includes(role))}
      canApprove={!isReadOnly && (actorRole === "owner" || ["director", "finance"].includes(role))}
      currentUserId={currentUserId}
      isOwner={actorRole === "owner"}
    />
  )
}
