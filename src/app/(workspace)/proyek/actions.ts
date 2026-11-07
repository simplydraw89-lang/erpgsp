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

  try {
    manpower = JSON.parse(String(formData.get("manpower") || "[]"))
    timesheet_schedule = JSON.parse(String(formData.get("timesheet_schedule") || "[]"))
    rab_breakdown = JSON.parse(String(formData.get("rab_breakdown") || "[]"))
    attachment_ids = JSON.parse(String(formData.get("attachment_ids") || "[]"))
  } catch {
    return { error: "Format data perencanaan proyek tidak valid." }
  }

  const payload = {
    work_details,
    starts_on,
    ends_on,
    manpower,
    timesheet_schedule,
    rab_breakdown,
    attachment_ids,
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

  revalidatePath("/proyek")
  revalidatePath(`/proyek/${id}`)
  revalidatePath("/portal-proyek")
  revalidatePath("/pekerjaan-saya")

  redirect(`/proyek/${id}?notice=${encodeURIComponent(submit ? "Perencanaan proyek berhasil diajukan ke Direktur Utama." : "Draft perencanaan proyek berhasil disimpan.")}`)
}

export async function decideProjectAction(prevState: { error?: string } | undefined, formData: FormData) {
  const { supabase, isReadOnlyPreview } = await requireWorkspace()
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

  revalidatePath("/proyek")
  revalidatePath(`/proyek/${id}`)
  revalidatePath("/portal-proyek")
  revalidatePath("/pekerjaan-saya")

  const label = decision === "approve" ? "Proyek berhasil disetujui (ACC) dan resmi aktif." : decision === "revise" ? "Proyek dikembalikan ke cabang untuk revisi." : "Proyek ditolak."
  redirect(`/proyek/${id}?notice=${encodeURIComponent(label)}`)
}
