"use server"

import { revalidatePath } from "next/cache"
import { requireWorkspace } from "@/lib/auth/context"
import { saveProjectMilestones, type ProjectMilestoneItem } from "@/lib/project-milestones"

export async function updateProjectMilestonesAction(
  projectId: string,
  milestones: ProjectMilestoneItem[]
): Promise<{ success: boolean; error?: string }> {
  const { organizationId, isReadOnlyPreview, relationshipStatus, navigationRoles } = await requireWorkspace()
  if (isReadOnlyPreview) {
    return { success: false, error: "Aksi dinonaktifkan dalam mode pratinjau (read-only)." }
  }
  if (!navigationRoles.length || relationshipStatus === "client" || relationshipStatus === "vendor") {
    return { success: false, error: "Akses ditolak: Hanya PM / PIC internal yang dapat mengubah milestone." }
  }

  if (!projectId || !milestones || !Array.isArray(milestones)) {
    return { success: false, error: "Data tahapan proyek tidak valid." }
  }

  const sanitized = milestones.map((m, idx) => ({
    ...m,
    id: Number(m.milestone_number) || idx + 1,
    milestone_number: Number(m.milestone_number) || idx + 1,
    title: String(m.title || `Tahap ${idx + 1}`).trim(),
    subtitle: String(m.subtitle || "").trim(),
    status: (m.status === "completed" || m.status === "in_progress" || m.status === "upcoming"
      ? m.status
      : "upcoming") as ProjectMilestoneItem["status"],
    progress: Math.min(100, Math.max(0, Math.round(Number(m.progress) || 0))),
    pic: String(m.pic || "").trim(),
    period: String(m.period || "").trim(),
    description: String(m.description || "").trim(),
    deliverables: Array.isArray(m.deliverables) ? m.deliverables.map((d) => String(d).trim()).filter(Boolean) : [],
    clientActions: Array.isArray(m.clientActions) ? m.clientActions.map((c) => String(c).trim()).filter(Boolean) : [],
    attachment_ids: Array.isArray(m.attachment_ids) ? m.attachment_ids.filter(Boolean) : [],
  }))

  const res = await saveProjectMilestones(projectId, organizationId, sanitized)
  if (!res.success) {
    return res
  }

  // Revalidate relevant pages
  revalidatePath("/dashboard")
  revalidatePath("/portal-proyek")
  revalidatePath(`/proyek/${projectId}`)
  revalidatePath("/proyek")

  return { success: true }
}
