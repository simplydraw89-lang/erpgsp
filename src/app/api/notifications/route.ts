import { NextResponse } from "next/server"
import { requireWorkspace } from "@/lib/auth/context"
import {
  getNotificationConfigStatus,
  sendEmailNotification,
  sendWhatsAppNotification,
  generateWhatsAppLink,
} from "@/lib/notifications/service"

export async function GET() {
  const workspace = await requireWorkspace()
  if (!workspace) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const status = getNotificationConfigStatus()
  return NextResponse.json(status)
}

export async function POST(request: Request) {
  const workspace = await requireWorkspace()
  if (!workspace) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { type, recipient, message, subject } = body

    if (type === "email") {
      if (!recipient) {
        return NextResponse.json({ error: "Email tujuan wajib diisi." }, { status: 400 })
      }
      const result = await sendEmailNotification({
        to: recipient,
        subject: subject || "Uji Coba Notifikasi ERP GSP",
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #2563eb;">ERP GSP - Uji Coba Notifikasi</h2>
            <p>${message || "Sistem notifikasi email ERP GSP berhasil terhubung dan berfungsi dengan baik."}</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <small style="color: #64748b;">Dikirim otomatis dari ERP GSP Multi-Cabang.</small>
          </div>
        `,
      })
      return NextResponse.json(result)
    }

    if (type === "whatsapp") {
      if (!recipient) {
        return NextResponse.json({ error: "Nomor WhatsApp wajib diisi." }, { status: 400 })
      }
      const result = await sendWhatsAppNotification({
        phone: recipient,
        message: message || "Uji coba notifikasi ERP GSP: Layanan WhatsApp berhasil terhubung.",
      })
      const waLink = generateWhatsAppLink(
        recipient,
        message || "Uji coba notifikasi ERP GSP: Layanan WhatsApp berhasil terhubung."
      )
      return NextResponse.json({ ...result, clickLink: waLink })
    }

    return NextResponse.json({ error: "Tipe notifikasi tidak dikenal." }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memproses pengiriman notifikasi." },
      { status: 500 }
    )
  }
}
