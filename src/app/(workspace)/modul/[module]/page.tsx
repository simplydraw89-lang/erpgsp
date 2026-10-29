import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Cable, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { requireWorkspace, type OrganizationRole } from "@/lib/auth/context"
import { getModule, type ModuleKey } from "@/lib/modules"
import { createModuleRecord } from "../actions"

type ModuleRecord = {
  id: string
  title: string
  detail: string
  status: string
  createdAt: string
}

type ModuleMetric = {
  label: string
  count: number
}

const writeRoles: Record<ModuleKey, OrganizationRole[]> = {
  crm: ["owner", "director", "operations", "staff"],
  operasional: ["owner", "director", "operations", "staff"],
  keuangan: ["owner", "finance"],
  sdm: ["owner", "hr"],
  perpajakan: ["owner", "finance"],
  manajemen: [],
}

const statusLabels: Record<string, string> = {
  prospect: "Prospek",
  client: "Klien",
  inactive: "Tidak aktif",
  planned: "Direncanakan",
  active: "Aktif",
  on_hold: "Ditunda",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  todo: "Belum dikerjakan",
  in_progress: "Sedang dikerjakan",
  blocked: "Terhambat",
  done: "Selesai",
  asset: "Aset",
  liability: "Liabilitas",
  equity: "Ekuitas",
  revenue: "Pendapatan",
  expense: "Beban",
  debit: "Debit",
  credit: "Kredit",
  active_employee: "Aktif",
  on_leave: "Cuti",
  resigned: "Keluar",
  draft: "Draft",
  reviewed: "Ditinjau",
  reported: "Dilaporkan",
  ppn: "PPN",
  pph21: "PPh 21",
  pph23: "PPh 23",
  pph4_2: "PPh 4(2)",
  pph25: "PPh 25",
  pph29: "PPh 29",
  other: "Lainnya",
}

function isMissingModuleSchema(error: { code?: string }) {
  return error.code === "PGRST205" || error.code === "42P01"
}

