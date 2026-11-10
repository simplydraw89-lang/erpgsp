import "server-only"
import type { requireWorkspace } from "@/lib/auth/context"

type Supabase = Awaited<ReturnType<typeof requireWorkspace>>["supabase"]

export type ActorProfile = {
  userId: string
  fullName: string
  email: string
  roleLabel: string
  branchId: string | null
  branchName: string
  jobRoles: string[]
  memberRole: string
}

export type RawAuditEvent = {
  id: string
  action: string
  actor_id: string
  note?: string | null
  details?: Record<string, any> | null
  created_at: string
}

export type EnrichedAuditStep = {
  id: string
  stepNumber: number
  action: string
  actionTitle: string
  actionBadge: {
    label: string
    tone: "slate" | "blue" | "amber" | "emerald" | "rose" | "indigo"
  }
  actor: {
    userId: string
    fullName: string
    email: string
    roleLabel: string
    branchName: string
  }
  fromStageLabel: string | null
  toStageLabel: string
  routedTo: {
    label: string
    personName: string
    personEmail: string
    roleLabel: string
    isRevisionReturn: boolean
  } | null
  note: string | null
  createdAt: string
  createdAtFormatted: string
  durationFromPrevMs: number | null
  durationFromPrevLabel: string | null
  durationContextLabel: string | null
}

export type ActorKpiSummaryItem = {
  userId: string
  fullName: string
  email: string
  roleLabel: string
  branchName: string
  actionsCount: number
  totalResponseMs: number
  totalResponseLabel: string
  lastActionTitle: string
  lastActionAtFormatted: string
  isCurrentHolder: boolean
}

export type WorkflowAuditSummary = {
  entityKind: "sph" | "spk" | "purchase" | "project"
  documentLabel: string
  currentStatus: string
  currentStageLabel: string
  isCompleted: boolean
  isRevisionOrRejected: boolean
  creator: {
    userId: string
    fullName: string
    email: string
    roleLabel: string
    branchName: string
  }
  currentHolder: {
    statusLabel: string
    holderName: string
    holderEmail: string
    holderRoleLabel: string
    holderBranchName: string
    actionRequiredLabel: string
    sinceFormatted: string
    elapsedMs: number
    elapsedLabel: string
  } | null
  metrics: {
    totalLeadTimeMs: number
    totalLeadTimeLabel: string
    totalSteps: number
    revisionCount: number
    firstCreatedAtFormatted: string
    lastUpdatedAtFormatted: string
  }
  steps: EnrichedAuditStep[]
  actorKpiList: ActorKpiSummaryItem[]
}

const JOB_ROLE_LABELS: Record<string, string> = {
  president: "Direktur Utama",
  finance_director: "Direktur Keuangan",
  technical_director: "Direktur Teknis",
  branch_manager: "Manager Cabang",
  accounting_tax: "Accounting & Tax",
  finance: "Finance",
  project_manager: "Project Manager",
  admin: "Admin Cabang",
  hr: "SDM",
  support: "Support",
  other: "Staf Operasional",
}

const KNOWN_EMAIL_NAMES: Record<string, { fullName: string; defaultRole: string; defaultBranch: string }> = {
  "adm@sby.test": { fullName: "Admin Cabang Surabaya", defaultRole: "Admin Cabang", defaultBranch: "Surabaya" },
  "manager@sby.test": { fullName: "Manager Cabang Surabaya", defaultRole: "Manager Cabang", defaultBranch: "Surabaya" },
  "adm@jakarta.test": { fullName: "Admin Cabang Jakarta", defaultRole: "Admin Cabang", defaultBranch: "Jakarta" },
  "man@jakarta.test": { fullName: "Manager Cabang Jakarta", defaultRole: "Manager Cabang", defaultBranch: "Jakarta" },
  "adm@yogya.test": { fullName: "Admin Cabang Jogjakarta", defaultRole: "Admin Cabang", defaultBranch: "Jogjakarta" },
  "man@yogya.test": { fullName: "Manager Cabang Jogjakarta", defaultRole: "Manager Cabang", defaultBranch: "Jogjakarta" },
  "dir@keuangan.test": { fullName: "Direktur Keuangan", defaultRole: "Direktur Keuangan", defaultBranch: "Pusat" },
  "dir@utama.test": { fullName: "Direktur Utama", defaultRole: "Direktur Utama", defaultBranch: "Pusat" },
  "dir@teknis.test": { fullName: "Direktur Teknis", defaultRole: "Direktur Teknis", defaultBranch: "Pusat" },
  "adm@fin.test": { fullName: "Staf Finance & Accounting Pajak", defaultRole: "Accounting & Tax · Finance", defaultBranch: "Pusat" },
  "demo@gsp.test": { fullName: "Akun Pratinjau Eksekutif", defaultRole: "Auditor / Pratinjau", defaultBranch: "Pusat" },
}

