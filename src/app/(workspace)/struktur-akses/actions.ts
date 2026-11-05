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
  const { error } = await supabase.rpc("save_work_assignment", { p_org: organizationId, p_user: text(data, "user_id"), p_branch: text(data, "branch_id") || null, p_job_role: text(data, "job_role"), p_relationship: text(data, "relationship_status") })
  if (error) finish("error", error.message)
  revalidatePath(path)
  revalidatePath("/pengajuan", "layout")
  finish("notice", "Status hubungan dan penugasan tersimpan. Penugasan lain pada akun ini tetap tersedia.")
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
