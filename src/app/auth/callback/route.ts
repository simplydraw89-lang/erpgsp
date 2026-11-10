import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next")
  const origin = requestUrl.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_missing_code`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  const forwardedFor = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  const cfConnectingIp = request.headers.get("cf-connecting-ip")
  const ipAddress =
    cfConnectingIp?.trim() ||
    forwardedFor?.split(",")[0]?.trim() ||
    realIp?.trim() ||
    "local/direct"
  const userAgent = request.headers.get("user-agent") ?? "unknown"

  if (error) {
    try {
      await supabase.rpc("api_record_login_attempt", {
        p_email: "(google-oauth)",
        p_status: "failed",
        p_method: "google_oauth",
        p_failure_reason: error.message,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
      })
    } catch {
      // Abaikan jika tabel/RPC belum dimigrasikan
    }
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
  }

  try {
    await supabase.rpc("api_record_login_attempt", {
      p_email: data.user?.email ?? "(google-oauth)",
      p_status: "success",
      p_method: "google_oauth",
      p_failure_reason: null,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
    })
  } catch {
    // Abaikan jika tabel/RPC belum dimigrasikan
  }

  if (next && next.startsWith("/")) {
    return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
