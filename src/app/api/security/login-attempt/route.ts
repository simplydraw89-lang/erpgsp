import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string
      status?: "success" | "failed"
      method?: string
      failureReason?: string
    }

    const email = (body.email ?? "").trim().toLowerCase()
    const status = body.status === "success" ? "success" : "failed"
    const method = (body.method ?? "password").trim()
    const failureReason = body.failureReason ? String(body.failureReason).slice(0, 500) : null

    const forwardedFor = request.headers.get("x-forwarded-for")
    const realIp = request.headers.get("x-real-ip")
    const cfConnectingIp = request.headers.get("cf-connecting-ip")
    const ipAddress =
      cfConnectingIp?.trim() ||
      forwardedFor?.split(",")[0]?.trim() ||
      realIp?.trim() ||
      "local/direct"

    const userAgent = request.headers.get("user-agent") ?? "unknown"

    const supabase = await createClient()
    await supabase.rpc("api_record_login_attempt", {
      p_email: email || "(email-kosong)",
      p_status: status,
      p_method: method,
      p_failure_reason: failureReason,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
    })

    return NextResponse.json({ recorded: true })
  } catch {
    // Jangan pernah menggagalkan flow login utama apabila tabel migrasi belum dijalankan
    return NextResponse.json({ recorded: false }, { status: 200 })
  }
}
