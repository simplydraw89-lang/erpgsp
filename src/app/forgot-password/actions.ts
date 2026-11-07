"use server"

import { createClient } from "@/lib/supabase/server"

export async function requestPasswordReset(email: string, origin: string) {
  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail) {
    return { success: false, error: "Email wajib diisi." }
  }

  const supabase = await createClient()

  const { data: exists, error: rpcError } = await supabase.rpc("check_user_email_exists", {
    p_email: cleanEmail,
  })

  if (!rpcError && exists === false) {
    return {
      success: false,
      error: "Email belum terdaftar. Silakan hubungi administrator.",
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
        error: "Email belum terdaftar. Silakan hubungi administrator.",
      }
    }
    return { success: false, error: resetError.message }
  }

  return { success: true }
}