export function formatDurationID(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "< 1 menit"
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return `${Math.max(1, totalSeconds)} detik`
  const totalMinutes = Math.floor(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes} menit`
  const totalHours = Math.floor(totalMinutes / 60)
  const remMinutes = totalMinutes % 60
  if (totalHours < 24) {
    return remMinutes > 0 ? `${totalHours} jam ${remMinutes} menit` : `${totalHours} jam`
  }
  const days = Math.floor(totalHours / 24)
  const remHours = totalHours % 24
  return remHours > 0 ? `${days} hari ${remHours} jam` : `${days} hari`
}

export function formatTimestampWIB(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return (
      new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(d) + " WIB"
    )
  } catch {
    return iso
  }
}

export async function loadOrganizationActorDirectory(
  supabase: Supabase,
  organizationId: string,
  currentUser?: { id: string; email?: string | null; user_metadata?: any } | null
): Promise<{
  actorMap: Map<string, ActorProfile>
  findRoleHolder: (jobRoles: string[], branchId?: string | null) => ActorProfile | null
}> {
  const [unitsRes, membersRes, assignmentsRes, orgUsersRes, publicProfilesRes] = await Promise.all([
    supabase.from("business_units").select("id,code,name,kind").eq("organization_id", organizationId),
    supabase.from("organization_members").select("user_id,role").eq("organization_id", organizationId),
    supabase.from("work_assignments").select("user_id,branch_id,job_role").eq("organization_id", organizationId),
    supabase.rpc("list_organization_users", { p_org: organizationId }),
    supabase.from("profiles").select("id,full_name,employment_type"),
  ])

  const units = unitsRes.data ?? []
  const branchMap = new Map<string, string>()
  for (const u of units) {
    branchMap.set(u.id, u.name)
  }

  const rawUsers = new Map<string, { email: string; fullName: string; memberRole: string }>()

  if (Array.isArray(orgUsersRes.data)) {
    for (const u of orgUsersRes.data) {
      rawUsers.set(u.user_id, {
        email: (u.email || "").toLowerCase(),
        fullName: u.full_name || "",
        memberRole: u.role || "",
      })
    }
  }

  if (Array.isArray(publicProfilesRes.data)) {
    for (const p of publicProfilesRes.data) {
      const existing = rawUsers.get(p.id)
      if (existing) {
        if (!existing.fullName && p.full_name) existing.fullName = p.full_name
      } else {
        rawUsers.set(p.id, {
          email: "",
          fullName: p.full_name || "",
          memberRole: "",
        })
      }
    }
  }

  if (Array.isArray(membersRes.data)) {
    for (const m of membersRes.data) {
      const existing = rawUsers.get(m.user_id)
      if (existing) {
        if (!existing.memberRole && m.role) existing.memberRole = m.role
      } else {
        rawUsers.set(m.user_id, {
          email: "",
          fullName: "",
          memberRole: m.role || "",
        })
      }
    }
  }

  if (currentUser?.id) {
    const existing = rawUsers.get(currentUser.id)
    const metaName =
      currentUser.user_metadata?.full_name ||
      currentUser.user_metadata?.name ||
      ""
    if (existing) {
      if (!existing.email && currentUser.email) existing.email = currentUser.email.toLowerCase()
      if (!existing.fullName && metaName) existing.fullName = metaName
    } else {
      rawUsers.set(currentUser.id, {
        email: (currentUser.email || "").toLowerCase(),
        fullName: metaName,
        memberRole: "",
      })
    }
  }

  const assignmentsByUser = new Map<string, Array<{ branchId: string | null; jobRole: string }>>()
  if (Array.isArray(assignmentsRes.data)) {
    for (const a of assignmentsRes.data) {
      const list = assignmentsByUser.get(a.user_id) ?? []
      list.push({ branchId: a.branch_id, jobRole: a.job_role })
      assignmentsByUser.set(a.user_id, list)
    }
  }

  const allUserIds = new Set<string>([
    ...rawUsers.keys(),
    ...assignmentsByUser.keys(),
  ])

  const actorMap = new Map<string, ActorProfile>()

  for (const uid of allUserIds) {
    const base = rawUsers.get(uid)
    const jobs = assignmentsByUser.get(uid) ?? []
    const email = (base?.email || "").toLowerCase()
    const known = email ? KNOWN_EMAIL_NAMES[email] : undefined

    const jobRoles = jobs.map((j) => j.jobRole)
    const primaryBranchId = jobs.find((j) => j.branchId)?.branchId ?? null
    const branchName = primaryBranchId
      ? branchMap.get(primaryBranchId) || known?.defaultBranch || "Cabang"
      : known?.defaultBranch || "Pusat"

    let roleLabel = ""
    if (jobRoles.length > 0) {
      roleLabel = Array.from(new Set(jobRoles.map((r) => JOB_ROLE_LABELS[r] || r))).join(" & ")
    } else if (base?.memberRole === "owner") {
      roleLabel = "Super Admin"
    } else if (known?.defaultRole) {
      roleLabel = known.defaultRole
    } else if (base?.memberRole === "director") {
      roleLabel = "Direksi"
    } else if (base?.memberRole === "manager") {
      roleLabel = "Manager Cabang"
    } else if (base?.memberRole === "finance") {
      roleLabel = "Finance & Accounting"
    } else {
      roleLabel = "Staf Internal"
    }

    let fullName = (base?.fullName || "").trim()
    const emailPrefix = email ? email.split("@")[0] : ""
    if (!fullName || fullName.toLowerCase() === emailPrefix.toLowerCase()) {
      if (known?.fullName) {
        fullName = known.fullName
      } else if (base?.memberRole === "owner") {
        fullName = fullName ? `${fullName} (Super Admin)` : "Super Admin GSP"
      } else if (roleLabel && branchName) {
        fullName = `${roleLabel} ${branchName}`
      } else {
        fullName = email || `Pengguna ${uid.slice(0, 8)}`
      }
    }

    actorMap.set(uid, {
      userId: uid,
      fullName,
      email,
      roleLabel,
      branchId: primaryBranchId,
      branchName,
      jobRoles,
      memberRole: base?.memberRole || "staff",
    })
  }

  function findRoleHolder(targetJobRoles: string[], targetBranchId?: string | null): ActorProfile | null {
    // 1. Cari yang cocok di cabang spesifik (jika branch-scoped role)
    for (const profile of actorMap.values()) {
      const hasRole = profile.jobRoles.some((r) => targetJobRoles.includes(r))
      if (!hasRole) continue
      if (targetBranchId && profile.branchId === targetBranchId) {
        return profile
      }
    }
    // 2. Cari di tingkat pusat (branchId == null) atau cabang mana saja yang memegang role tsb
    for (const profile of actorMap.values()) {
      const hasRole = profile.jobRoles.some((r) => targetJobRoles.includes(r))
      if (hasRole) return profile
    }
    return null
  }

  return { actorMap, findRoleHolder }
}

function getStageLabel(entityKind: "sph" | "spk" | "purchase" | "project", status?: string | null, branchName = "Cabang"): string {
  if (!status) return "Draft"
  if (entityKind === "sph") {
    switch (status) {
      case "draft":
        return `Draft SPH (${branchName})`
      case "branch_review":
        return `Pemeriksaan Manager Cabang (${branchName})`
      case "director_review":
        return "Pemeriksaan Direktur Keuangan (Pusat)"
      case "ready":
        return "Disetujui Internal (Siap Konfirmasi Klien / Buat SPK)"
      case "accepted":
        return "Disepakati Kedua Pihak (Siap Penerbitan SPK)"
      case "revision_requested":
        return `Perlu Revisi — Dikembalikan ke Pengaju (${branchName})`
      case "rejected":
        return "Ditolak"
      default:
        return status
    }
  }
  if (entityKind === "spk") {
    switch (status) {
      case "draft":
        return `Draft SPK (${branchName})`
      case "director_review":
        return "Pemeriksaan & Validasi Direktur Utama (Pusat)"
      case "ready":
        return "SPK Disetujui Direktur Utama (Proyek Resmi Aktif)"
      case "revision_requested":
        return `Perlu Revisi SPK — Dikembalikan ke Pengaju (${branchName})`
      case "rejected":
        return "SPK Ditolak"
      default:
        return status
    }
  }
  if (entityKind === "purchase") {
    switch (status) {
      case "draft":
        return `Draft Pengajuan Pembelian (${branchName})`
      case "branch_review":
        return `Pemeriksaan Manager Cabang (${branchName})`
      case "director_review":
        return "Pemeriksaan Direktur Keuangan (Pusat)"
      case "accounting_review":
        return "Verifikasi COA & Pajak oleh Accounting & Tax (Pusat)"
      case "payment_ready":
        return "Siap Dibayar oleh Finance (Pusat)"
      case "paid":
        return "Pembayaran Lunas & Jurnal Terposting"
      case "rejected":
        return `Perlu Revisi / Dikembalikan ke Pengaju (${branchName})`
      default:
        return status
    }
  }
  // project
  switch (status) {
    case "draft":
    case "planned":
      return `Draft Perencanaan & RAB Proyek (${branchName})`
    case "director_review":
      return "Pemeriksaan & Pengesahan RAB oleh Direktur Utama (Pusat)"
    case "active":
      return "Proyek Resmi Aktif & Pagu RAB Terkunci"
    case "revision_requested":
      return `Perlu Revisi RAB/Dokumen — Dikembalikan ke Tim Cabang (${branchName})`
    case "rejected":
      return "Perencanaan Proyek Ditolak"
    default:
      return status
  }
}

export function buildWorkflowAuditSummary(params: {
  entityKind: "sph" | "spk" | "purchase" | "project"
  documentLabel: string
  currentStatus: string
  createdByUserId?: string | null
  createdAt?: string | null
  returnToStage?: string | null
  branchId?: string | null
  branchName?: string | null
  events: RawAuditEvent[]
  actorMap: Map<string, ActorProfile>
  findRoleHolder: (jobRoles: string[], branchId?: string | null) => ActorProfile | null
}): WorkflowAuditSummary {
  const {
    entityKind,
    documentLabel,
    currentStatus,
    createdByUserId,
    createdAt,
    returnToStage,
    branchId,
    branchName: rawBranchName,
    events,
    actorMap,
    findRoleHolder,
  } = params

  const branchName = rawBranchName || "Cabang"

  function resolveActor(
    userId?: string | null,
    details?: Record<string, any> | null,
    fallbackRoleHint?: string,
    fallbackBranchHint?: string
  ): { userId: string; fullName: string; email: string; roleLabel: string; branchName: string } {
    const uid = userId || ""
    const fromMap = uid ? actorMap.get(uid) : undefined
    if (fromMap) {
      return {
        userId: fromMap.userId,
        fullName: fromMap.fullName,
        email: fromMap.email,
        roleLabel: fromMap.roleLabel,
        branchName: fromMap.branchName,
      }
    }
    if (details?.actor_name || details?.actor_email) {
      return {
        userId: uid,
        fullName: details.actor_name || details.actor_email || `User ${uid.slice(0, 8)}`,
        email: details.actor_email || "",
        roleLabel: details.actor_role || fallbackRoleHint || "Pejabat / Staf Internal",
        branchName: details.actor_branch || fallbackBranchHint || branchName,
      }
    }
    if (uid && createdByUserId && uid === createdByUserId) {
      const branchAdmin = findRoleHolder(["admin", "branch_manager"], branchId)
      if (branchAdmin && branchAdmin.userId === uid) {
        return {
          userId: uid,
          fullName: branchAdmin.fullName,
          email: branchAdmin.email,
          roleLabel: branchAdmin.roleLabel,
          branchName: branchAdmin.branchName,
        }
      }
      return {
        userId: uid,
        fullName: `Pengaju Dokumen (${branchName})`,
        email: "",
        roleLabel: fallbackRoleHint || `Admin / Staf Pengaju`,
        branchName: fallbackBranchHint || branchName,
      }
    }
    return {
      userId: uid,
      fullName: fallbackRoleHint ? `${fallbackRoleHint}` : uid ? `Pejabat Internal (${uid.slice(0, 8)})` : "Sistem Otomatis",
      email: "",
      roleLabel: fallbackRoleHint || "Pejabat Pemeriksa",
      branchName: fallbackBranchHint || branchName,
    }
  }

  // Resolve creator (Pengaju Pembuat Dokumen)
  const firstEventActorId = events.length > 0 ? [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]?.actor_id : null
  const effectiveCreatorId = createdByUserId || firstEventActorId || ""
  const creator = resolveActor(effectiveCreatorId, null, `Admin / Pengaju ${branchName}`, branchName)

  // Urutkan events secara kronologis (lama -> baru) untuk menghitung durasi antar-tahap dan alur perpindahan
  const chronological = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  let runningStage = "draft"
  let revisionCount = 0

  const steps: EnrichedAuditStep[] = chronological.map((ev, idx) => {
    const details = (ev.details && typeof ev.details === "object" ? ev.details : {}) as Record<string, any>
    const prevEvent = idx > 0 ? chronological[idx - 1] : null
    const currentMs = new Date(ev.created_at).getTime()
    const prevMs = prevEvent ? new Date(prevEvent.created_at).getTime() : createdAt ? new Date(createdAt).getTime() : null

    const rawDiff = prevMs !== null && Number.isFinite(currentMs - prevMs) ? Math.max(0, currentMs - prevMs) : null

    const fromStatus = details.from_status || details.from || runningStage
    const nextStatus = details.next_status || details.next || details.to || details.status || details.approval_status || null

    // Infer role hint if user isn't in actorMap
    let roleHint = `Admin / Staf ${branchName}`
    let branchHint = branchName
    if (ev.action === "approved" || ev.action === "revision_requested" || ev.action === "rejected" || ev.action === "director_decision") {
      if (fromStatus === "branch_review") {
        roleHint = `Manager Cabang ${branchName}`
        branchHint = branchName
      } else if (fromStatus === "director_review") {
        roleHint = entityKind === "spk" || entityKind === "project" ? "Direktur Utama" : "Direktur Keuangan"
        branchHint = "Pusat"
      } else if (fromStatus === "accounting_review") {
        roleHint = "Accounting & Tax"
        branchHint = "Pusat"
      }
    } else if (ev.action === "accounting_approved") {
      roleHint = "Accounting & Tax"
      branchHint = "Pusat"
    } else if (ev.action === "paid") {
      roleHint = "Finance"
      branchHint = "Pusat"
    }

    const actor = resolveActor(ev.actor_id, details, roleHint, branchHint)

    let actionTitle = "Aktivitas Dokumen"
    let badgeLabel = "Aktivitas"
    let badgeTone: EnrichedAuditStep["actionBadge"]["tone"] = "slate"
    let fromStageLabel: string | null = idx === 0 ? null : getStageLabel(entityKind, fromStatus, branchName)
    let toStageLabel = getStageLabel(entityKind, nextStatus || runningStage, branchName)
    let routedTo: EnrichedAuditStep["routedTo"] = null
    let durationContextLabel: string | null = null

    if (ev.action === "draft_created" || ev.action === "draft_saved" || ev.action === "created") {
      actionTitle = `Draft Awal & Lampiran Dibuat oleh ${actor.fullName}`
      badgeLabel = "Pembuatan Draft"
      badgeTone = "slate"
      toStageLabel = getStageLabel(entityKind, "draft", branchName)
      runningStage = "draft"
      routedTo = {
        label: "Disimpan pada meja kerja pengaju",
        personName: actor.fullName,
        personEmail: actor.email,
        roleLabel: `${actor.roleLabel} (${actor.branchName})`,
        isRevisionReturn: false,
      }
    } else if (ev.action === "draft_updated" || ev.action === "updated" || ev.action === "planning_updated") {
      const wasRevision = runningStage === "revision_requested" || runningStage === "rejected"
      actionTitle = wasRevision
        ? `Perbaikan Dokumen Revisi Disimpan oleh ${actor.fullName}`
        : `Rincian Draft & Lampiran Diperbarui oleh ${actor.fullName}`
      badgeLabel = wasRevision ? "Perbaikan Revisi" : "Update Draft"
      badgeTone = "blue"
      toStageLabel = getStageLabel(entityKind, runningStage, branchName)
      durationContextLabel = wasRevision ? "Waktu pengerjaan revisi oleh pengaju" : "Waktu pembaruan draft"
      routedTo = {
        label: "Masih dikerjakan oleh pengaju sebelum dikirim",
        personName: actor.fullName,
        personEmail: actor.email,
        roleLabel: `${actor.roleLabel} (${actor.branchName})`,
        isRevisionReturn: false,
      }
    } else if (ev.action === "reviewer_edited") {
      actionTitle = `Data Dokumen Dikoreksi Langsung oleh Pemeriksa (${actor.fullName})`
      badgeLabel = "Koreksi Pemeriksa"
      badgeTone = "indigo"
      toStageLabel = getStageLabel(entityKind, runningStage, branchName)
      durationContextLabel = "Waktu tindak lanjut pemeriksa"
    } else if (ev.action === "submitted" || ev.action === "submitted_to_director" || ev.action === "submitted_to_directors") {
      const targetStage =
        nextStatus ||
        (ev.action === "submitted_to_director" || ev.action === "submitted_to_directors"
          ? "director_review"
          : "branch_review")
      runningStage = targetStage
      toStageLabel = getStageLabel(entityKind, targetStage, branchName)
      badgeLabel = "Pengajuan Dikirim"
      badgeTone = "blue"
      durationContextLabel = "Waktu penyelesaian penyusunan pengajuan"

      if (targetStage === "branch_review") {
        const mgr = findRoleHolder(["branch_manager"], branchId)
        actionTitle = `Dokumen Diajukan oleh ${actor.fullName} ke Manager Cabang ${branchName}`
        routedTo = {
          label: "Diteruskan untuk diperiksa oleh",
          personName: mgr?.fullName || `Manager Cabang ${branchName}`,
          personEmail: mgr?.email || "",
          roleLabel: `Manager Cabang · ${branchName}`,
          isRevisionReturn: false,
        }
      } else {
        const isDirutTarget = entityKind === "spk" || entityKind === "project"
        const dir = findRoleHolder(isDirutTarget ? ["president", "technical_director"] : ["finance_director", "president"], null)
        const dirTitle = isDirutTarget ? "Direktur Utama" : "Direktur Keuangan"
        actionTitle = `Dokumen Diajukan oleh ${actor.fullName} ke ${dirTitle}`
        routedTo = {
          label: "Diteruskan untuk persetujuan",
          personName: dir?.fullName || dirTitle,
          personEmail: dir?.email || "",
          roleLabel: `${dirTitle} · Pusat`,
          isRevisionReturn: false,
        }
      }
    } else if (ev.action === "resubmitted_to_director") {
      runningStage = "director_review"
      toStageLabel = getStageLabel(entityKind, "director_review", branchName)
      badgeLabel = "Fast-Track Revisi Diajukan"
      badgeTone = "indigo"
      durationContextLabel = "Waktu penyelesaian perbaikan revisi oleh pengaju"

      const isDirutTarget = entityKind === "spk" || entityKind === "project"
      const dir = findRoleHolder(isDirutTarget ? ["president", "technical_director"] : ["finance_director", "president"], null)
      const dirTitle = isDirutTarget ? "Direktur Utama" : "Direktur Keuangan"
      actionTitle = `Perbaikan Revisi Diajukan Kembali oleh ${actor.fullName} Langsung ke ${dirTitle}`
      routedTo = {
        label: "Fast-Track (Melewati Manager Cabang) langsung ke",
        personName: dir?.fullName || dirTitle,
        personEmail: dir?.email || "",
        roleLabel: `${dirTitle} · Pusat`,
        isRevisionReturn: false,
      }
    } else if (
      ev.action === "approved" ||
      ev.action === "accounting_approved" ||
      (ev.action === "director_decision" && details.decision === "approve")
    ) {
      const targetStage =
        nextStatus ||
        (ev.action === "accounting_approved"
          ? "payment_ready"
          : ev.action === "director_decision"
          ? "active"
          : fromStatus === "branch_review"
          ? "director_review"
          : "ready")
      fromStageLabel = getStageLabel(entityKind, fromStatus, branchName)
      toStageLabel = getStageLabel(entityKind, targetStage, branchName)
      runningStage = targetStage
      badgeLabel = "Disetujui (ACC)"
      badgeTone = "emerald"
      durationContextLabel = `Waktu pemeriksaan & persetujuan oleh ${actor.roleLabel}`

      if (targetStage === "director_review") {
        const dir = findRoleHolder(["finance_director", "president"], null)
        actionTitle = `Disetujui oleh ${actor.fullName} (${actor.roleLabel}) & Diteruskan ke Direktur Keuangan`
        routedTo = {
          label: "Diteruskan ke tahap pemeriksaan berikutnya",
          personName: dir?.fullName || "Direktur Keuangan",
          personEmail: dir?.email || "",
          roleLabel: "Direktur Keuangan · Pusat",
          isRevisionReturn: false,
        }
      } else if (targetStage === "accounting_review") {
        const acc = findRoleHolder(["accounting_tax"], null)
        actionTitle = `Disetujui oleh ${actor.fullName} (${actor.roleLabel}) & Diteruskan ke Accounting & Tax`
        routedTo = {
          label: "Diteruskan untuk verifikasi COA & Pajak oleh",
          personName: acc?.fullName || "Staf Accounting & Tax",
          personEmail: acc?.email || "",
          roleLabel: "Accounting & Tax · Pusat",
          isRevisionReturn: false,
        }
      } else if (targetStage === "payment_ready") {
        const fin = findRoleHolder(["finance"], null)
        actionTitle = `COA & Pajak Disahkan oleh ${actor.fullName} — Jurnal Utang Terbit & Siap Dibayar`
        routedTo = {
          label: "Diteruskan untuk eksekusi pembayaran oleh",
          personName: fin?.fullName || "Staf Finance Pusat",
          personEmail: fin?.email || "",
          roleLabel: "Finance · Pusat",
          isRevisionReturn: false,
        }
      } else if (entityKind === "spk" && targetStage === "ready") {
        actionTitle = `SPK Disetujui Resmi oleh ${actor.fullName} (${actor.roleLabel}) — Entitas Proyek Dibuat Otomatis`
        routedTo = {
          label: "Diteruskan ke Tim Cabang untuk kelengkapan RAB Proyek",
          personName: creator.fullName,
          personEmail: creator.email,
          roleLabel: `${creator.roleLabel} · ${creator.branchName}`,
          isRevisionReturn: false,
        }
      } else if (entityKind === "project" && targetStage === "active") {
        actionTitle = `Perencanaan & Pagu RAB Disahkan oleh ${actor.fullName} (${actor.roleLabel}) — Proyek Resmi Aktif`
        routedTo = {
          label: "Proyek aktif & siap pelaksanaan operasional oleh",
          personName: creator.fullName,
          personEmail: creator.email,
          roleLabel: `Tim Pelaksana Proyek · ${branchName}`,
          isRevisionReturn: false,
        }
      } else {
        actionTitle = `Disetujui penuh oleh ${actor.fullName} (${actor.roleLabel})`
        routedTo = {
          label: "Persetujuan internal selesai — dikembalikan ke pengaju untuk tindak lanjut",
          personName: creator.fullName,
          personEmail: creator.email,
          roleLabel: `${creator.roleLabel} · ${creator.branchName}`,
          isRevisionReturn: false,
        }
      }
    } else if (
      ev.action === "revision_requested" ||
      (ev.action === "rejected" && entityKind === "purchase") ||
      (ev.action === "director_decision" && details.decision === "revise")
    ) {
      revisionCount += 1
      const targetStage = entityKind === "purchase" ? "rejected" : "revision_requested"
      fromStageLabel = getStageLabel(entityKind, fromStatus, branchName)
      toStageLabel = getStageLabel(entityKind, targetStage, branchName)
      runningStage = targetStage
      badgeLabel = "Diminta Revisi"
      badgeTone = "amber"
      durationContextLabel = `Waktu pemeriksaan oleh ${actor.roleLabel} sebelum dikembalikan`

      actionTitle = `Diminta Revisi oleh ${actor.fullName} (${actor.roleLabel}) — Dikembalikan kepada ${creator.fullName}`
      routedTo = {
        label: "Dikembalikan karena revisi kepada Pengaju",
        personName: creator.fullName,
        personEmail: creator.email,
        roleLabel: `${creator.roleLabel} · ${creator.branchName}`,
        isRevisionReturn: true,
      }
    } else if (ev.action === "rejected" || (ev.action === "director_decision" && details.decision === "reject")) {
      fromStageLabel = getStageLabel(entityKind, fromStatus, branchName)
      toStageLabel = getStageLabel(entityKind, "rejected", branchName)
      runningStage = "rejected"
      badgeLabel = "Ditolak"
      badgeTone = "rose"
      durationContextLabel = `Waktu pemeriksaan oleh ${actor.roleLabel}`
      actionTitle = `Pengajuan Ditolak oleh ${actor.fullName} (${actor.roleLabel})`
      routedTo = {
        label: "Dikembalikan dengan status ditolak kepada",
        personName: creator.fullName,
        personEmail: creator.email,
        roleLabel: `${creator.roleLabel} · ${creator.branchName}`,
        isRevisionReturn: true,
      }
    } else if (ev.action === "mutual_acceptance_recorded") {
      fromStageLabel = getStageLabel(entityKind, "ready", branchName)
      toStageLabel = getStageLabel(entityKind, "accepted", branchName)
      runningStage = "accepted"
      badgeLabel = "Disepakati Klien"
      badgeTone = "emerald"
      durationContextLabel = "Waktu konfirmasi kesepakatan klien"
      actionTitle = `Kesepakatan Kedua Pihak Dicatat oleh ${actor.fullName} — Siap Penerbitan SPK`
      routedTo = {
        label: "Siap dilanjutkan pembuatan SPK oleh",
        personName: creator.fullName,
        personEmail: creator.email,
        roleLabel: `${creator.roleLabel} · ${creator.branchName}`,
        isRevisionReturn: false,
      }
    } else if (ev.action === "paid") {
      fromStageLabel = getStageLabel(entityKind, "payment_ready", branchName)
      toStageLabel = getStageLabel(entityKind, "paid", branchName)
      runningStage = "paid"
      badgeLabel = "Lunas Dibayar"
      badgeTone = "emerald"
      durationContextLabel = "Waktu penyelesaian pembayaran oleh Finance"
      actionTitle = `Pembayaran Vendor Dicatat & Dilunasi oleh ${actor.fullName} (${actor.roleLabel})`
    } else if (ev.action === "director_insight_added") {
      badgeLabel = "Arahan Direksi"
      badgeTone = "indigo"
      actionTitle = `Arahan / Catatan Review Ditambahkan oleh ${actor.fullName} (${actor.roleLabel})`
      durationContextLabel = "Waktu pemberian arahan direksi"
    } else {
      actionTitle = `${ev.action} oleh ${actor.fullName}`
    }

    return {
      id: ev.id,
      stepNumber: idx + 1,
      action: ev.action,
      actionTitle,
      actionBadge: {
        label: badgeLabel,
        tone: badgeTone,
      },
      actor,
      fromStageLabel,
      toStageLabel,
      routedTo,
      note: ev.note || null,
      createdAt: ev.created_at,
      createdAtFormatted: formatTimestampWIB(ev.created_at),
      durationFromPrevMs: idx === 0 && (!rawDiff || rawDiff < 1000) ? null : rawDiff,
      durationFromPrevLabel: idx === 0 && (!rawDiff || rawDiff < 1000) ? null : rawDiff !== null ? formatDurationID(rawDiff) : null,
      durationContextLabel,
    }
  })

  // Hitung pemegang bola pekerjaan saat ini (Current Holder / Active PIC)
  const lastStep = steps.length > 0 ? steps[steps.length - 1] : null
  const lastTimestampIso = lastStep?.createdAt || createdAt || new Date().toISOString()
  const elapsedSinceLastMs = Math.max(0, Date.now() - new Date(lastTimestampIso).getTime())
  const currentStageLabel = getStageLabel(entityKind, currentStatus, branchName)

  const isCompleted =
    (entityKind === "sph" && ["ready", "accepted"].includes(currentStatus)) ||
    (entityKind === "spk" && currentStatus === "ready") ||
    (entityKind === "purchase" && currentStatus === "paid") ||
    (entityKind === "project" && ["active", "completed"].includes(currentStatus))

  const isRevisionOrRejected =
    ["revision_requested", "rejected"].includes(currentStatus)

  let currentHolder: WorkflowAuditSummary["currentHolder"] = null

  if (currentStatus === "draft") {
    currentHolder = {
      statusLabel: currentStageLabel,
      holderName: creator.fullName,
      holderEmail: creator.email,
      holderRoleLabel: creator.roleLabel,
      holderBranchName: creator.branchName,
      actionRequiredLabel: "Melengkapi draft & lampiran dokumen lalu mengirim pengajuan",
      sinceFormatted: formatTimestampWIB(lastTimestampIso),
      elapsedMs: elapsedSinceLastMs,
      elapsedLabel: formatDurationID(elapsedSinceLastMs),
    }
  } else if (currentStatus === "revision_requested" || (entityKind === "purchase" && currentStatus === "rejected")) {
    const lastReviewerName = lastStep ? `${lastStep.actor.fullName} (${lastStep.actor.roleLabel})` : "Pemeriksa"
    const fastTrackNote =
      returnToStage === "director_review"
        ? " — Setelah diperbaiki, pengajuan akan langsung kembali ke Direktur (Fast-Track)"
        : ""
    currentHolder = {
      statusLabel: currentStageLabel,
      holderName: creator.fullName,
      holderEmail: creator.email,
      holderRoleLabel: creator.roleLabel,
      holderBranchName: creator.branchName,
      actionRequiredLabel: `Memperbaiki dokumen sesuai catatan revisi dari ${lastReviewerName}${fastTrackNote}`,
      sinceFormatted: formatTimestampWIB(lastTimestampIso),
      elapsedMs: elapsedSinceLastMs,
      elapsedLabel: formatDurationID(elapsedSinceLastMs),
    }
  } else if (currentStatus === "branch_review") {
    const mgr = findRoleHolder(["branch_manager"], branchId)
    currentHolder = {
      statusLabel: currentStageLabel,
      holderName: mgr?.fullName || `Manager Cabang ${branchName}`,
      holderEmail: mgr?.email || "",
      holderRoleLabel: "Manager Cabang",
      holderBranchName: branchName,
      actionRequiredLabel: "Memeriksa kelengkapan dokumen & memutuskan Setujui atau Minta Revisi",
      sinceFormatted: formatTimestampWIB(lastTimestampIso),
      elapsedMs: elapsedSinceLastMs,
      elapsedLabel: formatDurationID(elapsedSinceLastMs),
    }
  } else if (currentStatus === "director_review") {
    const isDirut = entityKind === "spk" || entityKind === "project"
    const dir = findRoleHolder(isDirut ? ["president", "technical_director"] : ["finance_director", "president"], null)
    const dirTitle = isDirut ? "Direktur Utama" : "Direktur Keuangan"
    currentHolder = {
      statusLabel: currentStageLabel,
      holderName: dir?.fullName || dirTitle,
      holderEmail: dir?.email || "",
      holderRoleLabel: dirTitle,
      holderBranchName: "Pusat",
      actionRequiredLabel: isDirut
        ? "Memvalidasi dokumen & mengesahkan penerbitan / pagu RAB proyek"
        : "Memeriksa nilai komersial & memutuskan Setujui atau Minta Revisi",
      sinceFormatted: formatTimestampWIB(lastTimestampIso),
      elapsedMs: elapsedSinceLastMs,
      elapsedLabel: formatDurationID(elapsedSinceLastMs),
    }
  } else if (currentStatus === "accounting_review") {
    const acc = findRoleHolder(["accounting_tax"], null)
    currentHolder = {
      statusLabel: currentStageLabel,
      holderName: acc?.fullName || "Staf Accounting & Tax",
      holderEmail: acc?.email || "",
      holderRoleLabel: "Accounting & Tax",
      holderBranchName: "Pusat",
      actionRequiredLabel: "Memverifikasi pemetaan COA, PPN, PPh, dan memposting jurnal utang",
      sinceFormatted: formatTimestampWIB(lastTimestampIso),
      elapsedMs: elapsedSinceLastMs,
      elapsedLabel: formatDurationID(elapsedSinceLastMs),
    }
  } else if (currentStatus === "payment_ready") {
    const fin = findRoleHolder(["finance"], null)
    currentHolder = {
      statusLabel: currentStageLabel,
      holderName: fin?.fullName || "Staf Finance Pusat",
      holderEmail: fin?.email || "",
      holderRoleLabel: "Finance",
      holderBranchName: "Pusat",
      actionRequiredLabel: "Mengeksekusi pelunasan ke vendor & mencatat bukti transfer",
      sinceFormatted: formatTimestampWIB(lastTimestampIso),
      elapsedMs: elapsedSinceLastMs,
      elapsedLabel: formatDurationID(elapsedSinceLastMs),
    }
  } else if (isCompleted) {
    currentHolder = {
      statusLabel: currentStageLabel,
      holderName: creator.fullName,
      holderEmail: creator.email,
      holderRoleLabel: creator.roleLabel,
      holderBranchName: creator.branchName,
      actionRequiredLabel:
        entityKind === "sph" && currentStatus === "ready"
          ? "Menindaklanjuti konfirmasi klien atau menerbitkan SPK"
          : "Seluruh tahapan persetujuan dokumen telah selesai (Tuntas)",
      sinceFormatted: formatTimestampWIB(lastTimestampIso),
      elapsedMs: elapsedSinceLastMs,
      elapsedLabel: formatDurationID(elapsedSinceLastMs),
    }
  }

  // Hitung Total Lead Time (dari event pertama/createdAt hingga event terakhir atau sekarang)
  const firstMs =
    chronological.length > 0
      ? new Date(chronological[0].created_at).getTime()
      : createdAt
      ? new Date(createdAt).getTime()
      : Date.now()
  const endMs =
    isCompleted && chronological.length > 0
      ? new Date(chronological[chronological.length - 1].created_at).getTime()
      : Date.now()
  const totalLeadTimeMs = Math.max(0, endMs - firstMs)

  // Rekap KPI per User yang terlibat
  const kpiByActor = new Map<string, ActorKpiSummaryItem>()
  for (const step of steps) {
    const key = step.actor.userId || step.actor.fullName
    const existing = kpiByActor.get(key)
    const stepDur = step.durationFromPrevMs ?? 0
    const isHolder = Boolean(
      currentHolder &&
        !isCompleted &&
        ((step.actor.userId && currentHolder.holderEmail && step.actor.email === currentHolder.holderEmail) ||
          step.actor.fullName === currentHolder.holderName)
    )
    if (existing) {
      existing.actionsCount += 1
      existing.totalResponseMs += stepDur
      existing.totalResponseLabel = formatDurationID(existing.totalResponseMs)
      existing.lastActionTitle = step.actionBadge.label
      existing.lastActionAtFormatted = step.createdAtFormatted
      if (isHolder) existing.isCurrentHolder = true
    } else {
      kpiByActor.set(key, {
        userId: step.actor.userId,
        fullName: step.actor.fullName,
        email: step.actor.email,
        roleLabel: step.actor.roleLabel,
        branchName: step.actor.branchName,
        actionsCount: 1,
        totalResponseMs: stepDur,
        totalResponseLabel: stepDur > 0 ? formatDurationID(stepDur) : "< 1 menit",
        lastActionTitle: step.actionBadge.label,
        lastActionAtFormatted: step.createdAtFormatted,
        isCurrentHolder: isHolder,
      })
    }
  }

  return {
    entityKind,
    documentLabel,
    currentStatus,
    currentStageLabel,
    isCompleted,
    isRevisionOrRejected,
    creator,
    currentHolder,
    metrics: {
      totalLeadTimeMs,
      totalLeadTimeLabel: formatDurationID(totalLeadTimeMs),
      totalSteps: steps.length,
      revisionCount,
      firstCreatedAtFormatted: formatTimestampWIB(
        chronological[0]?.created_at || createdAt || new Date().toISOString()
      ),
      lastUpdatedAtFormatted: formatTimestampWIB(lastTimestampIso),
    },
    steps,
    actorKpiList: Array.from(kpiByActor.values()),
  }
}