async function loadModuleData(
  moduleKey: ModuleKey,
  supabase: Awaited<ReturnType<typeof requireWorkspace>>["supabase"],
  organizationId: string,
) {
  let records: ModuleRecord[] = []
  let metrics: ModuleMetric[] = []
  let schemaPending = false

  if (moduleKey === "crm") {
    const [clients, projects] = await Promise.all([
      supabase
        .from("crm_clients")
        .select("id, name, company_name, status, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("crm_projects")
        .select("id, code, name, status, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(50),
    ])
    const error = clients.error ?? projects.error
    if (error && isMissingModuleSchema(error)) schemaPending = true
    else if (error) throw new Error(`Gagal memuat data CRM: ${error.message}`)
    if (!schemaPending) {
      records = [
        ...(clients.data ?? []).map((row) => ({
          id: `client-${row.id}`,
          title: row.name,
          detail: row.company_name ?? "Kontak",
          status: row.status,
          createdAt: row.created_at,
        })),
        ...(projects.data ?? []).map((row) => ({
          id: `project-${row.id}`,
          title: row.name,
          detail: `Proyek ${row.code}`,
          status: row.status,
          createdAt: row.created_at,
        })),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
  } else if (moduleKey === "operasional") {
    const { data, error } = await supabase
      .from("operational_work_items")
      .select("id, title, description, status, priority, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100)
    if (error && isMissingModuleSchema(error)) schemaPending = true
    else if (error) throw new Error(`Gagal memuat pekerjaan: ${error.message}`)
    records = (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      detail: [row.description, `Prioritas ${statusLabels[row.priority] ?? row.priority}`]
        .filter(Boolean)
        .join(" · "),
      status: row.status,
      createdAt: row.created_at,
    }))
  } else if (moduleKey === "keuangan") {
    const { data, error } = await supabase
      .from("finance_accounts")
      .select("id, code, name, account_type, normal_balance, created_at")
      .eq("organization_id", organizationId)
      .order("code")
      .limit(100)
    if (error && isMissingModuleSchema(error)) schemaPending = true
    else if (error) throw new Error(`Gagal memuat bagan akun: ${error.message}`)
    records = (data ?? []).map((row) => ({
      id: row.id,
      title: `${row.code} · ${row.name}`,
      detail: `${statusLabels[row.account_type] ?? row.account_type} · saldo normal ${statusLabels[row.normal_balance] ?? row.normal_balance}`,
      status: "active",
      createdAt: row.created_at,
    }))
  } else if (moduleKey === "sdm") {
    const { data, error } = await supabase
      .from("hr_employees")
      .select("id, employee_number, full_name, job_title, department, employment_status, created_at")
      .eq("organization_id", organizationId)
      .order("full_name")
      .limit(100)
    if (error && isMissingModuleSchema(error)) schemaPending = true
    else if (error) throw new Error(`Gagal memuat data SDM: ${error.message}`)
    records = (data ?? []).map((row) => ({
      id: row.id,
      title: `${row.employee_number} · ${row.full_name}`,
      detail: [row.job_title, row.department].filter(Boolean).join(" · ") || "Karyawan",
      status: row.employment_status,
      createdAt: row.created_at,
    }))
  } else if (moduleKey === "perpajakan") {
    const { data, error } = await supabase
      .from("tax_records")
      .select("id, tax_period, tax_type, reference_number, tax_amount, status, created_at")
      .eq("organization_id", organizationId)
      .order("tax_period", { ascending: false })
      .limit(100)
    if (error && isMissingModuleSchema(error)) schemaPending = true
    else if (error) throw new Error(`Gagal memuat catatan pajak: ${error.message}`)
    records = (data ?? []).map((row) => ({
      id: row.id,
      title: `${row.tax_period} · ${statusLabels[row.tax_type] ?? row.tax_type}`,
      detail: [
        row.reference_number,
        new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(row.tax_amount),
      ]
        .filter(Boolean)
        .join(" · "),
      status: row.status,
      createdAt: row.created_at,
    }))
  } else if (moduleKey === "manajemen") {
    const [clients, projects, workItems, accounts, employees, taxes] =
      await Promise.all([
        supabase.from("crm_clients").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
        supabase.from("crm_projects").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
        supabase.from("operational_work_items").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
        supabase.from("finance_accounts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
        supabase.from("hr_employees").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
        supabase.from("tax_records").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      ])
    const results = [clients, projects, workItems, accounts, employees, taxes]
    const missing = results.find((result) => result.error && isMissingModuleSchema(result.error))
    const error = results.find((result) => result.error && !isMissingModuleSchema(result.error))
    if (missing) schemaPending = true
    if (error?.error) throw new Error(`Gagal memuat ringkasan manajemen: ${error.error.message}`)
    if (!schemaPending) {
      metrics = [
        { label: "Kontak CRM", count: clients.count ?? 0 },
        { label: "Proyek", count: projects.count ?? 0 },
        { label: "Pekerjaan", count: workItems.count ?? 0 },
        { label: "Akun keuangan", count: accounts.count ?? 0 },
        { label: "Karyawan", count: employees.count ?? 0 },
        { label: "Catatan pajak", count: taxes.count ?? 0 },
      ]
    }
  }

  return { records, metrics, schemaPending }
}

function TextField({
  name,
  label,
  type = "text",
  required = false,
  placeholder,
}: {
  name: string
  label: string
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-ink">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
      />
    </label>
  )
}

function SelectField({
  name,
  label,
  options,
}: {
  name: string
  label: string
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-ink">
      {label}
      <select
        name={name}
        required
        defaultValue={options[0]?.value}
        className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function ModuleForm({ moduleKey }: { moduleKey: ModuleKey }) {
  const formClass = "space-y-4"
  const gridClass = "grid gap-3 sm:grid-cols-2"

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-ink">Tambah data</h2>
      <p className="mt-1 text-sm text-muted">Data baru akan masuk ke organisasi ini dan tercatat di audit.</p>
      <form action={createModuleRecord} className={`${formClass} mt-5`}>
        <input type="hidden" name="moduleKey" value={moduleKey} />
        {moduleKey === "crm" && (
          <>
            <input type="hidden" name="recordType" value="client" />
            <TextField name="name" label="Nama kontak" required />
            <div className={gridClass}>
              <TextField name="company_name" label="Perusahaan" />
              <SelectField name="status" label="Status kontak" options={[
                { value: "prospect", label: "Prospek" },
                { value: "client", label: "Klien" },
                { value: "inactive", label: "Tidak aktif" },
              ]} />
            </div>
            <div className={gridClass}>
              <TextField name="email" label="Email" type="email" />
              <TextField name="phone" label="Telepon" />
            </div>
            <TextField name="notes" label="Catatan" />
          </>
        )}
        {moduleKey === "operasional" && (
          <>
            <input type="hidden" name="recordType" value="work_item" />
            <TextField name="title" label="Judul pekerjaan" required />
            <TextField name="description" label="Deskripsi" />
            <div className={gridClass}>
              <SelectField name="priority" label="Prioritas" options={[
                { value: "normal", label: "Normal" },
                { value: "low", label: "Rendah" },
                { value: "high", label: "Tinggi" },
                { value: "urgent", label: "Mendesak" },
              ]} />
              <TextField name="due_on" label="Tenggat" type="date" />
            </div>
          </>
        )}
        {moduleKey === "keuangan" && (
          <>
            <input type="hidden" name="recordType" value="account" />
            <div className={gridClass}>
              <TextField name="code" label="Kode akun" required />
              <TextField name="name" label="Nama akun" required />
            </div>
            <SelectField name="account_type" label="Kelompok akun" options={[
                { value: "asset", label: "Aset" },
                { value: "liability", label: "Liabilitas" },
                { value: "equity", label: "Ekuitas" },
                { value: "revenue", label: "Pendapatan" },
                { value: "expense", label: "Beban" },
              ]} />
            <p className="text-xs text-muted">Saldo normal ditentukan otomatis dari kelompok akun.</p>
          </>
        )}
        {moduleKey === "sdm" && (
          <>
            <input type="hidden" name="recordType" value="employee" />
            <div className={gridClass}>
              <TextField name="employee_number" label="Nomor karyawan" required />
              <TextField name="full_name" label="Nama lengkap" required />
            </div>
            <TextField name="email" label="Email" type="email" />
            <div className={gridClass}>
              <TextField name="job_title" label="Jabatan" />
              <TextField name="department" label="Departemen" />
            </div>
            <TextField name="started_on" label="Tanggal mulai" type="date" />
          </>
        )}
        {moduleKey === "perpajakan" && (
          <>
            <input type="hidden" name="recordType" value="tax_record" />
            <div className={gridClass}>
              <TextField name="tax_period" label="Masa pajak (YYYY-MM)" required placeholder="2026-10" />
              <SelectField name="tax_type" label="Jenis pajak" options={[
                { value: "ppn", label: "PPN" },
                { value: "pph21", label: "PPh 21" },
                { value: "pph23", label: "PPh 23" },
                { value: "pph4_2", label: "PPh 4(2)" },
                { value: "pph25", label: "PPh 25" },
                { value: "pph29", label: "PPh 29" },
                { value: "other", label: "Lainnya" },
              ]} />
            </div>
            <TextField name="reference_number" label="Nomor referensi" />
            <div className={gridClass}>
              <TextField name="tax_base" label="Dasar pajak (IDR)" type="number" required />
              <TextField name="tax_amount" label="Nilai pajak (IDR)" type="number" required />
            </div>
            <TextField name="due_on" label="Jatuh tempo" type="date" />
            <p className="text-xs leading-5 text-muted">
              Tahap ini hanya mencatat angka yang dimasukkan pengguna; belum menghitung atau melaporkan pajak.
            </p>
          </>
        )}
        <Button type="submit">Simpan data</Button>
      </form>
    </Card>
  )
}

function ProjectForm() {
  return (
    <Card className="mt-4 p-5">
      <h2 className="text-base font-semibold text-ink">Tambah proyek</h2>
      <form action={createModuleRecord} className="mt-4 space-y-4">
        <input type="hidden" name="moduleKey" value="crm" />
        <input type="hidden" name="recordType" value="project" />
        <TextField name="code" label="Kode proyek" required />
        <TextField name="name" label="Nama proyek" required />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField name="starts_on" label="Tanggal mulai" type="date" />
          <TextField name="ends_on" label="Tanggal selesai" type="date" />
        </div>
        <Button type="submit">Simpan proyek</Button>
      </form>
    </Card>
  )
}

export default async function ModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>
  searchParams: Promise<{ saved?: string }>
}) {
  const [{ module: key }, { saved }, workspace] = await Promise.all([
    params,
    searchParams,
    requireWorkspace(),
  ])
  const moduleDefinition = getModule(key)
  if (!moduleDefinition) notFound()
  const moduleKey = moduleDefinition.key
  const Icon = moduleDefinition.icon
  const isManager = workspace.role === "owner" || workspace.role === "director"
  const { records, metrics, schemaPending } =
    moduleKey === "manajemen" && !isManager
      ? { records: [], metrics: [], schemaPending: false }
      : await loadModuleData(
          moduleKey,
          workspace.supabase,
          workspace.organizationId,
        )
  const canWrite = writeRoles[moduleKey].includes(workspace.role)

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard"><ArrowLeft size={15} /> Kembali ke ringkasan</Link>
      </Button>

      <Card className="overflow-hidden">
        <div className="border-b border-line bg-white p-7 md:p-9">
          <div className="flex size-12 items-center justify-center rounded-xl bg-brand-light text-brand">
            <Icon size={23} />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.15em] text-brand">Modul ERP internal · MVP tahap 1</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">{moduleDefinition.name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{moduleDefinition.description}</p>
        </div>
        <div className="grid gap-4 bg-canvas p-6 md:grid-cols-2 md:p-8">
          <div className="rounded-lg border border-line bg-white p-5">
            <Cable size={19} className="text-brand" />
            <h2 className="mt-4 text-sm font-semibold text-ink">Penyimpanan data</h2>
            <p className="mt-1 text-sm text-muted">Supabase project ERP GSP</p>
            <p className="mt-3 text-xs leading-5 text-muted">
              Data baru dicatat di database ERP ini. Belum ada sinkronisasi otomatis dengan aplikasi lain.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-white p-5">
            <ShieldCheck size={19} className="text-brand" />
            <h2 className="mt-4 text-sm font-semibold text-ink">Akses & kontrol</h2>
            <p className="mt-1 text-sm text-muted">Sesuai peran dan organisasi</p>
            <p className="mt-3 text-xs leading-5 text-muted">
              Hak akses diperiksa di server dan Row Level Security; perubahan dicatat di audit.
            </p>
          </div>
        </div>
      </Card>

      {saved === "1" && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Data berhasil disimpan dan dicatat di audit.
        </p>
      )}

      {schemaPending ? (
        <Card className="p-6">
          <h2 className="font-semibold text-ink">Migration modul belum diterapkan</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Terapkan file <code>supabase/migrations/202610290002_module_mvp.sql</code> di SQL Editor Supabase untuk membuat tabel, kebijakan akses, dan audit modul.
          </p>
        </Card>
      ) : moduleKey === "manajemen" ? (
        <section>
          {!isManager ? (
            <Card className="p-6 text-sm text-muted">Ringkasan ini hanya tersedia untuk owner dan direksi.</Card>
          ) : (
            <>
              <h2 className="mb-4 text-lg font-bold text-ink">Ringkasan data organisasi</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {metrics.map((metric) => (
                  <Card key={metric.label} className="p-5">
                    <p className="text-sm text-muted">{metric.label}</p>
                    <p className="mt-2 text-3xl font-bold text-ink">{metric.count}</p>
                  </Card>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-muted">
                Angka ini hanya menghitung catatan pada ERP baru. Belum mencakup saldo akuntansi, payroll, atau pelaporan pajak resmi.
              </p>
            </>
          )}
        </section>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section>
            {canWrite ? (
              <>
                <ModuleForm moduleKey={moduleKey} />
                {moduleKey === "crm" && <ProjectForm />}
              </>
            ) : (
              <Card className="p-5 text-sm leading-6 text-muted">
                Peran Anda memiliki akses baca, tetapi tidak dapat menambahkan data pada modul ini.
              </Card>
            )}
          </section>
          <section>
            <Card className="overflow-hidden">
              <div className="border-b border-line px-5 py-4">
                <h2 className="text-base font-semibold text-ink">Data terbaru</h2>
                <p className="mt-1 text-sm text-muted">{records.length} catatan ditampilkan</p>
              </div>
              {!records.length ? (
                <p className="px-5 py-12 text-center text-sm text-muted">Belum ada data pada modul ini.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {records.map((record) => (
                    <li key={record.id} className="flex items-start justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{record.title}</p>
                        <p className="mt-1 truncate text-xs text-muted">{record.detail}</p>
                        <time className="mt-2 block text-[11px] text-muted">
                          {new Date(record.createdAt).toLocaleDateString("id-ID")}
                        </time>
                      </div>
                      <span className="shrink-0 rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink">
                        {statusLabels[record.status] ?? record.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>
      )}
    </div>
  )
}
