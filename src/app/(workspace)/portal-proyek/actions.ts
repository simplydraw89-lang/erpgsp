"use server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireWorkspace } from "@/lib/auth/context"
const path = "/portal-proyek"
function text(data: FormData, key: string) { return String(data.get(key) ?? "").trim() }
function finish(project: string, kind: "error" | "notice", message: string): never { redirect(`${path}?${new URLSearchParams({ ...(project ? { project } : {}), [kind]: message })}`) }
export async function savePortalEntry(data: FormData) {
  const w = await requireWorkspace()
  const project = text(data, "project_id")
  if (w.isReadOnlyPreview) finish(project, "error", "Mode lihat sebagai aktif. Perubahan dinonaktifkan.")
  const { error } = await w.supabase.rpc("save_project_portal_entry", { p_org: w.organizationId, p_project: project, p_kind: text(data, "kind"), p_audience: text(data, "audience"), p_title: text(data, "title"), p_body: text(data, "body") })
  if (error) finish(project, "error", error.message)
  revalidatePath(path)
  finish(project, "notice", "Informasi proyek tersimpan sesuai cakupan penerimanya.")
}
export async function setPortalAccess(data: FormData) {
  const w = await requireWorkspace()
  const project = text(data, "project_id")
  if (w.actorRole !== "owner" || w.isReadOnlyPreview) finish(project, "error", "Hanya Super Admin yang dapat mengatur akses proyek eksternal.")
  const { error } = await w.supabase.rpc("set_project_portal_access", { p_org: w.organizationId, p_project: project, p_branch: text(data, "branch_id"), p_user: text(data, "user_id"), p_member_type: text(data, "member_type"), p_can_submit: data.get("can_submit") === "on", p_active: text(data, "active") !== "false" })
  if (error) finish(project, "error", error.message)
  revalidatePath(path)
  finish(project, "notice", text(data, "active") === "false" ? "Akses proyek dicabut." : "Akses proyek tersimpan.")
}
export async function configurePortalProject(data: FormData) {
  const w = await requireWorkspace()
  const project = text(data, "project_id")
  if (w.actorRole !== "owner" || w.isReadOnlyPreview) finish(project, "error", "Hanya Super Admin dapat menetapkan cabang proyek.")
  const { error } = await w.supabase.rpc("configure_project_scope", { p_org: w.organizationId, p_project: project, p_branch: text(data, "branch_id") })
  if (error) finish(project, "error", error.message)
  revalidatePath(path)
  finish(project, "notice", "Cabang proyek tersimpan. Informasi internal dapat mulai dicatat.")
}
