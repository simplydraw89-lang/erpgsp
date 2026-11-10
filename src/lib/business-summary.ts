import "server-only"
import type { requireWorkspace } from "@/lib/auth/context"
import type { SalesNotifications } from "@/lib/sales"

type Supabase = Awaited<ReturnType<typeof requireWorkspace>>["supabase"]

export type BusinessReviewItem = {
  id: string
  kind: "purchase" | "vendor" | "sph" | "spk" | "project"
  title: string
  status: string
  branch_id: string
  amount: number | string
  branch_name?: string
}

export type BranchPurchaseSummary = {
  branch_id: string
  branch_name: string
  submitted_count: number
  unpaid_amount: number | string
  paid_amount: number | string
}

export type BranchProjectReminderItem = {
  id: string
  code: string
  name: string
  branch_id: string
  branch_name: string
  approval_status: string
  contract_amount: number | string
  review_note: string | null
  created_at: string
  spk_id: string | null
  spk_number: string | null
  user_branch_roles: string[]
}

/**
 * Memuat daftar Proyek hasil persetujuan SPK Direktur Utama yang masih berstatus
 * 'draft' atau 'revision_requested' khusus untuk Admin Cabang (admin) dan
 * Manager Cabang (branch_manager) pada cabang bersangkutan.
 */
export async function loadBranchProjectReminders(
  supabase: Supabase,
  organizationId: string
): Promise<BranchProjectReminderItem[]> {
  try {
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData?.user?.id
    if (!userId) return []

    const [assignmentsRes, memberRes, unitsRes] = await Promise.all([
      supabase
        .from("work_assignments")
        .select("branch_id, job_role")
        .eq("organization_id", organizationId)
        .eq("user_id", userId),
      supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("business_units")
        .select("id, name")
        .eq("organization_id", organizationId),
    ])

    const assignments = assignmentsRes.data ?? []
    const isSuperAdmin = memberRes.data?.role === "owner"
    const branchNameMap = new Map<string, string>(
      (unitsRes.data ?? []).map((u: any) => [String(u.id), String(u.name)])
    )

    // Cari cabang di mana user menjabat sebagai Admin Cabang ('admin') atau Manager Cabang ('branch_manager')
    const branchRoleMap = new Map<string, string[]>()
    for (const a of assignments) {
      if (a.branch_id && ["admin", "branch_manager"].includes(a.job_role)) {
        const list = branchRoleMap.get(a.branch_id) ?? []
        const label = a.job_role === "branch_manager" ? "Manager Cabang" : "Admin Cabang"
        if (!list.includes(label)) list.push(label)
        branchRoleMap.set(a.branch_id, list)
      }
    }

    if (!isSuperAdmin && branchRoleMap.size === 0) {
      return []
    }

    let query = supabase
      .from("crm_projects")
      .select("id, code, name, branch_id, approval_status, contract_amount, review_note, created_at, submitted_at, spk_id")
      .eq("organization_id", organizationId)
      .in("approval_status", ["draft", "revision_requested"])
      .order("created_at", { ascending: false })
      .limit(50)

    if (!isSuperAdmin) {
      query = query.in("branch_id", Array.from(branchRoleMap.keys()))
    }

    const { data: projects } = await query
    if (!projects || !projects.length) return []

    const spkIds = projects.map((p: any) => p.spk_id).filter(Boolean)
    const spkMap = new Map<string, string>()
    if (spkIds.length > 0) {
      const { data: spks } = await supabase
        .from("sales_documents")
        .select("id, document_number")
        .in("id", spkIds)
      for (const s of spks ?? []) {
        if (s.id && s.document_number) spkMap.set(String(s.id), String(s.document_number))
      }
    }

    return projects.map((p: any) => {
      const bId = String(p.branch_id || "")
      const bName = branchNameMap.get(bId) || "Cabang"
      const roles = branchRoleMap.get(bId) ?? (isSuperAdmin ? ["Admin Cabang", "Manager Cabang"] : ["Cabang"])
      return {
        id: String(p.id),
        code: String(p.code || "PRJ"),
        name: String(p.name || "Proyek Baru"),
        branch_id: bId,
        branch_name: bName,
        approval_status: String(p.approval_status || "draft"),
        contract_amount: p.contract_amount ?? 0,
        review_note: p.review_note ? String(p.review_note) : null,
        created_at: String(p.submitted_at || p.created_at || new Date().toISOString()),
        spk_id: p.spk_id ? String(p.spk_id) : null,
        spk_number: p.spk_id ? spkMap.get(String(p.spk_id)) ?? null : null,
        user_branch_roles: roles,
      }
    })
  } catch {
    return []
  }
}

/**
 * Menggabungkan notifikasi lonceng dengan reminder wajib untuk Admin Cabang & Manager Cabang
 * ketika SPK telah disetujui oleh Direktur Utama dan proyek menunggu pembuatan/pengajuan dokumen & RAB.
 */
