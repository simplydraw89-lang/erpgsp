import type { OrganizationRole } from "@/lib/auth/context"
import type { ModuleKey } from "@/lib/modules"

export type Field = {
  name: string
  label: string
  type?:
    | "text"
    | "email"
    | "date"
    | "money"
    | "textarea"
    | "select"
    | "reference"
    | "checkbox"
  required?: boolean
  options?: readonly string[]
  defaultValue?: string | boolean
}
export type RecordType =
  | "client"
  | "project"
  | "work_item"
  | "account"
  | "employee"
  | "tax_record"
  | "asset"
  | "payment"
export type RecordSpec = {
  label: string
  module: ModuleKey
  table: string
  writers: OrganizationRole[]
  readers: OrganizationRole[]
  fields: Field[]
}
const all: OrganizationRole[] = [
  "owner",
  "director",
  "finance",
  "hr",
  "operations",
  "auditor",
  "staff",
]
const field = (
  name: string,
  label: string,
  type: Field["type"] = "text",
  required = false,
): Field => ({ name, label, type, required })
const select = (name: string, label: string, options: string[]): Field => ({
  name,
  label,
  type: "select",
  required: true,
  options,
  defaultValue: options[0],
})

export const recordSpecs: Record<RecordType, RecordSpec> = {
  client: {
    label: "Kontak",
    module: "crm",
    table: "crm_clients",
    writers: ["owner", "director", "operations", "staff"],
    readers: all,
    fields: [
      field("name", "Nama kontak", "text", true),
      field("company_name", "Perusahaan"),
      field("email", "Email", "email"),
      field("phone", "Telepon"),
      select("status", "Status", ["prospect", "client", "inactive"]),
      field("notes", "Catatan", "textarea"),
    ],
  },
  project: {
    label: "Proyek",
    module: "crm",
    table: "crm_projects",
    writers: ["owner", "director", "operations"],
    readers: all,
    fields: [
      field("code", "Kode proyek", "text", true),
      field("name", "Nama proyek", "text", true),
      field("client_id", "Klien", "reference"),
      field("starts_on", "Tanggal mulai", "date"),
      field("ends_on", "Tanggal selesai", "date"),
      select("status", "Status", [
        "planned",
        "active",
        "on_hold",
        "completed",
        "cancelled",
      ]),
    ],
  },
  work_item: {
    label: "Pekerjaan",
    module: "operasional",
    table: "operational_work_items",
    writers: ["owner", "director", "operations", "staff"],
    readers: all,
    fields: [
      field("title", "Judul pekerjaan", "text", true),
      field("description", "Deskripsi", "textarea"),
      field("project_id", "Proyek", "reference"),
      field("assigned_to", "Penanggung jawab", "reference"),
      select("priority", "Prioritas", ["normal", "low", "high", "urgent"]),
      field("due_on", "Tenggat", "date"),
      select("status", "Status", ["todo", "in_progress", "blocked", "done"]),
    ],
  },
  account: {
    label: "Akun keuangan",
    module: "keuangan",
    table: "finance_accounts",
    writers: ["owner", "finance"],
    readers: ["owner", "director", "finance", "auditor"],
    fields: [
      field("code", "Kode akun", "text", true),
      field("name", "Nama akun", "text", true),
      select("account_type", "Jenis akun", [
        "asset",
        "liability",
        "equity",
        "revenue",
        "expense",
      ]),
      { ...field("is_active", "Akun aktif", "checkbox"), defaultValue: true },
    ],
  },
  employee: {
    label: "Karyawan",
    module: "sdm",
    table: "hr_employees",
    writers: ["owner", "hr"],
    readers: ["owner", "director", "hr"],
    fields: [
      field("employee_number", "Nomor karyawan", "text", true),
      field("full_name", "Nama lengkap", "text", true),
      field("email", "Email", "email"),
      field("job_title", "Jabatan"),
      field("department", "Departemen"),
      field("started_on", "Tanggal mulai", "date"),
      select("employment_status", "Status karyawan", [
        "active",
        "on_leave",
        "resigned",
      ]),
    ],
  },
  tax_record: {
    label: "Catatan pajak",
    module: "perpajakan",
    table: "tax_records",
    writers: ["owner", "finance"],
    readers: ["owner", "director", "finance", "auditor"],
    fields: [
      field("tax_period", "Masa pajak (YYYY-MM)", "text", true),
      select("tax_type", "Jenis pajak", [
        "ppn",
        "pph21",
        "pph23",
        "pph4_2",
        "pph25",
        "pph29",
        "other",
      ]),
      field("reference_number", "Nomor referensi"),
      field("tax_base", "Dasar pajak (IDR)", "money", true),
      field("tax_amount", "Nilai pajak (IDR)", "money", true),
      field("due_on", "Jatuh tempo", "date"),
      select("status", "Status pencatatan", ["draft", "reviewed", "reported"]),
      field("notes", "Catatan", "textarea"),
    ],
  },
  asset: {
    label: "Aset",
    module: "asset",
    table: "company_assets",
    writers: ["owner", "finance", "operations"],
    readers: ["owner", "director", "finance", "operations", "auditor", "staff"],
    fields: [
      field("code", "Kode aset", "text", true),
      field("name", "Nama aset", "text", true),
      field("category", "Kategori", "text", true),
      field("serial_number", "Nomor seri"),
      field("location", "Lokasi"),
      field("custodian_id", "Penanggung jawab", "reference"),
      field("acquired_on", "Tanggal perolehan", "date"),
      field("purchase_cost", "Nilai perolehan (IDR)", "money", true),
      select("condition", "Kondisi", ["good", "needs_service", "damaged"]),
      select("status", "Status aset", ["active", "in_repair", "retired"]),
      field("notes", "Catatan", "textarea"),
    ],
  },
  payment: {
    label: "Pembayaran",
    module: "pembayaran",
    table: "payment_records",
    writers: ["owner", "finance"],
    readers: ["owner", "director", "finance", "auditor"],
    fields: [
      field("payment_number", "Nomor tagihan", "text", true),
      field("payee_name", "Penerima pembayaran", "text", true),
      field("description", "Keterangan tagihan", "textarea", true),
      field("invoice_date", "Tanggal tagihan", "date", true),
      field("due_on", "Tanggal jatuh tempo", "date", true),
      field("amount", "Jumlah (IDR)", "money", true),
      select("status", "Status pembayaran", ["unpaid", "paid"]),
      field("paid_on", "Tanggal dibayar", "date"),
      select("payment_method", "Metode pembayaran", [
        "transfer",
        "cash",
        "other",
      ]),
      field("reference_number", "Nomor referensi pembayaran"),
      field("notes", "Catatan", "textarea"),
    ],
  },
}

