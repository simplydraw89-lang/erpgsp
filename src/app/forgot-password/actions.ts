"use server"

import { createClient } from "@/lib/supabase/server"

export async function requestPasswordReset(email: string, origin: string) {
  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail) {
    return { success: false, error: "Email wajib diisi." }
  }

  const supabase = await createClient()

  // 1. Cek apakah user ada di auth.users via RPC
  const { data: exists, error: rpcError } = await supabase.rpc("check_user_email_exists", {
    p_email: cleanEmail,
  })

  let userExists = !rpcError && exists === true

  // 2. Jika belum ada di auth.users, cek apakah email terdaftar sebagai klien proyek di sales_clients
  if (!userExists) {
    const { data: clientData } = await supabase
      .from("sales_clients")
      .select("id, name, organization_id")
      .ilike("email", cleanEmail)
      .limit(1)
      .maybeSingle()

    if (clientData) {
      // Ambil proyek terkait untuk auto-provisioning instan
      const { data: projData } = await supabase
        .from("crm_projects")
        .select("id")
        .eq("client_id", clientData.id)
        .limit(1)
        .maybeSingle()

      if (projData) {
        const randomTempPass = `GspInit_${Math.random().toString(36).slice(2, 10)}!8Z`
        await supabase.rpc("auto_provision_project_client", {
          p_project_id: projData.id,
          p_email: cleanEmail,
          p_client_name: clientData.name || null,
          p_password: randomTempPass,
        })
        userExists = true
      }
    }
  }

  if (!userExists && !rpcError && exists === false) {
    return {
      success: false,
      error: "Email belum terdaftar. Pastikan email sesuai dengan yang didaftarkan pada proyek atau hubungi administrator.",
    }
  }

  const redirectTo = `${origin}/auth/callback?next=/reset-password`
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo,
  })

  if (resetError) {
    const msg = resetError.message.toLowerCase()
    if (
      msg.includes("user not found") ||
      msg.includes("not found") ||
      msg.includes("invalid email") ||
      msg.includes("tidak ditemukan")
    ) {
      return {
        success: false,
        error: "Email belum terdaftar dalam sistem. Pastikan alamat email benar.",
      }
    }
    return { success: false, error: resetError.message }
  }

  return { success: true }
}
