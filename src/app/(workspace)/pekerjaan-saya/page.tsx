import { ArrowRight, BriefcaseBusiness, CheckSquare2, RotateCcw } from "lucide-react"
import { Card } from "@/components/ui/card"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { MigrationNotice } from "@/components/workflow/migration-notice"
import { requireWorkspace } from "@/lib/auth/context"
import { calendarDate } from "@/lib/dashboard"
import { isWorkflowMissing, labels, recordSpecs } from "@/lib/workflow"
import { BusinessSummary } from "@/components/dashboard/business-summary"
import { loadBusinessSummary } from "@/lib/business-summary"
import { PersonalNav } from "@/components/workflow/personal-nav"

const roleWorkspaces = {
  owner: [
    { name: "Ringkasan perusahaan", href: "/modul/manajemen", description: "Pantau capaian lintas modul." },
    { name: "Antrean persetujuan", href: "/approvals?scope=review", description: "Periksa pengajuan sesuai kebijakan." },
    { name: "Tugas operasional", href: "/modul/operasional", description: "Lihat pekerjaan yang ditugaskan kepada Anda." },
  ],
  director: [
    { name: "Ringkasan perusahaan", href: "/modul/manajemen", description: "Pantau capaian lintas modul." },
    { name: "Antrean persetujuan", href: "/approvals?scope=review", description: "Periksa pengajuan sesuai kebijakan." },
    { name: "Tugas operasional", href: "/modul/operasional", description: "Lihat pekerjaan yang ditugaskan kepada Anda." },
  ],
  manager: [
    { name: "Antrean persetujuan", href: "/approvals?scope=review", description: "Periksa pengajuan tim sebagai Manager." },
    { name: "Tugas operasional", href: "/modul/operasional", description: "Lihat pekerjaan yang ditugaskan kepada Anda." },
    { name: "Pengajuan saya", href: "/pekerjaan-saya/pengajuan", description: "Pantau pengajuan dan revisi Anda." },
  ],
  finance: [
    { name: "Tagihan dan pembayaran", href: "/modul/pembayaran", description: "Pantau jatuh tempo dan status bayar." },
    { name: "Bagan akun", href: "/modul/keuangan", description: "Kelola akun keuangan sesuai wewenang." },
    { name: "Antrean persetujuan", href: "/approvals?scope=review", description: "Tinjau dokumen keuangan yang ditugaskan." },
  ],
  hr: [
    { name: "Data karyawan", href: "/modul/sdm", description: "Kelola profil dan status karyawan." },
    { name: "Antrean persetujuan", href: "/approvals?scope=review", description: "Tinjau pengajuan terkait sesuai kebijakan." },
    { name: "Tugas operasional", href: "/modul/operasional", description: "Lihat pekerjaan yang ditugaskan kepada Anda." },
  ],
  operations: [
    { name: "Pekerjaan operasional", href: "/modul/operasional", description: "Kelola pekerjaan dan tenggat." },
    { name: "Proyek", href: "/modul/crm?type=project", description: "Pantau proyek aktif perusahaan." },
    { name: "Antrean persetujuan", href: "/approvals?scope=review", description: "Tinjau dokumen operasional yang ditugaskan." },
  ],
  auditor: [
    { name: "Jejak audit", href: "/audit", description: "Tinjau riwayat perubahan dan keputusan." },
    { name: "Antrean persetujuan", href: "/approvals?scope=review", description: "Buka permintaan yang menjadi kewenangan Anda." },
    { name: "Ringkasan pembayaran", href: "/modul/pembayaran", description: "Tinjau tagihan sesuai akses audit." },
  ],
  staff: [
    { name: "Pekerjaan operasional", href: "/modul/operasional", description: "Kelola pekerjaan dan tenggat." },
    { name: "Proyek", href: "/modul/crm?type=project", description: "Lihat proyek dan klien terkait." },
    { name: "Pengajuan dan revisi", href: "/pekerjaan-saya/pengajuan", description: "Pantau status pengajuan Anda." },
  ],
} as const

function formatDate(value: string | null) {
  if (!value) return "Tanpa tenggat"
  const date = new Date(`${value.slice(0, 10)}T12:00:00+07:00`)
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(date)
}

