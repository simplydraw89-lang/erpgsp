"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireWorkspace } from "@/lib/auth/context"

export async function saveProjectPlanningAction(prevState: { error?: string } | undefined, formData: FormData) {
  const { supabase, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) return { error: "Aksi dinonaktifkan dalam mode pratinjau." }

  const id = String(formData.get("id") || "")
  const version = Number(formData.get("version") || "1")
  const submit = formData.get("submit") === "true"

  const work_details = String(formData.get("work_details") || "").trim()
  const starts_on = String(formData.get("starts_on") || "").trim() || null
  const ends_on = String(formData.get("ends_on") || "").trim() || null

  let manpower = []
  let timesheet_schedule = []
  let rab_breakdown = []
  let attachment_ids = []
  let payment_terms = []

  try {
    manpower = JSON.parse(String(formData.get("manpower") || "[]"))
    timesheet_schedule = JSON.parse(String(formData.get("timesheet_schedule") || "[]"))
    rab_breakdown = JSON.parse(String(formData.get("rab_breakdown") || "[]"))
    attachment_ids = JSON.parse(String(formData.get("attachment_ids") || "[]"))
    payment_terms = JSON.parse(String(formData.get("payment_terms") || "[]"))
  } catch {
    return { error: "Format data perencanaan proyek tidak valid." }
  }

  const rab_total = Number(formData.get("rab_total") || "0")

  const payload = {
    work_details,
    starts_on,
    ends_on,
    manpower,
    timesheet_schedule,
    rab_breakdown,
    rab_total,
    attachment_ids,
    payment_terms,
  }

  const { error } = await supabase.rpc("save_project_planning", {
    p_id: id,
    p_version: version,
    p_payload: payload,
    p_submit: submit,
  })

  if (error) {
    return { error: error.message || "Gagal menyimpan perencanaan proyek." }
  }

  if (payment_terms.length > 0) {
    await supabase.from("crm_projects").update({ payment_terms }).eq("id", id)
  }

  revalidatePath("/proyek")
  revalidatePath(`/proyek/${id}`)
  revalidatePath("/portal-proyek")
  revalidatePath("/pekerjaan-saya")
  revalidatePath("/pengajuan/penjualan/penagihan")

  redirect(`/proyek/${id}?notice=${encodeURIComponent(submit ? "Perencanaan proyek berhasil diajukan ke Direktur Utama." : "Draft perencanaan proyek berhasil disimpan.")}`)
}

export async function decideProjectAction(prevState: { error?: string } | undefined, formData: FormData) {
  const { supabase, isReadOnlyPreview, user, actorRole, workAssignments } = await requireWorkspace()
  if (isReadOnlyPreview) return { error: "Aksi dinonaktifkan dalam mode pratinjau." }

  const id = String(formData.get("id") || "")
  const version = Number(formData.get("version") || "1")
  const decision = String(formData.get("decision") || "")
  const note = String(formData.get("note") || "").trim()

  if (!["approve", "revise", "reject"].includes(decision)) {
    return { error: "Keputusan tidak valid." }
  }

  if (["revise", "reject"].includes(decision) && !note) {
    return { error: "Catatan alasan revisi atau penolakan wajib diisi." }
  }

  const { error } = await supabase.rpc("decide_project", {
    p_id: id,
    p_version: version,
    p_decision: decision,
    p_note: note || null,
  })

  if (error) {
    return { error: error.message || "Gagal memproses keputusan verifikasi proyek." }
  }

  // Simpan catatan keputusan resmi ke riwayat arahan direksi (director_insights)
  if (note) {
    const authorRole = actorRole === "owner" ? "Super Admin" : "Direktur Utama"
    const authorName = user.email ? user.email.split("@")[0].toUpperCase() : "Direktur Utama"

    const { data: proj } = await supabase
      .from("crm_projects")
      .select("director_insights")
      .eq("id", id)
      .single()

    const currentInsights = Array.isArray(proj?.director_insights) ? proj.director_insights : []
    const newInsight = {
      id: crypto.randomUUID(),
      author_id: user.id,
      author_name: authorName,
      author_role: authorRole,
      section: decision === "revise" ? "Instruksi Revisi" : "Pengesahan ACC",
      comment: note,
      created_at: new Date().toISOString(),
    }

    await supabase
      .from("crm_projects")
      .update({ director_insights: [...currentInsights, newInsight] })
      .eq("id", id)
  }

  revalidatePath("/proyek")
  revalidatePath(`/proyek/${id}`)
  revalidatePath("/portal-proyek")
  revalidatePath("/pekerjaan-saya")

  const label =
    decision === "approve"
      ? "Proyek berhasil disetujui (ACC) dan resmi aktif."
      : decision === "revise"
      ? "Proyek dikembalikan ke cabang untuk revisi sesuai arahan Direktur Utama."
      : "Proyek ditolak."
  redirect(`/proyek/${id}?notice=${encodeURIComponent(label)}`)
}

export async function addProjectDirectorCommentAction(prevState: { error?: string } | undefined, formData: FormData) {
  const { supabase, organizationId, user, actorRole, workAssignments, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) return { error: "Aksi dinonaktifkan dalam mode pratinjau." }

  const id = String(formData.get("id") || "")
  const comment = String(formData.get("comment") || "").trim()
  const section = String(formData.get("section") || "general").trim()

  if (!comment) return { error: "Isi catatan / arahan direksi tidak boleh kosong." }

  const isOwner = actorRole === "owner"
  const isDirut = (workAssignments ?? []).some((j) => !j.branch_id && j.job_role === "president")
  const isDirtek = (workAssignments ?? []).some((j) => !j.branch_id && j.job_role === "technical_director")
  const isDirkeu = (workAssignments ?? []).some((j) => !j.branch_id && j.job_role === "finance_director")

  const authorRole = isOwner
    ? "Super Admin / Direksi"
    : isDirut
    ? "Direktur Utama"
    : isDirtek
    ? "Direktur Teknis"
    : isDirkeu
    ? "Direktur Keuangan"
    : "Tim Proyek / Cabang"

  const authorName = user.email ? user.email.split("@")[0].toUpperCase() : "Direksi"

  // Coba jalankan RPC add_project_director_insight
  const { error: rpcErr } = await supabase.rpc("add_project_director_insight", {
    p_org: organizationId,
    p_project_id: id,
    p_author_name: authorName,
    p_author_role: authorRole,
    p_section: section,
    p_comment: comment,
  })

  if (rpcErr) {
    const { data: proj } = await supabase.from("crm_projects").select("director_insights, branch_id").eq("id", id).single()
    const currentInsights = Array.isArray(proj?.director_insights) ? proj.director_insights : []
    const newInsight = {
      id: crypto.randomUUID(),
      author_id: user.id,
      author_name: authorName,
      author_role: authorRole,
      section,
      comment,
      created_at: new Date().toISOString(),
    }
    await supabase.from("crm_projects").update({ director_insights: [...currentInsights, newInsight] }).eq("id", id)

    if (proj?.branch_id) {
      await supabase.from("procurement_events").insert({
        organization_id: organizationId,
        branch_id: proj.branch_id,
        entity_id: id,
        entity_type: "project",
        action: "director_insight_added",
        actor_id: user.id,
        note: comment,
        details: { author_role: authorRole, section },
      })
    }
  }

  revalidatePath(`/proyek/${id}`)
  revalidatePath("/proyek")
  redirect(`/proyek/${id}?notice=${encodeURIComponent("Catatan arahan direksi berhasil disampaikan ke tim proyek.")}`)
}
