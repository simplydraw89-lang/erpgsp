import { notFound } from "next/navigation"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RecordForm } from "@/components/workflow/record-form"
import { MigrationNotice } from "@/components/workflow/migration-notice"
import { ModuleFilters } from "@/components/workflow/module-filters"
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
  if (key === "manajemen") {
    if (!["owner", "director"].includes(role))
      return (
        <Card className="p-6">
          Anda tidak memiliki akses laporan manajemen.
        </Card>
      )
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
  ) ?? (spec.fields.some((field) => field.name === "is_active")
    ? { name: "is_active", label: "Status akun", type: "select" as const, options: ["true", "false"] }
    : undefined)
  const statusField = selected === "payment" && configuredStatusField
    ? { ...configuredStatusField, options: [...(configuredStatusField.options ?? []), "overdue"] }
    : configuredStatusField
  if (selected === "payment" && query.status === "overdue")
    liveQuery = liveQuery.eq("status", "unpaid").lt("due_on", calendarDate())
  else if (configuredStatusField?.options?.includes(query.status ?? ""))
    liveQuery = liveQuery.eq(configuredStatusField.name, query.status!)
  const fromDate = validDate(query.from)
  const toDate = validDate(query.to)
  if (dateField && fromDate) liveQuery = liveQuery.gte(dateField, fromDate)
  if (dateField && toDate) liveQuery = liveQuery.lte(dateField, toDate)
  const [recordsResult, documentsResult, references] = await Promise.all([
    liveQuery,
    supabase
      .from("workflow_documents")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("module_key", key)
      .order("created_at", { ascending: false })
      .limit(100),
    loadReferences(supabase, organizationId, selected),
  ])
  for (const result of [recordsResult, documentsResult])
    if (result.error && !isWorkflowMissing(result.error))
      throw new Error(`Data modul gagal dimuat: ${result.error.message}`)
  const migrationPending = !!recordsResult.error || !!documentsResult.error
  const records = (recordsResult.data ?? []) as Row[]
  const documents = (documentsResult.data ?? []) as WorkflowDocument[]
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
                          row.tax_period,
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {String(
                        row.code ??
                          row.employee_number ??
                          row.payment_number ??
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
                {canWrite &&
                  !migrationPending &&
                  !(selected === "payment" && row.status === "paid") && (
                  <Link
                    href={`/modul/${key}?type=${selected}&edit=${row.id}`}
                    className="mt-4 inline-block text-sm font-semibold text-brand"
                  >
                    Usulkan perubahan →
                  </Link>
                )}
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
    </div>
  )
}