export const labels: Record<string, string> = {
  draft: "Draft",
  submitted: "Diajukan",
  approved: "Disetujui",
  rejected: "Ditolak",
  executed: "Dieksekusi",
  pending: "Menunggu keputusan",
  owner: "Superuser",
  director: "Direksi",
  finance: "Keuangan",
  hr: "SDM",
  operations: "Operasional",
  auditor: "Auditor",
  staff: "Staf",
  create: "Pendaftaran baru",
  update: "Perubahan data",
  good: "Baik",
  needs_service: "Perlu perawatan",
  damaged: "Rusak",
  active: "Aktif",
  in_repair: "Dalam perbaikan",
  retired: "Tidak digunakan",
  unpaid: "Belum lunas",
  paid: "Lunas",
  overdue: "Terlambat",
  transfer: "Transfer bank",
  cash: "Tunai",
  prospect: "Prospek",
  client: "Klien",
  inactive: "Tidak aktif",
  planned: "Direncanakan",
  on_hold: "Ditunda",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  todo: "Belum dikerjakan",
  in_progress: "Dikerjakan",
  blocked: "Terhambat",
  done: "Selesai",
  normal: "Normal",
  low: "Rendah",
  high: "Tinggi",
  urgent: "Mendesak",
  asset: "Aset",
  liability: "Liabilitas",
  equity: "Ekuitas",
  revenue: "Pendapatan",
  expense: "Beban",
  on_leave: "Cuti",
  resigned: "Keluar",
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
export type WorkflowDocument = {
  id: string
  organization_id: string
  record_type: RecordType
  module_key: ModuleKey
  title: string
  payload: Record<string, string | number | boolean | null>
  state: "draft" | "submitted" | "approved" | "rejected" | "executed"
  version: number
  created_by: string
  target_id: string
  base_version: number
  operation: "create" | "update"
  created_at: string
  executed_at: string | null
}
export type ReferenceOptions = Record<
  string,
  { value: string; label: string }[]
>
export function isRecordType(value: string): value is RecordType {
  return Object.hasOwn(recordSpecs, value)
}
export function isWorkflowMissing(error: { code?: string } | null) {
  return (
    !!error &&
    ["PGRST205", "42P01", "PGRST202", "42703"].includes(error.code ?? "")
  )
}
export function displayValue(value: unknown, field?: Field) {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "Ya" : "Tidak"
  if (field?.type === "money")
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value))
  return labels[String(value)] ?? String(value)
}
