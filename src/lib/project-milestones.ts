import { createClient } from "@/lib/supabase/server"
import {
  DEFAULT_PROJECT_MILESTONES,
  MILESTONE_ENTRY_PREFIX,
  isMilestoneSyncEntry,
  normalizeMilestoneRow,
  type ProjectMilestoneItem,
} from "@/lib/project-milestone-types"

export {
  DEFAULT_PROJECT_MILESTONES,
  MILESTONE_ENTRY_PREFIX,
  isMilestoneSyncEntry,
  normalizeMilestoneRow,
  type ProjectMilestoneItem,
}

/**
 * Mengambil milestone aktif proyek secara dinamis.
 * 1. Memanggil RPC get_or_seed_project_milestones (otomatis seed 5 tahapan jika proyek baru).
 * 2. Fallback membaca langsung tabel public.project_milestones bila tersedia.
 * 3. Fallback membaca entri sinkronisasi real-time dari project_portal_entries (jika migration belum diterapkan).
 * 4. Fallback terakhir ke DEFAULT_PROJECT_MILESTONES.
 */
export async function getProjectMilestones(projectId: string, organizationId?: string): Promise<ProjectMilestoneItem[]> {
  const supabase = await createClient()

  // 1. Coba RPC get_or_seed_project_milestones
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_or_seed_project_milestones", {
      p_project_id: projectId,
    })

    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      return rpcData.map((m, idx) => normalizeMilestoneRow(m as Record<string, unknown>, idx))
    }
  } catch {
    // Lanjut ke fallback
  }

  // 2. Coba query langsung ke tabel project_milestones
  try {
    const { data: dbMilestones, error } = await supabase
      .from("project_milestones")
      .select("*")
      .eq("project_id", projectId)
      .order("milestone_number", { ascending: true })

    if (!error && Array.isArray(dbMilestones) && dbMilestones.length > 0) {
      return dbMilestones.map((m, idx) => normalizeMilestoneRow(m as Record<string, unknown>, idx))
    }
  } catch {
    // Abaikan jika tabel tidak ada
  }

  // 3. Query dari project_portal_entries (sinkronisasi real-time fallback)
  try {
    let query = supabase
      .from("project_portal_entries")
      .select("id, title, body, created_at")
      .eq("project_id", projectId)
      .eq("kind", "status")
      .like("title", `${MILESTONE_ENTRY_PREFIX}%`)
      .order("created_at", { ascending: false })
      .limit(5)

    if (organizationId) {
      query = query.eq("organization_id", organizationId)
    }

    const { data: entries } = await query

    if (entries && entries.length > 0) {
      for (const entry of entries) {
        if (isMilestoneSyncEntry(entry)) {
          try {
            const parsed = JSON.parse(entry.body)
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed.map((m, idx) => normalizeMilestoneRow(m as Record<string, unknown>, idx, entry.created_at))
            }
          } catch {
            // Abaikan jika parsing gagal
          }
        }
      }
    }
  } catch {
    // Abaikan
  }

  // 4. Fallback ke default milestones
  return DEFAULT_PROJECT_MILESTONES
}

/**
 * Simpan atau perbarui seluruh tahapan milestone proyek.
 * Tersinkronisasi secara real-time ke RPC save_project_milestone / tabel project_milestones
 * dan fallback ke project_portal_entries bila tabel project_milestones belum dimigrasi.
 */
export async function saveProjectMilestones(
  projectId: string,
  organizationId: string,
  milestones: ProjectMilestoneItem[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // 1. Coba simpan melalui RPC save_project_milestone
  let savedViaTable = false
  let rpcPermissionError: string | null = null

  try {
    for (const m of milestones) {
      const { error } = await supabase.rpc("save_project_milestone", {
        p_project_id: projectId,
        p_milestone_number: m.milestone_number,
        p_title: m.title,
        p_subtitle: m.subtitle,
        p_status: m.status,
        p_progress: m.progress,
        p_pic_name: m.pic,
        p_period: m.period,
        p_description: m.description,
        p_deliverables: m.deliverables,
        p_client_actions: m.clientActions,
        p_attachment_ids: m.attachment_ids || [],
      })

      if (error) {
        if (error.code !== "PGRST202" && !error.message?.includes("Could not find the function")) {
          rpcPermissionError = error.message
        }
        savedViaTable = false
        break
      }
      savedViaTable = true
    }
  } catch {
    savedViaTable = false
  }

  if (rpcPermissionError) {
    return { success: false, error: rpcPermissionError }
  }

  if (savedViaTable) {
    return { success: true }
  }

  // 2. Fallback: Simpan sebagai snapshot real-time di project_portal_entries menggunakan RPC v1
  try {
    const entryTitle = `${MILESTONE_ENTRY_PREFIX}${projectId}`
    const entryBody = JSON.stringify(milestones)

    const rpcRes = await supabase.rpc("save_project_portal_entry", {
      p_org: organizationId,
      p_project: projectId,
      p_kind: "status",
      p_audience: "external",
      p_title: entryTitle,
      p_body: entryBody,
    })

    if (rpcRes.error) {
      return { success: false, error: rpcRes.error.message }
    }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Gagal menyimpan milestone ke portal." }
  }

  return { success: true }
}
