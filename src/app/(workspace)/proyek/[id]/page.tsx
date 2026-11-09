import Link from "next/link"
import { notFound } from "next/navigation"
import {
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { requireWorkspace } from "@/lib/auth/context"
import { rupiah, formatDateID } from "@/lib/procurement-ui"
import { ProjectPlanningForm } from "@/components/project/project-planning-form"
import { ProjectDirectorConsole, type AttachmentItem, type DirectorInsight } from "@/components/project/project-director-console"
import { ProjectCostingCard, type ProjectCostingData } from "@/components/project/project-costing-card"

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const { id } = await params
  const qParams = await searchParams
  const { supabase, organizationId, user, actorRole, isReadOnlyPreview, workAssignments } = await requireWorkspace()

  // Load project details
  const { data: project, error } = await supabase
    .from("crm_projects")
    .select(`
      *,
      client:sales_clients(name, contact, email),
      branch:business_units(code, name),
      spk:sales_documents!crm_projects_spk_id_fkey(id, document_number, title, amount, valid_until)
    `)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle()

  if (error || !project) {
    notFound()
  }

  // Load procurement events, attachments, and real-time costing
  const attachmentIds = Array.isArray(project.attachment_ids) ? project.attachment_ids : []
  const [eventsRes, attachmentsRes, costingRes] = await Promise.all([
    supabase
      .from("procurement_events")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    attachmentIds.length
      ? supabase
          .from("procurement_attachments")
          .select("id, file_name, content_type, byte_size")
          .in("id", attachmentIds)
      : Promise.resolve({ data: [] }),
    supabase.rpc("get_project_costing", {
      p_org: organizationId,
      p_project_id: id,
    }),
  ])
  const events = eventsRes.data
  const attachmentsData = attachmentsRes.data
  const costingData = (costingRes.data && !(costingRes.data as any).error) ? (costingRes.data as ProjectCostingData) : null

  const projectAttachments: AttachmentItem[] = (attachmentsData ?? []).map((a: any) => ({
    id: a.id,
    file_name: a.file_name,
    content_type: a.content_type,
    byte_size: Number(a.byte_size || 0),
  }))

  // Parse director insights
  let insights: DirectorInsight[] = []
  if (Array.isArray(project.director_insights) && project.director_insights.length > 0) {
    insights = project.director_insights
  } else if (events) {
    insights = events
      .filter((e: any) => e.action === "director_insight_added" || e.action === "submitted_to_directors")
      .map((e: any) => ({
        id: e.id,
        author_name: e.details?.author_role || "Direksi",
        author_role: e.details?.author_role || "Direksi",
        section: e.details?.section || "general",
        comment: e.note || e.action,
        created_at: e.created_at,
      }))
  }

  // Roles & permissions
  const isOwner = actorRole === "owner"
  const isDirut = isOwner || (workAssignments ?? []).some((j) => !j.branch_id && j.job_role === "president")
  const isDirector =
    isOwner ||
    (workAssignments ?? []).some(
      (j) => !j.branch_id && ["president", "technical_director", "finance_director"].includes(j.job_role)
    )
  const isBranchUser = (workAssignments ?? []).some((j) => j.branch_id === project.branch_id)

  const canEdit =
    !isReadOnlyPreview &&
    ["draft", "revision_requested"].includes(project.approval_status) &&
    (isOwner || isBranchUser || project.created_by === user.id)

  const canReview = !isReadOnlyPreview && project.approval_status === "director_review" && isDirut

  const contractVal = Number(project.contract_amount) || 0
  const rabVal = Number(project.rab_total) || 0
  const margin = contractVal > 0 ? ((contractVal - rabVal) / contractVal) * 100 : 0

  const status = project.approval_status || (project.status === "active" ? "active" : "draft")

  return (
    <div className="space-y-6">
      <Link href="/proyek" className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline font-medium">
        <ArrowLeft className="size-4" /> Kembali ke Daftar Proyek
      </Link>

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-100 px-2.5 py-1 text-xs font-mono font-semibold text-slate-800">
              {project.code}
            </span>
            <span className="text-xs font-medium text-muted">Cabang: {project.branch?.name || "Pusat"}</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold text-ink">{project.name}</h1>
          <p className="mt-1 text-sm text-muted">
            Klien: <span className="font-medium text-slate-800">{project.client?.name || "Klien Terdaftar"}</span>
          </p>
        </div>

        <div className="flex flex-col items-end">
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${
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
              ? "✓ Proyek Aktif & Berjalan"
              : status === "director_review"
              ? "⚡ Menunggu Verifikasi Direksi"
              : status === "revision_requested"
              ? "⚠️ Perlu Revisi Cabang"
              : "Draft Perencanaan"}
          </span>
          <span className="mt-1 text-[11px] text-muted font-mono">Versi Dokumen: v{project.version}</span>
        </div>
      </header>

      {/* Alerts */}
      {qParams.notice && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-medium text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <span>{qParams.notice}</span>
        </div>
      )}
      {qParams.error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs font-medium text-red-950 flex items-center gap-2">
          <AlertCircle className="size-4 text-red-600 shrink-0" />
          <span>{qParams.error}</span>
        </div>
      )}

      {/* Project Costing & Realisasi RAB jika Proyek Aktif atau Memiliki Realisasi */}
      {costingData && (status === "active" || costingData.total_realized > 0) ? (
        <ProjectCostingCard
          costing={costingData}
          canTransact={!isReadOnlyPreview && status === "active"}
        />
      ) : (
        <Card className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted">Nilai Kontrak SPK</p>
            <p className="mt-1 text-sm font-semibold text-ink">{rupiah(contractVal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Total Pagu Anggaran (RAB)</p>
            <p className="mt-1 text-sm font-semibold text-brand">{rupiah(rabVal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Estimasi Margin Laba</p>
            <p
              className={`mt-1 text-sm font-bold ${
                margin >= 25 ? "text-emerald-600" : margin > 0 ? "text-amber-600" : "text-red-600"
              }`}
            >
              {margin.toFixed(2)}%
            </p>
          </div>
        </Card>
      )}

      {/* JIKA STATUS DRAFT / REVISI: Mode Pengisian Cabang */}
      {canEdit && (
        <section className="space-y-4">
          {project.approval_status === "revision_requested" && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-5 text-amber-600 shrink-0" />
                <h3 className="font-bold text-amber-950 text-sm">Arahan Revisi dari Direktur Utama</h3>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed pl-7 whitespace-pre-wrap">
                {project.review_note || "Periksa kembali kelengkapan dokumen dan rincian teknis sesuai arahan direksi di bawah."}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-ink">Lengkapi Data Perencanaan Proyek</h2>
            <span className="text-xs text-muted">
              Lengkapi SDM, rincian teknis, jadwal, RAB, lampiran, dan termin sebelum diajukan kembali ke Direksi.
            </span>
          </div>

          <ProjectPlanningForm project={project} disabled={isReadOnlyPreview} />
        </section>
      )}

      {/* KONSOL PEMERIKSAAN DOKUMEN DIREKSI & VERIFIKASI */}
      {(!canEdit || isDirector || isDirut) && (
        <div className="space-y-6">
          {status === "active" && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50/60 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-6 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="font-semibold text-emerald-950">Pagu Anggaran RAB Terkunci (Budget Baseline)</h3>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Proyek ini telah diverifikasi dan disahkan secara resmi oleh Direktur Utama. Seluruh pengeluaran pembelian & kasbon proyek akan diverifikasi terhadap pagu ini.
                  </p>
                </div>
              </div>
              <Link
                href={`/portal-proyek?project=${project.id}`}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition"
              >
                Buka Portal Proyek & MoM →
              </Link>
            </div>
          )}

          {/* Konsol Pemeriksaan Interaktif Direksi */}
          <ProjectDirectorConsole
            project={project}
            attachments={projectAttachments}
            insights={insights}
            isDirut={isDirut}
            isDirector={isDirector}
            canReview={canReview}
            disabled={isReadOnlyPreview}
          />
        </div>
      )}

      {/* Riwayat / Log Aktivitas Proyek */}
      <Card className="p-5">
        <h3 className="font-semibold text-ink text-sm">Riwayat Aktivitas & Log Audit Proyek</h3>
        <ol className="mt-4 space-y-3">
          {(events ?? []).map((e: any) => (
            <li key={e.id} className="border-l-2 border-line pl-4 text-xs">
              <p className="font-semibold text-ink">{e.action}</p>
              {e.note && <p className="mt-0.5 text-muted">{e.note}</p>}
              <time className="mt-1 block text-[11px] text-muted">
                {new Intl.DateTimeFormat("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Bangkok",
                }).format(new Date(e.created_at))}
              </time>
            </li>
          ))}
          {(!events || events.length === 0) && (
            <p className="text-xs text-muted">Belum ada riwayat aktivitas pada proyek ini.</p>
          )}
        </ol>
      </Card>
    </div>
  )
}
