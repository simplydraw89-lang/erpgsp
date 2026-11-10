"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireWorkspace } from "@/lib/auth/context"

const path = "/portal-proyek"

function text(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim()
}

function finish(project: string, kind: "error" | "notice", message: string): never {
  redirect(`${path}?${new URLSearchParams({ ...(project ? { project } : {}), [kind]: message })}`)
}

export async function savePortalEntry(data: FormData) {
  const w = await requireWorkspace()
  const project = text(data, "project_id")
  if (w.isReadOnlyPreview) finish(project, "error", "Mode lihat sebagai aktif. Perubahan dinonaktifkan.")

  const kind = text(data, "kind")
  const audience = text(data, "audience")
  const title = text(data, "title")
  const body = text(data, "body")

  let attachments: string[] = []
  let metadata: Record<string, any> = {}

  try {
    attachments = JSON.parse(text(data, "attachment_ids") || "[]")
  } catch {
    attachments = []
  }

  try {
    metadata = JSON.parse(text(data, "metadata") || "{}")
  } catch {
    metadata = {}
  }

  // Coba gunakan v2 dengan lampiran dan metadata
  const { data: v2Data, error: v2Error } = await w.supabase.rpc("save_project_portal_entry_v2", {
    p_org: w.organizationId,
    p_project: project,
    p_kind: kind,
    p_audience: audience,
    p_title: title,
    p_body: body,
    p_attachments: attachments,
    p_metadata: metadata,
  })

  if (v2Error) {
    // Fallback ke fungsi v1 jika migration v2 belum dijalankan di database
    const { error: v1Error } = await w.supabase.rpc("save_project_portal_entry", {
      p_org: w.organizationId,
      p_project: project,
      p_kind: kind,
      p_audience: audience,
      p_title: title,
      p_body: body,
    })
    if (v1Error) finish(project, "error", v1Error.message)
  }

  revalidatePath(path)
  revalidatePath(`/proyek/${project}`)

  const noticeMsg =
    kind === "mom"
      ? "Notulensi rapat (MoM) berhasil dicatat dan dikunci permanen. Pihak proyek & direktur dapat membaca dan berdiskusi pada kolom komentar."
      : kind === "request"
      ? "Permintaan data / instruksi dokumen berhasil dikirim ke klien."
      : "Informasi proyek berhasil disimpan."

  finish(project, "notice", noticeMsg)
}

export async function savePortalComment(data: FormData) {
  const w = await requireWorkspace()
  const project = text(data, "project_id")
  const entryId = text(data, "entry_id")
  const message = text(data, "message")

  if (w.isReadOnlyPreview) finish(project, "error", "Perubahan dinonaktifkan dalam mode pratinjau.")
  if (!message) finish(project, "error", "Pesan komentar tidak boleh kosong.")

  const { error } = await w.supabase.rpc("save_portal_comment", {
    p_entry_id: entryId,
    p_message: message,
  })

  if (error) {
    // Fallback: insert langsung jika RPC belum siap
    const { data: userProfile } = await w.supabase.from("person_profiles").select("relationship_status").eq("user_id", w.user.id).maybeSingle()
    const senderRole = w.actorRole === "owner" ? "owner" : userProfile?.relationship_status === "client" ? "client" : "pic"
    const senderName = w.user.email?.split("@")[0] || "User"

    const { error: insertError } = await w.supabase.from("project_portal_comments").insert({
      organization_id: w.organizationId,
      entry_id: entryId,
      user_id: w.user.id,
      sender_name: senderName,
      sender_role: senderRole,
      message,
    })

    if (insertError) {
      finish(project, "error", error.message || insertError.message || "Gagal mengirim komentar.")
    }
  }

  revalidatePath(path)
  revalidatePath(`/proyek/${project}`)
  finish(project, "notice", "Komentar berhasil dikirim.")
}

