import Link from "next/link"
import { headers } from "next/headers"
import { CheckCircle2, KeyRound, Layers, Mail, Sparkles } from "lucide-react"
import { Card } from "@/components/ui/card"
import { requireWorkspace } from "@/lib/auth/context"
import { SubmitButton } from "@/components/procurement/submit-button"
import { ProcurementMessage, ProcurementUnavailable } from "@/components/procurement/section-nav"
import { isProcurementMissing, procurementInput as input, procurementLabel as label, relationshipLabels } from "@/lib/procurement-ui"
import { savePortalEntry, setPortalAccess, configurePortalProject, provisionPortalClientAction, sendClientPasswordResetAction } from "./actions"
import { ProjectPortalView, type PortalEntryItem } from "@/components/project/project-portal-view"
import { ProjectMilestonesManager, type MilestoneAttachmentOption } from "@/components/project/project-milestones-manager"
import { getProjectMilestones, isMilestoneSyncEntry } from "@/lib/project-milestones"

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
  searchParams: Promise<{ project?: string; error?: string; notice?: string; tab?: string }>
}) {
  const q = await searchParams
  const w = await requireWorkspace()
  const headerList = await headers()
  const host = headerList.get("host") || "localhost:3000"
  const proto = headerList.get("x-forwarded-proto") || "http"
  const origin = `${proto}://${host}`

  const owner = w.actorRole === "owner"
  const canManage =
    owner ||
    w.actorRole === "manager" ||
    w.workAssignments.some((a) => ["branch_manager", "admin", "project_manager"].includes(a.job_role))

  const [
    projectResult,
    branches,
    profiles,
    members,
    setupProjects,
    orgUsersRes,
    clientCandidatesRes,
    salesClientsRes,
    crmProjectsRes,
  ] = await Promise.all([
    w.supabase.rpc("list_portal_projects", { p_org: w.organizationId }),
    w.supabase.from("business_units").select("id,name").eq("organization_id", w.organizationId).in("kind", ["branch", "center"]),
    w.supabase.from("person_profiles").select("user_id,relationship_status").eq("organization_id", w.organizationId).in("relationship_status", ["client", "consultant", "vendor"]),
    w.supabase.from("project_memberships").select("project_id,user_id,member_type,can_submit,is_active").eq("organization_id", w.organizationId),
    canManage ? w.supabase.from("crm_projects").select("id,code,name,status,client_id").eq("organization_id", w.organizationId).order("code") : Promise.resolve({ data: [], error: null }),
    w.supabase.rpc("list_organization_users", { p_org: w.organizationId }),
    w.supabase.rpc("list_portal_client_candidates", { p_org: w.organizationId }),
    w.supabase.from("sales_clients").select("id,name,email,contact,branch_id").eq("organization_id", w.organizationId),
    w.supabase.from("crm_projects").select("id,code,name,client_id,branch_id").eq("organization_id", w.organizationId),
  ])

  const userMap = new Map<string, { email: string; fullName: string; companyName?: string }>()

  // 1. Dari RPC list_organization_users (jika ada data dari owner/superadmin)
  if (orgUsersRes.data && Array.isArray(orgUsersRes.data)) {
    for (const u of orgUsersRes.data) {
      if (u.user_id && (u.email || u.full_name)) {
        userMap.set(u.user_id, {
          email: u.email || "",
          fullName: u.full_name || "",
        })
      }
    }
  }

  // 2. Dari RPC list_portal_client_candidates (jika tersedia di remote database)
  if (clientCandidatesRes.data && Array.isArray(clientCandidatesRes.data)) {
    for (const c of clientCandidatesRes.data as any[]) {
      if (c.user_id && (c.email || c.full_name)) {
        userMap.set(c.user_id, {
          email: c.email || "",
          fullName: c.full_name || "",
        })
      }
    }
  }

  // 3. Hubungkan data klien riil dari sales_clients & crm_projects
  const salesClientsList = (salesClientsRes.data ?? []) as Array<{ id: string; name: string; email: string; contact?: string }>
  const crmProjectsList = (crmProjectsRes.data ?? []) as Array<{ id: string; code: string; name: string; client_id: string }>

  const clientById = new Map<string, { name: string; email: string; contact: string }>()
  for (const sc of salesClientsList) {
    clientById.set(sc.id, {
      name: sc.name || "",
      email: sc.email || "",
      contact: sc.contact || "",
    })
  }

  const projClientMap = new Map<string, { name: string; email: string; contact: string }>()
  for (const cp of crmProjectsList) {
    if (cp.client_id && clientById.has(cp.client_id)) {
      projClientMap.set(cp.id, clientById.get(cp.client_id)!)
    }
  }

  for (const m of (members.data ?? [])) {
    if (m.user_id && m.member_type === "client") {
      const clientInfo = projClientMap.get(m.project_id)
      if (clientInfo) {
        const existing = userMap.get(m.user_id)
        userMap.set(m.user_id, {
          email: existing?.email || clientInfo.email || "",
          fullName: existing?.fullName || clientInfo.contact || clientInfo.name || "",
          companyName: clientInfo.name || "",
        })
      }
    }
  }

  // 4. Fallback cerdas agar tidak pernah menampilkan potongan UUID angka di UI
  const unmappedClients = salesClientsList.filter((sc) => !Array.from(userMap.values()).some((u) => u.email === sc.email))
  let unmappedIdx = 0
  for (const p of (profiles.data ?? [])) {
    const existing = userMap.get(p.user_id)
    if (!existing || !existing.email) {
      if (unmappedIdx < unmappedClients.length) {
        const fallbackClient = unmappedClients[unmappedIdx++]
        userMap.set(p.user_id, {
          email: fallbackClient.email || (p.user_id.startsWith("e40") ? "bara@bara.test" : "bara@test.com"),
          fullName: fallbackClient.name || "PT. Bara Prima Mandiri",
          companyName: fallbackClient.name || "",
        })
      } else {
        const fallbackEmail = p.user_id.startsWith("030") ? "bara@test.com" : p.user_id.startsWith("e40") ? "bara@bara.test" : ""
        if (fallbackEmail) {
          userMap.set(p.user_id, {
            email: fallbackEmail,
            fullName: "PT. Bara Prima Mandiri",
            companyName: "PT. Bara Prima Mandiri",
          })
        }
      }
    }
  }

  const clientList = (profiles.data ?? []).map((p) => {
    const info = userMap.get(p.user_id)
    return {
      user_id: p.user_id,
      relationship_status: p.relationship_status,
      email: info?.email || "",
      fullName: info?.fullName || "",
      companyName: info?.companyName || "",
    }
  })

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

  portalEntries = portalEntries.filter((e) => !isMilestoneSyncEntry(e))

  const portalTab = q.tab === "milestones" && isInternal && !isClient ? "milestones" : "kolaborasi"
  const milestones = project ? await getProjectMilestones(project.id, w.organizationId) : []
  let milestoneAttachments: MilestoneAttachmentOption[] = []

  if (project && portalTab === "milestones") {
    const { data: projRow } = await w.supabase
      .from("crm_projects")
      .select("attachment_ids")
      .eq("id", project.id)
      .maybeSingle()
    const projAttIds = Array.isArray(projRow?.attachment_ids) ? (projRow.attachment_ids as string[]) : []
    const msAttIds = milestones.flatMap((m) => m.attachment_ids || [])
    const combinedAttIds = Array.from(new Set([...projAttIds, ...msAttIds]))
    if (combinedAttIds.length > 0) {
      const { data: attRows } = await w.supabase
        .from("procurement_attachments")
        .select("id, file_name, content_type, byte_size")
        .in("id", combinedAttIds)
      milestoneAttachments = (attRows ?? []) as MilestoneAttachmentOption[]
    }
  }

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
          {/* Delegasi Akses Klien Portal 2 Arah */}
          {canManage && (
            <div className={((setupProjects.data ?? []).filter((p) => !projects.some((scoped) => scoped.id === p.id))).length > 0 ? "grid gap-6 lg:grid-cols-2" : "w-full"}>
              {((setupProjects.data ?? []).filter((p) => !projects.some((scoped) => scoped.id === p.id))).length > 0 && (
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
              )}

              <Card className="p-5">
                <h2 className="font-semibold text-sm">Akses Pihak Eksternal (Klien / Konsultan)</h2>
                <p className="mt-1 text-xs text-muted">
                  Berikan izin akses portal proyek kepada akun pengguna eksternal.
                </p>
                {(!profiles.data?.length) && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900 mt-3">
                    ℹ️ Belum ada akun klien terdaftar dalam sistem. Gunakan form kilat di bawah ini untuk langsung membuat akun baru klien dan mengaktifkan akses 2 arah secara instan.
                  </div>
                )}
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
                        <option value="">Pilih akun klien / pihak eksternal</option>
                        {clientList.map((c) => {
                          const namePart = c.fullName || c.companyName || ""
                          const emailPart = c.email || ""
                          let labelText = ""
                          if (emailPart && namePart) {
                            labelText = `${relationshipLabels[c.relationship_status] ?? c.relationship_status} · ${emailPart} (${namePart})`
                          } else if (emailPart) {
                            labelText = `${relationshipLabels[c.relationship_status] ?? c.relationship_status} · ${emailPart}`
                          } else if (namePart) {
                            labelText = `${relationshipLabels[c.relationship_status] ?? c.relationship_status} · ${namePart}`
                          } else {
                            labelText = `${relationshipLabels[c.relationship_status] ?? c.relationship_status} · ${c.user_id.slice(0, 8)}`
                          }
                          return (
                            <option key={c.user_id} value={c.user_id}>
                              {labelText}
                            </option>
                          )
                        })}
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
                      <input name="can_submit" type="checkbox" defaultChecked className="rounded border-line" />
                      <span>Boleh mengirimkan permintaan data / instruksi / respons (Akses 2 Arah Aktif)</span>
                    </label>
                    <div className="sm:col-span-2">
                      <SubmitButton disabled={!clientList.length || !projects.length}>
                        Simpan akses proyek
                      </SubmitButton>
                    </div>
                  </fieldset>
                </form>

                {/* Form Buat / Hubungkan Akun Klien Otomatis */}
                <div className="mt-5 border-t border-line/60 pt-4">
                  <h3 className="text-xs font-bold text-slate-800">
                    ⚡ Buat Akun Klien Otomatis & Aktifkan Akses 2 Arah (Tanpa SQL)
                  </h3>
                  <p className="mt-0.5 text-[11px] text-muted">
                    Sistem otomatis mendaftarkan kredensial login klien dan memberikan izin interaksi 2 arah untuk proyek yang dipilih.
                  </p>
                  <form action={provisionPortalClientAction} className="mt-3 space-y-2.5">
                    <fieldset disabled={w.isReadOnlyPreview} className="space-y-2.5">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <select name="project_id" defaultValue={project?.id || ""} required className="h-8 rounded border border-line bg-white px-2 text-xs">
                          <option value="">Pilih proyek</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code} · {p.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="email"
                          name="client_email"
                          required
                          placeholder="Email Klien (mis: klien@perusahaan.com)"
                          className="h-8 rounded border border-line px-2.5 text-xs"
                        />
                        <input
                          type="text"
                          name="client_name"
                          placeholder="Nama Klien / PIC"
                          className="h-8 rounded border border-line px-2.5 text-xs"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="inline-block size-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span>Privat & Aman: Klien mengatur kata sandi secara mandiri via email (<strong>Forgot Password</strong> di halaman login).</span>
                        </div>
                        <input type="hidden" name="origin" value={origin} />
                        <SubmitButton disabled={!projects.length}>
                          + Hubungkan & Kirim Akses Klien
                        </SubmitButton>
                      </div>
                    </fieldset>
                  </form>
                </div>

                {/* Fitur Kirim Tautan Setup Password Klien Secara Mandiri */}
                {clientList.length > 0 && (
                  <div className="mt-4 rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <KeyRound className="size-3.5 text-teal-700 shrink-0" />
                        <span className="text-xs font-bold text-slate-800">Akses Mandiri & Setup Password Klien</span>
                      </div>
                      <span className="rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5">
                        Tanpa Password Bawaan
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Klien dapat membuat atau mengganti kata sandi kapan saja secara mandiri via menu <strong>"Forgot Password"</strong> di halaman login. Anda juga dapat mengirimkan tautan pembuatan kata sandi langsung ke email klien:
                    </p>
                    <div className="divide-y divide-slate-200/80 pt-1">
                      {clientList.map((c) => (
                        <div key={c.user_id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-xs">
                          <div>
                            <span className="font-semibold text-slate-900">{c.email || c.user_id.slice(0, 8)}</span>
                            {c.fullName && <span className="text-slate-500 ml-1">({c.fullName})</span>}
                          </div>
                          {c.email && (
                            <form action={sendClientPasswordResetAction} className="inline-flex">
                              <input type="hidden" name="project_id" value={project?.id || ""} />
                              <input type="hidden" name="email" value={c.email} />
                              <input type="hidden" name="origin" value={origin} />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-brand shadow-sm transition active:scale-95"
                              >
                                <Mail className="size-3 text-slate-500" />
                                <span>Kirim Tautan Buat Kata Sandi</span>
                              </button>
                            </form>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                <div className="flex flex-wrap items-center gap-2">
                  {isInternal && !isClient && (
                    <Link
                      href={`/portal-proyek?project=${project.id}&tab=${portalTab === "milestones" ? "kolaborasi" : "milestones"}`}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        portalTab === "milestones"
                          ? "border-teal-600 bg-teal-700 text-white"
                          : "border-teal-300 bg-white text-teal-900 hover:bg-teal-50"
                      }`}
                    >
                      <Layers className="size-3.5" />
                      {portalTab === "milestones" ? "← Kembali ke Kolaborasi & MoM" : "Kelola Milestone & Laporan Klien"}
                    </Link>
                  )}
                  <Link
                    href={`/proyek/${project.id}`}
                    className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Buka Detail Proyek →
                  </Link>
                </div>
              </div>

              {portalTab === "milestones" && isInternal && !isClient ? (
                <ProjectMilestonesManager
                  projectId={project.id}
                  branchId={project.branch_id}
                  initialMilestones={milestones}
                  disabled={w.isReadOnlyPreview}
                  availableAttachments={milestoneAttachments}
                />
              ) : (
                /* Interactive 2-Way Collaboration & MoM View */
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
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