export default async function MyWorkPage() {
  const { supabase, organizationId, user, role } = await requireWorkspace()
  const businessSummaryPromise = loadBusinessSummary(supabase, organizationId, { includeReport:false })
  const [tasks, approvals, revisions] = await Promise.all([
    supabase
      .from("operational_work_items")
      .select("id,title,description,priority,due_on,status,project_id")
      .eq("organization_id", organizationId)
      .eq("assigned_to", user.id)
      .neq("status", "done")
      .order("due_on", { ascending: true, nullsFirst: false })
      .limit(50),
    supabase
      .from("approval_requests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("required_role", role)
      .eq("status", "pending")
      .neq("requested_by", user.id),
    supabase
      .from("workflow_documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("created_by", user.id)
      .eq("state", "rejected"),
  ])
  if ([tasks.error, approvals.error, revisions.error].some(isWorkflowMissing))
    return <MigrationNotice />
  if (tasks.error || approvals.error || revisions.error)
    throw new Error("Pekerjaan Anda gagal dimuat.")

  const today = calendarDate()
  const taskRows = tasks.data ?? []
  const workspaces = roleWorkspaces[role]
  const pendingApprovals = approvals.count ?? 0
  const needRevision = revisions.count ?? 0
  const businessSummary = await businessSummaryPromise

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-medium text-brand">Ruang kerja pribadi</p>
        <h1 className="mt-2 text-3xl font-bold">Pekerjaan saya</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Tugas yang ditugaskan kepada Anda, tindakan yang menunggu kewenangan Anda, dan pintasan kerja berdasarkan peran.
        </p>
      </header>
      <PersonalNav active="work" />
      <Card className="p-5"><h2 className="font-semibold">Pengajuan saya</h2><p className="mt-2 text-sm text-muted">Pantau dokumen, draft dan pengajuan yang Anda buat sendiri.</p><Link href="/pekerjaan-saya/pengajuan" className="mt-3 inline-block text-sm font-semibold text-brand">Buka pengajuan saya →</Link></Card>
      <BusinessSummary summary={businessSummary} queueOnly />

      <section aria-label="Ringkasan pekerjaan" className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted">Tugas belum selesai</p>
          <p className="mt-2 text-2xl font-bold">{taskRows.length}</p>
          <p className="mt-1 text-xs text-muted">Pekerjaan yang ditugaskan kepada Anda</p>
        </Card>
        <Link href="/approvals?scope=review" className="rounded-xl border border-line bg-white p-5 shadow-panel hover:border-brand/40">
          <p className="text-sm text-muted">Perlu persetujuan Anda</p>
          <p className="mt-2 text-2xl font-bold">{pendingApprovals}</p>
          <p className="mt-1 text-xs text-brand">Buka antrean pemeriksaan →</p>
        </Link>
        <Link href="/pekerjaan-saya/pengajuan" className="rounded-xl border border-line bg-white p-5 shadow-panel hover:border-brand/40">
          <p className="text-sm text-muted">Pengajuan perlu revisi</p>
          <p className="mt-2 text-2xl font-bold">{needRevision}</p>
          <p className="mt-1 text-xs text-brand">Lihat status pengajuan →</p>
        </Link>
      </section>

      {role === "owner" || role === "director" ? (
        <Card className="flex flex-wrap items-center justify-between gap-4 border-brand/20 bg-brand-light/40 p-5">
          <div>
            <p className="font-semibold">Ringkasan perusahaan</p>
            <p className="mt-1 text-sm text-muted">Buka pantauan lintas modul dan pekerjaan perusahaan.</p>
          </div>
          <Link href="/modul/manajemen" className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
            Dashboard eksekutif <ArrowRight size={16} />
          </Link>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-line p-5">
            <div className="flex items-center gap-2">
              <BriefcaseBusiness size={18} className="text-brand" />
              <h2 className="font-semibold">Tugas yang ditugaskan kepada saya</h2>
            </div>
            <p className="mt-1 text-xs text-muted">Status dan tenggat dari modul Operasional.</p>
          </div>
          <div className="divide-y divide-line">
            {taskRows.length ? taskRows.map((task) => {
              const overdue = task.due_on && task.due_on < today
              return (
                <article key={task.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <p className="font-semibold">{task.title}</p>
                    {task.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{task.description}</p>}
                    <p className={`mt-2 text-xs ${overdue ? "font-semibold text-red-700" : "text-muted"}`}>
                      {overdue ? "Terlambat · " : "Tenggat · "}{formatDate(task.due_on)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-canvas px-3 py-1 text-xs">{labels[task.status] ?? task.status}</span>
                    <Link href={`/modul/operasional?type=work_item&edit=${task.id}`} className="text-xs font-semibold text-brand">Usulkan perubahan</Link>
                  </div>
                </article>
              )
            }) : (
              <div className="p-8 text-center">
                <CheckSquare2 className="mx-auto text-brand" size={25} />
                <p className="mt-3 text-sm font-medium">Belum ada tugas operasional yang ditugaskan kepada Anda.</p>
                <p className="mt-1 text-xs text-muted">Tugas baru akan muncul setelah penanggung jawab memilih akun Anda.</p>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <RotateCcw size={17} className="text-brand" />
              <h2 className="font-semibold">Fokus kerja · {role === "owner" ? "Super Admin" : labels[role]}</h2>
            </div>
            <ul className="mt-4 divide-y divide-line">
              {workspaces.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex items-center justify-between gap-3 py-3 hover:text-brand">
                    <span>
                      <span className="block text-sm font-medium">{item.name}</span>
                      <span className="mt-1 block text-xs text-muted">{item.description}</span>
                    </span>
                    <ArrowRight size={15} className="shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <p className="font-semibold">Alur persetujuan</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Pengajuan yang Anda buat dan draft tersimpan ada di Pengajuan saya. Antrean Persetujuan terpisah untuk permintaan yang perlu Anda periksa dan jalankan.
            </p>
            <Link href="/pekerjaan-saya/pengajuan" className="mt-4 inline-block text-sm font-semibold text-brand">Buka pengajuan dan draft →</Link>
          </Card>
        </div>
      </section>
      <p className="text-xs text-muted">{recordSpecs.work_item.label} Anda dimuat sesuai organisasi dan penugasan akun aktif.</p>
    </div>
  )
}
