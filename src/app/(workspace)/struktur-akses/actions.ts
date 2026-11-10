"use server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireWorkspace } from "@/lib/auth/context"
const path = "/struktur-akses"
function finish(kind: "error" | "notice", message: string): never { redirect(`${path}?${new URLSearchParams({ [kind]: message })}`) }
function text(data: FormData, name: string) { return String(data.get(name) ?? "").trim() }
async function owner() {
  const w = await requireWorkspace()
  if (w.actorRole !== "owner" || w.isReadOnlyPreview) finish("error", "Hanya Super Admin di luar mode pratinjau yang dapat mengatur akses.")
  return w
}

export async function saveWorkAssignment(data: FormData) {
  const { supabase, organizationId } = await owner()
  const userId = text(data, "user_id")
  const relationship = text(data, "relationship_status")
  const rolesJson = text(data, "roles_json")

  if (!userId) finish("error", "Akun anggota wajib dipilih.")
  if (!relationship) finish("error", "Hubungan dengan perusahaan wajib dipilih.")

  if (rolesJson) {
    let assignments: Array<{ job_role: string; branch_id: string | null }> = []
    try {
      assignments = JSON.parse(rolesJson)
    } catch {
      finish("error", "Format data penugasan tidak valid.")
    }

    if (!assignments.length) {
      finish("error", "Pilih minimal 1 jabatan untuk disimpan.")
    }

    for (const a of assignments) {
      const { error } = await supabase.rpc("save_work_assignment", {
        p_org: organizationId,
        p_user: userId,
        p_branch: a.branch_id || null,
        p_job_role: a.job_role,
        p_relationship: relationship,
      })
      if (error) finish("error", error.message)
    }
    revalidatePath(path)
    revalidatePath("/pengajuan", "layout")
    finish("notice", `${assignments.length} penugasan jabatan berhasil disimpan untuk akun tersebut.`)
  }

  // Fallback single assignment
  const { error } = await supabase.rpc("save_work_assignment", {
    p_org: organizationId,
    p_user: userId,
    p_branch: text(data, "branch_id") || null,
    p_job_role: text(data, "job_role"),
    p_relationship: relationship,
  })
  if (error) finish("error", error.message)
  revalidatePath(path)
  revalidatePath("/pengajuan", "layout")
  finish("notice", "Status hubungan dan penugasan tersimpan.")
}

export async function linkBusinessUnit(data: FormData) {
  const { supabase, organizationId } = await owner()
  const { error } = await supabase.rpc("link_business_unit_entity", { p_org: organizationId, p_branch: text(data, "branch_id"), p_entity: text(data, "entity_id") })
  if (error) finish("error", error.message)
  revalidatePath(path)
  finish("notice", "Cabang terhubung ke unit pembukuan.")
}

export async function removeWorkAssignment(data: FormData) {
  const { supabase, organizationId } = await owner()
  const { error } = await supabase.rpc("remove_work_assignment", { p_org: organizationId, p_id: text(data, "assignment_id") })
  if (error) finish("error", error.message)
  revalidatePath(path)
  revalidatePath("/pengajuan", "layout")
  finish("notice", "Penugasan dicabut. Akun pengguna dan penugasan lainnya tetap tersedia.")
}

export async function syncAuthUsersAction() {
  const { supabase, organizationId } = await owner()
  const { data, error } = await supabase.rpc("sync_unlinked_auth_users", { p_org: organizationId })
  if (error) finish("error", `Gagal sinkronisasi: ${error.message}`)
  
  const count = Array.isArray(data) ? data.length : 0
  revalidatePath(path)
  revalidatePath("/portal-proyek")
  revalidatePath("/pengajuan", "layout")
  
  if (count > 0) {
    const emails = Array.isArray(data) ? data.map((u: any) => u.email).filter(Boolean).join(", ") : ""
    finish("notice", `Sinkronisasi berhasil: ${count} akun baru (${emails}) otomatis terhubung ke organisasi!`)
  } else {
    finish("notice", "Semua akun di Supabase Auth sudah sinkron dan terdaftar dalam organisasi.")
  }
}

export async function updateMemberRelationshipAction(data: FormData) {
  const { supabase, organizationId } = await owner()
  const userId = text(data, "user_id")
  const relationship = text(data, "relationship_status")

  if (!userId) finish("error", "Akun pengguna tidak valid.")
  if (!relationship) finish("error", "Status hubungan wajib dipilih.")

  const { error } = await supabase.rpc("update_member_relationship", {
    p_org: organizationId,
    p_user: userId,
    p_relationship: relationship,
  })

  if (error) finish("error", error.message)
  revalidatePath(path)
  revalidatePath("/portal-proyek")
  revalidatePath("/pengajuan", "layout")
  finish("notice", "Status hubungan pengguna berhasil diperbarui.")
}
