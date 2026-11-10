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
  Users,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { requireWorkspace } from "@/lib/auth/context"
import { rupiah, formatDateID } from "@/lib/procurement-ui"
import { ProjectPlanningForm } from "@/components/project/project-planning-form"
import { ProjectDirectorConsole, type AttachmentItem, type DirectorInsight } from "@/components/project/project-director-console"
import { ProjectCostingCard, type ProjectCostingData } from "@/components/project/project-costing-card"
import { loadOrganizationActorDirectory, buildWorkflowAuditSummary } from "@/lib/audit-trail"
import { AuditWorkflowTimeline } from "@/components/procurement/audit-workflow-timeline"
import { provisionProjectClientAction } from "../actions"

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
      spk:sales_documents!crm_projects_spk_id_fkey(id, document_number, title, amount, valid_until, attachment_ids, accepted_sph_id)
    `)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle()

  if (error || !project) {
    notFound()
  }

  // Also query referenced SPH if available through SPK
  const sphRes = (project.spk as any)?.accepted_sph_id
    ? await supabase
        .from("sales_documents")
        .select("id, sph_number, title, attachment_ids")
        .eq("id", (project.spk as any).accepted_sph_id)
        .maybeSingle()
    : { data: null }

  // Unified attachment collection: project files + SPK files + SPH files
  const projectAttIds = Array.isArray(project.attachment_ids) ? (project.attachment_ids as string[]) : []
  const spkAttIds = Array.isArray((project.spk as any)?.attachment_ids) ? ((project.spk as any).attachment_ids as string[]) : []
  const sphAttIds = Array.isArray(sphRes.data?.attachment_ids) ? (sphRes.data.attachment_ids as string[]) : []
  const allAttachmentIds = Array.from(new Set([...projectAttIds, ...spkAttIds, ...sphAttIds]))

  // Load procurement events, attachments, costing, actor directory, and client portal access
  const [eventsRes, attachmentsRes, costingRes, actorDir, clientMembershipRes, orgUsersRes, clientInfoRes] = await Promise.all([
    supabase
      .from("procurement_events")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    allAttachmentIds.length
      ? supabase
          .from("procurement_attachments")
          .select("id, file_name, content_type, byte_size")
          .in("id", allAttachmentIds)
      : Promise.resolve({ data: [] }),
    supabase.rpc("get_project_costing", {
      p_org: organizationId,
      p_project_id: id,
    }),
    loadOrganizationActorDirectory(supabase, organizationId, user),
    supabase
      .from("project_memberships")
      .select("user_id, member_type, can_submit, is_active, created_at")
      .eq("organization_id", organizationId)
      .eq("project_id", id)
      .eq("member_type", "client")
      .maybeSingle(),
    supabase.rpc("list_organization_users", { p_org: organizationId }),
    supabase.rpc("get_project_client_info", { p_project_id: id }),
  ])
  const events = eventsRes.data
  const attachmentsData = attachmentsRes.data
  const costingData = (costingRes.data && !(costingRes.data as any).error) ? (costingRes.data as ProjectCostingData) : null
  const clientMembership = clientMembershipRes.data
  const clientUser = (orgUsersRes.data as any[])?.find((u) => u.user_id === clientMembership?.user_id)
  const clientRpcInfo = clientInfoRes.data as any
  const isConnected = Boolean(clientRpcInfo?.is_connected || clientMembership?.is_active)
  const connectedEmail = clientRpcInfo?.email || clientUser?.email || ""
  const connectedName = clientRpcInfo?.full_name || clientUser?.full_name || ""

  const projectAttachments: AttachmentItem[] = (attachmentsData ?? []).map((a: any) => {
    let sourceLabel = "Lampiran Proyek & RAB"
    let category: "rab" | "spk" | "sph" | "general" = "general"

    const isRabName = a.file_name.toLowerCase().includes("rab") || a.file_name.toLowerCase().includes("biaya") || a.file_name.toLowerCase().includes("budget")
    if (isRabName || projectAttIds.includes(a.id)) {
      sourceLabel = "Berkas RAB & Perencanaan Proyek"
      category = "rab"
    } else if (spkAttIds.includes(a.id)) {
      sourceLabel = `Kontrak SPK (${(project.spk as any)?.document_number || "SPK"})`
      category = "spk"
    } else if (sphAttIds.includes(a.id)) {
      sourceLabel = `Penawaran SPH (${sphRes.data?.sph_number ? `SPH/${sphRes.data.sph_number}` : "SPH"})`
      category = "sph"
    }

    return {
      id: a.id,
      file_name: a.file_name,
      content_type: a.content_type,
      byte_size: Number(a.byte_size || 0),
      source_label: sourceLabel,
      category,
    }
  })

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
  const projectAuditSummary = buildWorkflowAuditSummary({
    entityKind: "project",
    documentLabel: `${project.code} · ${project.name}`,
    currentStatus: status,
    createdByUserId: project.created_by,
    createdAt: project.created_at,
    branchId: project.branch_id,
    branchName: project.branch?.name || "Cabang",
    events: (events ?? []) as any,
    actorMap: actorDir.actorMap,
    findRoleHolder: actorDir.findRoleHolder,
  })

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

      {/* KARTU AKSES PORTAL KLIEN 2 ARAH (PERMINTAAN DATA, AMDALNET & MOM) */}
      <Card className="p-5 border-brand/20 bg-gradient-to-r from-teal-50/40 via-white to-blue-50/30 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600/10 text-teal-700">
              <Users className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Portal Kolaborasi Klien 2 Arah (Permintaan Data & MoM)
                </h3>
                {isConnected ? (
                  <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    ✓ Aktif 2 Arah
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    Belum Terhubung
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">
                Klien dapat mengunggah berkas pendukung (Amdalnet), membaca notulensi rapat resmi (MoM), serta tanya-jawab 2 arah bersama PIC Proyek.
              </p>
            </div>
          </div>

          <Link
            href={`/portal-proyek?project=${project.id}`}
            className="rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 transition"
          >
            Buka Portal Proyek →
          </Link>
        </div>

        {isConnected ? (
          <div className="mt-2 rounded-lg bg-white/90 p-3 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-semibold text-slate-900">
                Akun Klien Terhubung: <span className="text-teal-700 font-bold">{connectedEmail || "Akun Klien Aktif"}</span>
                {connectedName ? ` (${connectedName})` : ""}
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                Izin Interaksi: <strong>Dua Arah</strong> (Dapat mengirim permintaan data, merespons instruksi, dan menulis komentar MoM)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-100 px-2.5 py-1 text-[11px] font-mono text-slate-600">
                Kredensial Default: KlienGSP2026!
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-2 rounded-lg bg-white/90 p-4 border border-amber-200">
            <p className="text-xs font-semibold text-slate-800 mb-2">
              ⚡ Buat atau Hubungkan Akun Klien Otomatis untuk Proyek Ini:
            </p>
            <form action={provisionProjectClientAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="project_id" value={project.id} />
              <input
                type="email"
                name="client_email"
                required
                defaultValue={project.client?.email || ""}
                placeholder="Email Resmi Klien Proyek (misal: klien@perusahaan.com)"
                className="h-8 rounded border border-line px-3 text-xs flex-1 min-w-[220px]"
              />
              <input
                type="text"
                name="client_name"
                defaultValue={project.client?.name || ""}
                placeholder="Nama PIC Klien"
                className="h-8 rounded border border-line px-3 text-xs w-48"
              />
              <button
                type="submit"
                disabled={isReadOnlyPreview}
                className="h-8 rounded bg-teal-700 px-4 text-xs font-semibold text-white hover:bg-teal-800 transition disabled:opacity-50"
              >
                + Buat & Aktifkan Akun Klien
              </button>
            </form>
            <p className="text-[11px] text-muted mt-2">
              Setiap proyek memiliki akun klien masing-masing. Sistem otomatis membuat akun baru di database dan mengunci hak interaksi 2 arah hanya untuk proyek ini tanpa perlu query SQL manual.
            </p>
          </div>
        )}
      </Card>

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

          <ProjectPlanningForm project={{ ...project, attachment_ids: allAttachmentIds }} disabled={isReadOnlyPreview} />
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

      {/* Riwayat / Log Aktivitas Proyek & KPI Waktu Pengerjaan */}
      <AuditWorkflowTimeline
        summary={projectAuditSummary}
        title="Riwayat Proyek, Posisi Dokumen & KPI Waktu Pengerjaan"
      />
    </div>
  )
}
