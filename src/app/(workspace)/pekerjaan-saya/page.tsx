import { ArrowRight, BriefcaseBusiness, CheckSquare2, RotateCcw } from "lucide-react"
import { Card } from "@/components/ui/card"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { MigrationNotice } from "@/components/workflow/migration-notice"
import { requireWorkspace } from "@/lib/auth/context"
import { calendarDate } from "@/lib/dashboard"
import { isWorkflowMissing, labels } from "@/lib/workflow"
import { BusinessSummary } from "@/components/dashboard/business-summary"
import { loadBusinessSummary } from "@/lib/business-summary"
import { PersonalNav } from "@/components/workflow/personal-nav"
import { loadDirectorDashboard } from "@/lib/director-dashboard"
import { BranchReportView } from "@/components/director/branch-report-view"
import { HistoricalFinancialChart } from "@/components/director/historical-financial-chart"
import { ActiveProjectsSection } from "@/components/director/active-projects-section"
import { SalesKpiCards } from "@/components/director/sales-kpi-cards"
import { DirectorPurchaseQueue } from "@/components/director/director-purchase-queue"
import { DirectorSphQueue } from "@/components/director/director-sph-queue"
import { DirectorSpkQueue } from "@/components/director/director-spk-queue"

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

export default async function MyWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sales_tab?: string }>
}) {
  const query = await searchParams
  const { supabase, organizationId, user, role, actorRole, workAssignments } = await requireWorkspace()

  const isDirector =
    role === "owner" ||
    role === "director" ||
    actorRole === "owner" ||
    actorRole === "director" ||
    workAssignments.some((j) =>
      ["president", "finance_director", "technical_director"].includes(j.job_role)
    )

  const businessSummaryPromise = loadBusinessSummary(supabase, organizationId, { includeReport: false })
  
  // Load tasks, approvals, revisions
  const [tasks, approvals, revisions, directorData, branchesRes, pendingPurchasesRes, pendingSphRes, pendingSpkRes] =
    await Promise.all([
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
      isDirector ? loadDirectorDashboard(supabase, organizationId) : Promise.resolve(null),
      supabase.from("business_units").select("id, name").eq("organization_id", organizationId),
      // Purchases needing director review
      isDirector
        ? supabase
            .from("purchase_requests")
            .select("id, invoice_number, invoice_date, branch_id, vendor_id, vendor_snapshot, status, payable_amount, created_at")
            .eq("organization_id", organizationId)
            .eq("status", "director_review")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      // SPH needing director review
      isDirector
        ? supabase
            .from("sales_documents")
            .select("id, sph_number, branch_id, title, work_scopes, amount, status, created_at")
            .eq("organization_id", organizationId)
            .eq("kind", "sph")
            .eq("status", "director_review")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      // SPK documents
      isDirector
        ? supabase
            .from("sales_documents")
            .select("id, title, branch_id, client_id, client_snapshot, status, notes, created_at")
            .eq("organization_id", organizationId)
            .eq("kind", "spk")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
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

  const branches = branchesRes.data ?? []
  const pendingPurchases = (pendingPurchasesRes.data ?? []).map((p) => {
    const branch = branches.find((b) => b.id === p.branch_id)
    return {
      ...p,
      branch_name: branch?.name ?? "Cabang",
      vendor_name: (p.vendor_snapshot as { name?: string })?.name ?? "Vendor",
    }
  })

  const pendingSph = (pendingSphRes.data ?? []).map((s) => {
    const branch = branches.find((b) => b.id === s.branch_id)
    return {
      ...s,
      branch_name: branch?.name ?? "Cabang",
    }
  })

  const pendingSpk = (pendingSpkRes.data ?? []).map((k) => {
    const branch = branches.find((b) => b.id === k.branch_id)
    return {
      ...k,
      branch_name: branch?.name ?? "Cabang",
      client_name: (k.client_snapshot as { name?: string })?.name ?? "Klien",
    }
  })

  const activeSalesTab = query.sales_tab === "spk" ? "spk" : "sph"

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium text-brand">Ruang kerja pribadi</p>
        <h1 className="mt-2 text-3xl font-bold">Pekerjaan saya</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          {isDirector
            ? "Portal terpadu Direksi: pantau laporan keuangan cabang & konsolidasi, proyek aktif, perbandingan 3 tahun, serta verifikasi pengajuan pembelian dan penjualan (SPH & SPK)."
            : "Tugas yang ditugaskan kepada Anda, tindakan yang menunggu kewenangan Anda, dan pintasan kerja berdasarkan peran."}
        </p>
      </header>

      <PersonalNav active="work" isDirector={isDirector} />

      {/* ========================================================================= */}
      {/* KHUSUS DIREKTUR / DIREKSI / OWNER: EXECUTIVE WORKSPACE & REPORTS */}
      {/* ========================================================================= */}
      {isDirector && directorData && (
        <section aria-label="Ruang Kerja Direktur" className="space-y-8 rounded-2xl border border-brand/20 bg-slate-50/50 p-6 shadow-sm">
          <div className="border-b border-line pb-4">
            <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand">
              Ruang Kerja Direktur
            </span>
            <h2 className="mt-2 text-2xl font-bold text-ink">
              Dashboard Eksekutif & Verifikasi Terpadu
            </h2>
            <p className="mt-1 text-xs text-muted">
              Laporan per cabang & perbandingan konsolidasi, ringkasan proyek aktif, grafik komparasi 3 tahun, dan antrean verifikasi direksi.
            </p>
          </div>

          {/* 1. Laporan Per Cabang & Konsolidasi Perusahaan */}
          <BranchReportView
            consolidated={directorData.financialSummary.consolidated}
            byBranch={directorData.financialSummary.byBranch}
          />

          {/* 1c. Grafik Perbandingan 3 Tahun Terakhir */}
          <HistoricalFinancialChart data={directorData.historicalComparison} />

          {/* 1b. Ringkasan Proyek Aktif */}
          <ActiveProjectsSection projects={directorData.activeProjects.list} />

          {/* 2. Pengajuan Pembelian Butuh Verifikasi */}
          <div className="pt-4 border-t border-line">
            <DirectorPurchaseQueue purchases={pendingPurchases} />
          </div>

          {/* 3 & 4. Penjualan Butuh Verifikasi & Ringkasan Kinerja Penjualan */}
          <div className="pt-6 border-t border-line space-y-6">
            <SalesKpiCards kpi={directorData.salesKpi} />

            {/* Pemisahan Menu/Tab Penjualan: SPH Sendiri & SPK Sendiri */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div className="flex gap-2">
                  <Link
                    href="/pekerjaan-saya?sales_tab=sph"
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      activeSalesTab === "sph"
                        ? "bg-brand text-white shadow-sm"
                        : "bg-white text-muted hover:bg-canvas"
                    }`}
                  >
                    1. SPH Butuh Verifikasi ({pendingSph.length})
                  </Link>
                  <Link
                    href="/pekerjaan-saya?sales_tab=spk"
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      activeSalesTab === "spk"
                        ? "bg-brand text-white shadow-sm"
                        : "bg-white text-muted hover:bg-canvas"
                    }`}
                  >
                    2. SPK Butuh Verifikasi ({pendingSpk.length})
                  </Link>
                </div>
              </div>

              {activeSalesTab === "sph" ? (
                <DirectorSphQueue sphList={pendingSph} />
              ) : (
                <DirectorSpkQueue spkList={pendingSpk} />
              )}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAMPILAN OPERASIONAL & PINTASAN PRIBADI REGULER */}
      {/* ========================================================================= */}
      <Card className="p-5">
        <h2 className="font-semibold">Pengajuan saya</h2>
        <p className="mt-2 text-sm text-muted">
          Pantau dokumen, draft dan pengajuan yang Anda buat sendiri.
        </p>
        <Link
          href="/pekerjaan-saya/pengajuan"
          className="mt-3 inline-block text-sm font-semibold text-brand"
        >
          Buka pengajuan saya &rarr;
        </Link>
      </Card>

      <BusinessSummary summary={businessSummary} queueOnly />

      <section aria-label="Ringkasan pekerjaan" className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted">Tugas belum selesai</p>
          <p className="mt-2 text-2xl font-bold">{taskRows.length}</p>
          <p className="mt-1 text-xs text-muted">Pekerjaan yang ditugaskan kepada Anda</p>
        </Card>
        <Link
          href="/approvals?scope=review"
          className="rounded-xl border border-line bg-white p-5 shadow-panel hover:border-brand/40"
        >
          <p className="text-sm text-muted">Perlu persetujuan Anda</p>
          <p className="mt-2 text-2xl font-bold">{pendingApprovals}</p>
          <p className="mt-1 text-xs text-brand">Buka antrean pemeriksaan &rarr;</p>
        </Link>
        <Link
          href="/pekerjaan-saya/pengajuan"
          className="rounded-xl border border-line bg-white p-5 shadow-panel hover:border-brand/40"
        >
          <p className="text-sm text-muted">Pengajuan perlu revisi</p>
          <p className="mt-2 text-2xl font-bold">{needRevision}</p>
          <p className="mt-1 text-xs text-brand">Lihat status pengajuan &rarr;</p>
        </Link>
      </section>

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
            {taskRows.length ? (
              taskRows.map((task) => {
                const overdue = task.due_on && task.due_on < today
                return (
                  <article key={task.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <p className="font-semibold">{task.title}</p>
                      {task.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted">{task.description}</p>
                      )}
                      <p className={`mt-2 text-xs ${overdue ? "font-semibold text-red-700" : "text-muted"}`}>
                        {overdue ? "Terlambat &bull; " : "Tenggat &bull; "}
                        {formatDate(task.due_on)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-canvas px-3 py-1 text-xs">
                        {labels[task.status] ?? task.status}
                      </span>
                      <Link
                        href={`/modul/operasional?type=work_item&edit=${task.id}`}
                        className="text-xs font-semibold text-brand"
                      >
                        Usulkan perubahan
                      </Link>
                    </div>
                  </article>
                )
              })
            ) : (
              <div className="p-8 text-center">
                <CheckSquare2 className="mx-auto text-brand" size={25} />
                <p className="mt-3 text-sm font-medium">Belum ada tugas operasional yang ditugaskan kepada Anda.</p>
                <p className="mt-1 text-xs text-muted">
                  Tugas baru akan muncul setelah penanggung jawab memilih akun Anda.
                </p>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <RotateCcw size={17} className="text-brand" />
              <h2 className="font-semibold">
                Fokus kerja &bull; {role === "owner" ? "Super Admin" : labels[role]}
              </h2>
            </div>
            <ul className="mt-4 divide-y divide-line">
              {workspaces.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 py-3 hover:text-brand"
                  >
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
        </div>
      </section>
    </div>
  )
}
