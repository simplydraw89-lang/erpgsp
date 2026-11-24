/**
 * Notification Service Hub (Email & WhatsApp)
 * GSP ERP Enterprise Integration
 */

export interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

export interface WhatsAppPayload {
  phone: string
  message: string
}

export interface NotificationStatus {
  email: {
    configured: boolean
    provider: string
    fromAddress: string
  }
  whatsapp: {
    configured: boolean
    provider: string
    senderPhone?: string
  }
}

/**
 * Normalisasi nomor WhatsApp ke standar internasional (contoh: 0812345678 -> 62812345678)
 */
export function formatWhatsAppPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "")
  if (cleaned.startsWith("0")) {
    return "62" + cleaned.slice(1)
  }
  if (cleaned.startsWith("8")) {
    return "62" + cleaned
  }
  return cleaned
}

/**
 * Buat tautan langsung WhatsApp Click-to-Chat (wa.me)
 * Sangat berguna untuk pengiriman instan tanpa ketergantungan API pihak ketiga
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  const normalizedPhone = formatWhatsAppPhone(phone)
  const encodedText = encodeURIComponent(message)
  return `https://wa.me/${normalizedPhone}?text=${encodedText}`
}

/**
 * Cek status konfigurasi Notifikasi Email dan WhatsApp di sistem
 */
export function getNotificationConfigStatus(): NotificationStatus {
  const resendApiKey = process.env.RESEND_API_KEY || ""
  const smtpHost = process.env.SMTP_HOST || ""
  const fonnteToken = process.env.FONNTE_TOKEN || ""
  const wablasToken = process.env.WABLAS_TOKEN || ""

  let emailProvider = "None"
  if (resendApiKey) emailProvider = "Resend API"
  else if (smtpHost) emailProvider = "SMTP Server"

  let waProvider = "Click-to-Chat (Direct Link)"
  if (fonnteToken) waProvider = "Fonnte WhatsApp API"
  else if (wablasToken) waProvider = "Wablas WhatsApp API"

  return {
    email: {
      configured: Boolean(resendApiKey || smtpHost),
      provider: emailProvider,
      fromAddress: process.env.NOTIFICATION_FROM_EMAIL || "notifikasi@gsp.co.id",
    },
    whatsapp: {
      configured: Boolean(fonnteToken || wablasToken),
      provider: waProvider,
      senderPhone: process.env.WHATSAPP_SENDER_NUMBER || undefined,
    },
  }
}

/**
 * Kirim Notifikasi Email
 * Mendukung Resend API (HTTP REST) atau fallback logging
 */
export async function sendEmailNotification(
  payload: EmailPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.NOTIFICATION_FROM_EMAIL || "ERP GSP <onboarding@resend.dev>"

  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: Array.isArray(payload.to) ? payload.to : [payload.to],
          subject: payload.subject,
          html: payload.html,
          text: payload.text || payload.subject,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        return { success: false, error: result.message || "Gagal mengirim email via Resend" }
      }
      return { success: true, messageId: result.id }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Kesalahan koneksi email" }
    }
  }

  // Jika API key belum terpasang, catat ke konsol sebagai simulasi pengiriman aman
  console.info("[NOTIFICATION_EMAIL_MOCK]", {
    to: payload.to,
    subject: payload.subject,
    timestamp: new Date().toISOString(),
  })

  return {
    success: true,
    messageId: `mock-email-${Date.now()}`,
    error: "SIMULATED: RESEND_API_KEY belum dikonfigurasi di .env.local",
  }
}

/**
 * Kirim Notifikasi WhatsApp via Gateway Resmi
 * Mendukung Fonnte atau Wablas API
 */
export async function sendWhatsAppNotification(
  payload: WhatsAppPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const fonnteToken = process.env.FONNTE_TOKEN
  const wablasToken = process.env.WABLAS_TOKEN
  const wablasDomain = process.env.WABLAS_DOMAIN || "https://sby.wablas.com"
  const targetPhone = formatWhatsAppPhone(payload.phone)

  if (!targetPhone || targetPhone.length < 8) {
    return { success: false, error: "Nomor WhatsApp tidak valid." }
  }

  // 1. Coba via Fonnte Gateway
  if (fonnteToken) {
    try {
      const res = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: {
          Authorization: fonnteToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: targetPhone,
          message: payload.message,
          countryCode: "62",
        }),
      })
      const data = await res.json()
      if (data.status === true || data.status === "true") {
        return { success: true, messageId: data.id?.[0] || `fonnte-${Date.now()}` }
      }
      return { success: false, error: data.reason || data.message || "Gagal kirim via Fonnte" }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Koneksi gateway Fonnte gagal" }
    }
  }

  // 2. Coba via Wablas Gateway
  if (wablasToken) {
    try {
      const res = await fetch(`${wablasDomain}/api/send-message`, {
        method: "POST",
        headers: {
          Authorization: wablasToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: targetPhone,
          message: payload.message,
        }),
      })
      const data = await res.json()
      if (data.status === "success" || data.status === true) {
        return { success: true, messageId: data.data?.id || `wablas-${Date.now()}` }
      }
      return { success: false, error: data.message || "Gagal kirim via Wablas" }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Koneksi gateway Wablas gagal" }
    }
  }

  // Fallback simulasi logging jika token belum diisi
  console.info("[NOTIFICATION_WHATSAPP_MOCK]", {
    phone: targetPhone,
    message: payload.message,
    clickLink: generateWhatsAppLink(payload.phone, payload.message),
  })

  return {
    success: true,
    messageId: `mock-wa-${Date.now()}`,
    error: "SIMULATED: FONNTE_TOKEN / WABLAS_TOKEN belum diisi di .env.local",
  }
}
