import Link from "next/link"
import { Card } from "@/components/ui/card"
import { requireWorkspace } from "@/lib/auth/context"
import { SubmitButton } from "@/components/procurement/submit-button"
import { ProcurementMessage, ProcurementUnavailable } from "@/components/procurement/section-nav"
import { isProcurementMissing, procurementInput as input, procurementLabel as label, relationshipLabels } from "@/lib/procurement-ui"
import { savePortalEntry, setPortalAccess, configurePortalProject } from "./actions"
import { ProjectPortalView, type PortalEntryItem } from "@/components/project/project-portal-view"

type PortalProject = {
  id: string
  code: string
  name: string
  status: string
  branch_id: string
  is_internal: boolean
  can_submit: boolean
}

export default async function ProjectPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; error?: string; notice?: string }>
}) {
  const q = await searchParams
  const w = await requireWorkspace()
  const owner = w.actorRole === "owner"

  const [projectResult, branches, profiles, members, setupProjects] = await Promise.all([
    w.supabase.rpc("list_portal_projects", { p_org: w.organizationId }),
    w.supabase.from("business_units").select("id,name").eq("organization_id", w.organizationId).in("kind", ["branch", "center"]),
    w.supabase.from("person_profiles").select("user_id,relationship_status").eq("organization_id", w.organizationId).in("relationship_status", ["client", "consultant", "vendor"]),
    w.supabase.from("project_memberships").select("project_id,user_id,member_type,can_submit,is_active").eq("organization_id", w.organizationId),
    owner ? w.supabase.from("crm_projects").select("id,code,name,status").eq("organization_id", w.organizationId).order("code") : Promise.resolve({ data: [], error: null }),
  ])

  const missing = [projectResult.error, branches.error, profiles.error, members.error].some(isProcurementMissing)
  if (!missing && [projectResult.error, branches.error, profiles.error, members.error, setupProjects.error].some(Boolean)) {
    throw new Error("Portal proyek gagal dimuat.")
  }

  const projects = (Array.isArray(projectResult.data) ? projectResult.data : []) as PortalProject[]
  const project = projects.find((p) => p.id === q.project) ?? projects[0]

  // Query entries with resilient fallback
  let portalEntries: PortalEntryItem[] = []
  if (!missing && project) {
    const fullEntries = await w.supabase
      .from("project_portal_entries")
      .select("id,kind,audience,title,body,created_by,created_at,attachment_ids,metadata")
      .eq("organization_id", w.organizationId)
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(100)

    if (fullEntries.error) {
      const basicEntries = await w.supabase
        .from("project_portal_entries")
        .select("id,kind,audience,title,body,created_by,created_at")
        .eq("organization_id", w.organizationId)
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(100)
      portalEntries = (basicEntries.data ?? []) as PortalEntryItem[]
    } else {
      portalEntries = (fullEntries.data ?? []) as PortalEntryItem[]
    }
  }

  // Fetch comments if entries exist
  if (portalEntries.length > 0) {
    const entryIds = portalEntries.map((e) => e.id)
    const { data: commentsData } = await w.supabase
      .from("project_portal_comments")
      .select("id,entry_id,user_id,sender_name,sender_role,message,created_at")
      .in("entry_id", entryIds)
      .order("created_at", { ascending: true })

    if (commentsData && commentsData.length > 0) {
      const commentsByEntry: Record<string, any[]> = {}
      for (const c of commentsData) {
        if (!commentsByEntry[c.entry_id]) commentsByEntry[c.entry_id] = []
        commentsByEntry[c.entry_id].push(c)
      }
      portalEntries = portalEntries.map((e) => ({
        ...e,
        comments: commentsByEntry[e.id] ?? [],
      }))
    }
  }

  const isDirector =
    w.actorRole === "director" ||
    w.role === "director" ||
    w.workAssignments.some((a) => ["president", "finance_director", "technical_director"].includes(a.job_role))

  const isClient = w.relationshipStatus === "client" || (!project?.is_internal && project?.can_submit)
  const isInternal = Boolean(project?.is_internal)
  const canSubmit = Boolean(project && (project.is_internal || project.can_submit) && !w.isReadOnlyPreview)

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-brand">Kolaborasi 2 Arah Perusahaan & Pihak Klien</p>
        <h1 className="mt-2 text-3xl font-bold">Portal Proyek & Komunikasi Klien</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Pantau laporan proyek, sampaikan kebutuhan data pendukung (Amdalnet), serta kelola notulensi rapat (MoM) dengan
          ringkasan Smart OCR AI. MoM resmi dikunci permanen untuk menjaga integritas berita acara, dan dilengkapi forum
          tanya-jawab 2 arah bersama PIC Proyek.
        </p>
      </header>

      <ProcurementMessage error={q.error} notice={q.notice} />

      {missing ? (
        <ProcurementUnavailable />
      ) : (
        <>
          {/* Owner Project Branch Setup & Access Delegation */}
          {owner && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-5">
                <h2 className="font-semibold text-sm">Tetapkan Cabang Proyek</h2>
                <p className="mt-1 text-xs text-muted">
                  Pilih proyek dari CRM dan tetapkan cabang operasionalnya sebelum memulai portal.
                </p>
                <form action={configurePortalProject} className="mt-4 space-y-3">
                  <fieldset disabled={w.isReadOnlyPreview} className="space-y-3">
                    <label className={label}>
                      Proyek belum dialokasikan
                      <select name="project_id" required className={input}>
                        <option value="">Pilih proyek</option>
                        {(setupProjects.data ?? [])
                          .filter((p) => !projects.some((scoped) => scoped.id === p.id))
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code} · {p.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className={label}>
                      Cabang operasional
                      <select name="branch_id" required className={input}>
                        <option value="">Pilih cabang</option>
                        {branches.data?.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <SubmitButton>Tetapkan cabang</SubmitButton>
                  </fieldset>
                </form>
              </Card>

              <Card className="p-5">
                <h2 className="font-semibold text-sm">Akses Pihak Eksternal (Klien / Konsultan)</h2>
                <p className="mt-1 text-xs text-muted">
                  Berikan izin akses portal proyek kepada akun pengguna eksternal.
                </p>
                <form action={setPortalAccess} className="mt-4 space-y-3">
                  <fieldset disabled={w.isReadOnlyPreview} className="grid gap-3 sm:grid-cols-2">
                    <label className={label}>
                      Proyek
                      <select name="project_id" required className={input}>
                        <option value="">Pilih proyek</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} · {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={label}>
                      Cabang proyek
                      <select name="branch_id" required className={input}>
                        <option value="">Pilih cabang</option>
                        {branches.data?.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={label}>
                      Akun pengguna
                      <select name="user_id" required className={input}>
                        <option value="">Pilih akun</option>
                        {profiles.data?.map((p) => (
                          <option key={p.user_id} value={p.user_id}>
                            {relationshipLabels[p.relationship_status]} · {p.user_id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={label}>
                      Jenis pihak
                      <select name="member_type" required className={input}>
                        <option value="client">Klien</option>
                        <option value="consultant">Konsultan / Ahli</option>
                        <option value="vendor">Vendor</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs sm:col-span-2">
                      <input name="can_submit" type="checkbox" className="rounded border-line" />
                      <span>Boleh mengirimkan permintaan data / instruksi / respons</span>
                    </label>
                    <div className="sm:col-span-2">
                      <SubmitButton disabled={!profiles.data?.length || !projects.length}>
                        Simpan akses proyek
                      </SubmitButton>
                    </div>
                  </fieldset>
                </form>
              </Card>
            </div>
          )}

          {/* Project Selector Tab Navigation */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Pilih Proyek Aktif</h3>
            <nav aria-label="Pilih proyek" className="flex flex-wrap gap-2">
              {projects.map((p) => (
                <Link
                  href={`/portal-proyek?project=${p.id}`}
                  key={p.id}
                  aria-current={p.id === project?.id ? "page" : undefined}
                  className={`rounded-xl border px-4 py-2.5 text-xs font-medium transition ${
                    p.id === project?.id
                      ? "border-brand bg-brand text-white shadow-sm"
                      : "border-line bg-white hover:bg-slate-50 text-ink"
                  }`}
                >
                  <span className="font-bold">{p.code}</span> · {p.name}
                </Link>
              ))}
            </nav>
          </div>

          {!project && (
            <Card className="p-8 text-center text-sm text-muted">
              Belum ada proyek aktif yang dialokasikan ke akun Anda.{" "}
              {owner
                ? "Pastikan proyek telah disetujui di CRM dan cabangnya telah ditetapkan."
                : "Perusahaan akan memberikan akses sesuai penugasan proyek aktif Anda."}
            </Card>
          )}

          {project && (
            <div className="space-y-6">
              {/* Project Header Info */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand/20 bg-gradient-to-r from-emerald-50/50 to-teal-50/30 p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                      Proyek Aktif
                    </span>
                    <span className="text-xs text-muted font-mono">{project.code}</span>
                  </div>
                  <h2 className="mt-1 text-xl font-bold text-ink">{project.name}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/proyek/${project.id}`}
                    className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Buka Detail Proyek →
                  </Link>
                </div>
              </div>

              {/* Interactive 2-Way Collaboration & MoM View */}
              <ProjectPortalView
                projectId={project.id}
                branchId={project.branch_id}
                isInternal={isInternal}
                isDirector={isDirector}
                isClient={isClient}
                canSubmit={canSubmit}
                entries={portalEntries}
                disabled={w.isReadOnlyPreview}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
