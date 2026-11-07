import Link from "next/link"
import { BriefcaseBusiness, Filter, Clock, CheckCircle2, AlertTriangle, ArrowRight, Layers } from "lucide-react"
import { Card } from "@/components/ui/card"
import { requireWorkspace } from "@/lib/auth/context"
import { rupiah, formatDateID } from "@/lib/procurement-ui"

export default async function ProjectListPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; branch?: string; q?: string; notice?: string; error?: string }>
}) {
  const qParams = await searchParams
  const activeTab = qParams.tab || "semua"
  const selectedBranch = qParams.branch || ""
  const searchQuery = (qParams.q || "").toLowerCase()

  const { supabase, organizationId, user, actorRole, workAssignments } = await requireWorkspace()
  const isOwner = actorRole === "owner"
  const isDirector = (workAssignments ?? []).some(
    (j) => !j.branch_id && ["president", "technical_director", "finance_director"].includes(j.job_role)
  )

  // Load branches & projects
  const [branchesRes, projectsRes] = await Promise.all([
    supabase
      .from("business_units")
      .select("id,code,name,kind")
      .eq("organization_id", organizationId)
      .in("kind", ["branch", "center"])
      .order("code"),
    supabase
      .from("crm_projects")
      .select(`
        id,
        code,
        name,
        status,
        approval_status,
        branch_id,
        client_id,
        spk_id,
        contract_amount,
        rab_total,
        starts_on,
        ends_on,
        created_at,
        client:sales_clients(name),
        branch:business_units(code, name)
      `)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(200),
  ])

  const branches = branchesRes.data ?? []
  let allProjects = (projectsRes.data ?? []) as any[]

  // Filter based on branch scope if not owner/director
  if (!isOwner && !isDirector) {
    const userBranchIds = (workAssignments ?? []).map((j) => j.branch_id).filter(Boolean)
    allProjects = allProjects.filter((p) => userBranchIds.includes(p.branch_id))
  }

  // Filter by selected branch
  if (selectedBranch) {
    allProjects = allProjects.filter((p) => p.branch_id === selectedBranch)
  }

  // Filter by search query
  if (searchQuery) {
    allProjects = allProjects.filter(
      (p) =>
        (p.code || "").toLowerCase().includes(searchQuery) ||
        (p.name || "").toLowerCase().includes(searchQuery) ||
        (p.client?.name || "").toLowerCase().includes(searchQuery)
    )
  }

  // Filter by tab
  const filteredProjects = allProjects.filter((p) => {
    const appStatus = p.approval_status || (p.status === "active" ? "active" : "draft")
    if (activeTab === "draft") return ["draft", "revision_requested"].includes(appStatus)
    if (activeTab === "review") return appStatus === "director_review"
    if (activeTab === "aktif") return appStatus === "active" || p.status === "active"
    if (activeTab === "selesai") return p.status === "completed"
    return true
  })

  // Tab counts
  const draftCount = allProjects.filter((p) => ["draft", "revision_requested"].includes(p.approval_status)).length
  const reviewCount = allProjects.filter((p) => p.approval_status === "director_review").length
  const activeCount = allProjects.filter((p) => p.approval_status === "active" || p.status === "active").length

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand">Operasional & Eksekusi Lapangan</p>
          <h1 className="mt-1 text-3xl font-bold text-ink">Manajemen Proyek</h1>
          <p className="mt-2 text-sm text-muted max-w-3xl leading-6">
            Pusat perencanaan dan pelaksanaan proyek. Proyek dibuat otomatis dari SPK yang disetujui, dilengkapi tim SDM dan RAB oleh cabang, kemudian diverifikasi oleh Direktur Utama.
          </p>
        </div>
      </header>

      {qParams.notice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {qParams.notice}
        </div>
      )}
      {qParams.error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {qParams.error}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Mobilisasi di Cabang</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-ink">{draftCount}</p>
          <p className="mt-1 text-xs text-muted">Proyek dalam tahap pengisian SDM & RAB</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Menunggu Review Direksi</span>
            <AlertTriangle className="size-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-indigo-600">{reviewCount}</p>
          <p className="mt-1 text-xs text-muted">Siap diperiksa Direktur Utama / Direksi</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Proyek Aktif (Running)</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{activeCount}</p>
          <p className="mt-1 text-xs text-muted">Pelaksanaan lapangan & pagu anggaran aktif</p>
        </Card>
      </div>

      {/* Tabs & Filters */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
          <div className="flex gap-2 overflow-x-auto">
            <Link
              href={`/proyek?tab=semua${selectedBranch ? `&branch=${selectedBranch}` : ""}`}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === "semua" ? "bg-brand text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Semua ({allProjects.length})
            </Link>
            <Link
              href={`/proyek?tab=draft${selectedBranch ? `&branch=${selectedBranch}` : ""}`}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === "draft" ? "bg-brand text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Draft Cabang ({draftCount})
            </Link>
            <Link
              href={`/proyek?tab=review${selectedBranch ? `&branch=${selectedBranch}` : ""}`}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === "review" ? "bg-brand text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Review Direksi ({reviewCount})
            </Link>
            <Link
              href={`/proyek?tab=aktif${selectedBranch ? `&branch=${selectedBranch}` : ""}`}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === "aktif" ? "bg-brand text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Proyek Aktif ({activeCount})
            </Link>
          </div>

          {/* Branch filter pills */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted font-medium">Cabang:</span>
            <Link
              href={`/proyek?tab=${activeTab}`}
              className={`rounded px-2.5 py-1 transition ${
                !selectedBranch ? "bg-slate-800 text-white font-medium" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Semua
            </Link>
            {branches.map((b) => (
              <Link
                key={b.id}
                href={`/proyek?tab=${activeTab}&branch=${b.id}`}
                className={`rounded px-2.5 py-1 transition ${
                  selectedBranch === b.id ? "bg-slate-800 text-white font-medium" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {b.code || b.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Project Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-canvas text-muted text-xs">
                <tr>
                  <th className="px-4 py-3">Kode & Proyek</th>
                  <th className="px-4 py-3">Klien</th>
                  <th className="px-4 py-3">Cabang</th>
                  <th className="px-4 py-3 text-right">Nilai SPK</th>
                  <th className="px-4 py-3 text-right">Total RAB</th>
                  <th className="px-4 py-3 text-right">Margin (%)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredProjects.map((p) => {
                  const spkVal = Number(p.contract_amount) || 0
                  const rabVal = Number(p.rab_total) || 0
                  const margin = spkVal > 0 ? ((spkVal - rabVal) / spkVal) * 100 : 0
                  const status = p.approval_status || (p.status === "active" ? "active" : "draft")

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3">
                        <Link href={`/proyek/${p.id}`} className="font-semibold text-brand hover:underline block">
                          {p.code}
                        </Link>
                        <p className="text-xs text-ink line-clamp-1">{p.name}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{p.client?.name || "Klien Terdaftar"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {p.branch?.name || "Pusat"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800 text-xs">
                        {rupiah(spkVal)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-brand text-xs">
                        {rabVal > 0 ? rupiah(rabVal) : <span className="text-muted italic">Belum diisi</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs">
                        {rabVal > 0 ? (
                          <span
                            className={`font-semibold ${
                              margin >= 25 ? "text-emerald-600" : margin > 0 ? "text-amber-600" : "text-red-600"
                            }`}
                          >
                            {margin.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            status === "active"
                              ? "bg-emerald-100 text-emerald-800"
                              : status === "director_review"
                              ? "bg-indigo-100 text-indigo-800"
                              : status === "revision_requested"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {status === "active"
                            ? "Aktif (ACC)"
                            : status === "director_review"
                            ? "Review Dirut"
                            : status === "revision_requested"
                            ? "Revisi Cabang"
                            : "Draft Cabang"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/proyek/${p.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                        >
                          Buka Detail <ArrowRight className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
                {filteredProjects.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-sm text-muted">
                      Tidak ada data proyek pada kategori atau filter cabang ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