export async function enrichSalesNotificationsWithBranchProjects(
  supabase: Supabase,
  organizationId: string,
  rawNotifications: SalesNotifications | null,
  preloadedReminders?: BranchProjectReminderItem[]
): Promise<SalesNotifications | null> {
  const reminders = preloadedReminders ?? (await loadBranchProjectReminders(supabase, organizationId))
  if (!rawNotifications && !reminders.length) return rawNotifications

  const baseItems = Array.isArray(rawNotifications?.items) ? [...rawNotifications!.items] : []
  const existingProjectIds = new Set(
    baseItems.filter((item) => item.kind === "project").map((item) => item.id)
  )

  // Perjelas label & catatan pada item proyek yang sudah ada di baseItems jika berasal dari cabang user
  const reminderById = new Map(reminders.map((r) => [r.id, r]))
  const enrichedItems = baseItems.map((item) => {
    if (item.kind === "project" && reminderById.has(item.id)) {
      const r = reminderById.get(item.id)!
      const isRevision = r.approval_status === "revision_requested"
      return {
        ...item,
        document_number: r.code,
        status: r.approval_status,
        category: "follow_up" as const,
        label: isRevision
          ? `⚠️ Revisi Dokumen & RAB Proyek (${r.branch_name}): ${r.name}`
          : `⚡ SPK Disetujui Dirut — Segera Lengkapi Dokumen & RAB Proyek (${r.branch_name})`,
        review_note:
          r.review_note ||
          `Reminder ${r.user_branch_roles.join(" & ")} (${r.branch_name}): SPK${r.spk_number ? ` ${r.spk_number}` : ""} telah disetujui Direktur Utama. Segera buat dan ajukan kelengkapan dokumen, RAB, jadwal, serta tim SDM untuk proyek "${r.name}".`,
      }
    }
    return item
  })

  // Tambahkan proyek cabang (draft / revision_requested) yang belum masuk ke notifikasi
  for (const r of reminders) {
    if (!existingProjectIds.has(r.id)) {
      const isRevision = r.approval_status === "revision_requested"
      enrichedItems.unshift({
        id: r.id,
        kind: "project",
        document_number: r.code,
        status: r.approval_status,
        created_at: r.created_at,
        category: "follow_up",
        label: isRevision
          ? `⚠️ Revisi Dokumen & RAB Proyek (${r.branch_name}): ${r.name}`
          : `⚡ SPK Disetujui Dirut — Segera Lengkapi Dokumen & RAB Proyek (${r.branch_name})`,
        review_note:
          r.review_note ||
          `Reminder ${r.user_branch_roles.join(" & ")} (${r.branch_name}): SPK${r.spk_number ? ` ${r.spk_number}` : ""} telah disetujui Direktur Utama. Segera buat dan ajukan kelengkapan dokumen, RAB, jadwal, serta tim SDM untuk proyek "${r.name}".`,
      })
    }
  }

  return {
    total: enrichedItems.length,
    items: enrichedItems,
  }
}

// RPCs apply the same database permissions as the underlying document actions.
// A missing migration must stay visible rather than appearing as an empty queue.
export async function loadBusinessSummary(supabase: Supabase, organizationId: string, { includeReport = true } = {}) {
  const [queue, salesQueue, report, notifications, branchProjectReminders] = await Promise.all([
    supabase.rpc("purchase_review_queue", { p_org: organizationId }),
    supabase.rpc("sph_review_queue", { p_org: organizationId }),
    includeReport ? supabase.rpc("purchase_branch_report", { p_org: organizationId }) : Promise.resolve({ data: [], error: null }),
    supabase.rpc("sales_notifications", { p_org: organizationId }),
    loadBranchProjectReminders(supabase, organizationId),
  ])

  const combinedQueue = [
    ...(Array.isArray(queue.data) ? queue.data : []),
    ...(Array.isArray(salesQueue.data) ? salesQueue.data : []),
  ] as BusinessReviewItem[]

  const existingQueueProjectIds = new Set(
    combinedQueue.filter((q) => q.kind === "project").map((q) => q.id)
  )

  for (const r of branchProjectReminders) {
    if (!existingQueueProjectIds.has(r.id)) {
      combinedQueue.unshift({
        id: r.id,
        kind: "project",
        title: `${r.code} • ${r.name} (${r.branch_name})`,
        status: r.approval_status,
        branch_id: r.branch_id,
        branch_name: r.branch_name,
        amount: r.contract_amount,
      })
    }
  }

  const enrichedNotifications = await enrichSalesNotificationsWithBranchProjects(
    supabase,
    organizationId,
    notifications.data as SalesNotifications | null,
    branchProjectReminders
  )

  return {
    queue: combinedQueue,
    branches: (Array.isArray(report.data) ? report.data : []) as BranchPurchaseSummary[],
    branchProjectReminders,
    queueError: queue.error || salesQueue.error,
    reportError: report.error,
    notifications: enrichedNotifications,
    notificationsError: notifications.error,
  }
}