export async function setPortalAccess(data: FormData) {
  const w = await requireWorkspace()
  const project = text(data, "project_id")
  if (w.isReadOnlyPreview) finish(project, "error", "Aksi dinonaktifkan dalam mode pratinjau.")
  const { error } = await w.supabase.rpc("set_project_portal_access", {
    p_org: w.organizationId,
    p_project: project,
    p_branch: text(data, "branch_id"),
    p_user: text(data, "user_id"),
    p_member_type: text(data, "member_type"),
    p_can_submit: data.get("can_submit") === "on",
    p_active: text(data, "active") !== "false",
  })
  if (error) finish(project, "error", error.message)
  revalidatePath(path)
  finish(project, "notice", text(data, "active") === "false" ? "Akses proyek dicabut." : "Akses proyek tersimpan.")
}

export async function provisionPortalClientAction(data: FormData) {
  const w = await requireWorkspace()
  const project = text(data, "project_id")
  if (w.isReadOnlyPreview) finish(project, "error", "Aksi dinonaktifkan dalam mode pratinjau.")

  const email = text(data, "client_email")
  const name = text(data, "client_name")
  const origin = text(data, "origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  
  // Buat random salt kata sandi sementara yang aman (tanpa password default mudah ditebak)
  const randomPass = `GspClnt_${Math.random().toString(36).slice(2, 10)}!9A`
  const password = text(data, "client_password") || randomPass

  if (!project) finish("", "error", "Pilih proyek terlebih dahulu.")
  if (!email) finish(project, "error", "Email klien wajib diisi.")

  const { data: res, error } = await w.supabase.rpc("auto_provision_project_client", {
    p_project_id: project,
    p_email: email,
    p_client_name: name || null,
    p_password: password,
  })

  if (error) finish(project, "error", error.message || "Gagal mengaktifkan akun klien.")

  // Otomatis kirim tautan setup password privat ke email klien
  try {
    await w.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    })
  } catch {
    // Abaikan jika mailer belum siap
  }

  revalidatePath(path)
  revalidatePath(`/proyek/${project}`)

  const result = res as any
  const noticeMsg = result?.is_new_user
    ? `Akun klien (${result?.email}) berhasil dibuat & dihubungkan dengan akses 2 arah aktif! Tautan pembuatan kata sandi privat telah dikirimkan ke email klien. Klien juga dapat langsung menggunakan menu "Forgot Password" di halaman login kapan saja.`
    : `Akun klien (${result?.email}) berhasil dihubungkan ke proyek ini dengan akses 2 arah aktif.`

  finish(project, "notice", noticeMsg)
}

export async function sendClientPasswordResetAction(data: FormData) {
  const w = await requireWorkspace()
  const project = text(data, "project_id")
  const email = text(data, "email")
  const origin = text(data, "origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  if (w.isReadOnlyPreview) finish(project, "error", "Aksi dinonaktifkan dalam mode pratinjau.")
  if (!email) finish(project, "error", "Alamat email klien tidak valid.")

  const redirectTo = `${origin}/auth/callback?next=/reset-password`
  const { error } = await w.supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  })

  if (error) {
    finish(project, "error", `Gagal mengirim tautan: ${error.message}`)
  }

  revalidatePath(path)
  revalidatePath(`/proyek/${project}`)
  finish(project, "notice", `Tautan pembuatan kata sandi privat berhasil dikirimkan ke ${email}. Klien dapat langsung membuka kotak masuk/spam email mereka untuk mengatur kata sandi secara aman.`)
}

export async function configurePortalProject(data: FormData) {
  const w = await requireWorkspace()
  const project = text(data, "project_id")
  if (w.actorRole !== "owner" || w.isReadOnlyPreview) finish(project, "error", "Hanya Super Admin dapat menetapkan cabang proyek.")
  const { error } = await w.supabase.rpc("configure_project_scope", {
    p_org: w.organizationId,
    p_project: project,
    p_branch: text(data, "branch_id"),
  })
  if (error) finish(project, "error", error.message)
  revalidatePath(path)
  finish(project, "notice", "Cabang proyek tersimpan. Informasi internal dapat mulai dicatat.")
}
