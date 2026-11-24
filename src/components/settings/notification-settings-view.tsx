"use client"

import React, { useState, useEffect } from "react"
import {
  Mail,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Send,
  ExternalLink,
  ShieldAlert,
  HelpCircle,
  PhoneCall,
  BellRing,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { NotificationStatus } from "@/lib/notifications/service"

export function NotificationSettingsView() {
  const [status, setStatus] = useState<NotificationStatus | null>(null)
  const [loading, setLoading] = useState(true)

  // Form Uji Coba Email
  const [testEmail, setTestEmail] = useState("")
  const [emailSending, setEmailSending] = useState(false)
  const [emailResult, setEmailResult] = useState<{ success: boolean; msg: string } | null>(null)

  // Form Uji Coba WhatsApp
  const [testPhone, setTestPhone] = useState("")
  const [testMessage, setTestMessage] = useState("Uji Coba Notifikasi ERP GSP: Pemberitahuan penugasan proyek berjalan normal.")
  const [waSending, setWaSending] = useState(false)
  const [waResult, setWaResult] = useState<{ success: boolean; msg: string; clickLink?: string } | null>(null)

  useEffect(() => {
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => {
        setStatus(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function handleSendTestEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!testEmail) return
    setEmailSending(true)
    setEmailResult(null)

    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "email",
          recipient: testEmail,
          subject: "Uji Coba Notifikasi Email ERP GSP",
          message: "Halo, ini adalah pesan uji coba dari sistem ERP GSP. Layanan email Anda telah terhubung.",
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setEmailResult({
          success: true,
          msg: data.error
            ? `Berhasil disimulasikan (${data.error}). Masukkan RESEND_API_KEY untuk kirim nyata.`
            : "Email uji coba berhasil dikirim!",
        })
      } else {
        setEmailResult({
          success: false,
          msg: data.error || "Gagal mengirim email uji coba.",
        })
      }
    } catch {
      setEmailResult({ success: false, msg: "Koneksi ke server gagal." })
    } finally {
      setEmailSending(false)
    }
  }

  async function handleSendTestWhatsApp(e: React.FormEvent) {
    e.preventDefault()
    if (!testPhone) return
    setWaSending(true)
    setWaResult(null)

    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "whatsapp",
          recipient: testPhone,
          message: testMessage,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setWaResult({
          success: true,
          msg: data.error
            ? `Berhasil disimulasikan (${data.error}).`
            : "Pesan WhatsApp berhasil terkirim via Gateway!",
          clickLink: data.clickLink,
        })
      } else {
        setWaResult({
          success: false,
          msg: data.error || "Gagal mengirim pesan WhatsApp.",
          clickLink: data.clickLink,
        })
      }
    } catch {
      setWaResult({ success: false, msg: "Koneksi ke server gagal." })
    } finally {
      setWaSending(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="rounded-2xl border border-line bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-purple-50/30 p-6 dark:from-slate-900/60 dark:to-slate-800/40">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <BellRing size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">Pengaturan Notifikasi (Email & WhatsApp)</h2>
            <p className="text-xs text-muted">
              Pantau status koneksi gateway dan uji coba pengiriman pesan otomatis ke klien dan staf cabang.
            </p>
          </div>
        </div>
      </div>

      {/* Grid Status Gateway */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Gateway Email */}
        <Card className="space-y-4 p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50">
                <Mail size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">Notifikasi Email</h3>
                <p className="text-[11px] text-muted">Untuk notifikasi tagihan invoice, reset password & SPH/SPK</p>
              </div>
            </div>
            {status?.email.configured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                <CheckCircle2 size={12} /> Terhubung
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                <AlertCircle size={12} /> Mode Simulasi
              </span>
            )}
          </div>

          <div className="rounded-xl border border-line bg-slate-50/70 p-3 text-xs space-y-1.5 dark:bg-slate-900/50">
            <div className="flex justify-between">
              <span className="text-muted">Provider Aktif:</span>
              <span className="font-medium text-ink">{status?.email.provider || "Loading..."}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Email Pengirim:</span>
              <span className="font-medium text-ink">{status?.email.fromAddress || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Variabel Diperlukan:</span>
              <span className="font-mono text-[10px] text-brand">RESEND_API_KEY</span>
            </div>
          </div>

          {/* Form Uji Coba Email */}
          <form onSubmit={handleSendTestEmail} className="space-y-2 pt-2 border-t border-line">
            <label className="block text-xs font-medium text-ink">
              Uji Coba Kirim Email
              <div className="mt-1 flex gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Masukkan email Anda..."
                  required
                  className="flex-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-900"
                />
                <Button type="submit" disabled={emailSending} size="sm" className="gap-1.5 shrink-0">
                  <Send size={13} />
                  <span>{emailSending ? "Mengirim..." : "Kirim"}</span>
                </Button>
              </div>
            </label>
            {emailResult && (
              <p className={`text-[11px] rounded-lg p-2 ${emailResult.success ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300"}`}>
                {emailResult.msg}
              </p>
            )}
          </form>
        </Card>

        {/* Gateway WhatsApp */}
        <Card className="space-y-4 p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50">
                <MessageSquare size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">Notifikasi WhatsApp</h3>
                <p className="text-[11px] text-muted">Untuk instruksi tugas, persetujuan & pesan langsung klien</p>
              </div>
            </div>
            {status?.whatsapp.configured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                <CheckCircle2 size={12} /> Gateway Aktif
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                <PhoneCall size={12} /> Direct wa.me Ready
              </span>
            )}
          </div>

          <div className="rounded-xl border border-line bg-slate-50/70 p-3 text-xs space-y-1.5 dark:bg-slate-900/50">
            <div className="flex justify-between">
              <span className="text-muted">Metode:</span>
              <span className="font-medium text-ink">{status?.whatsapp.provider || "Loading..."}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Gateway Didukung:</span>
              <span className="font-medium text-ink">Fonnte, Wablas & Tautan wa.me</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Variabel Diperlukan:</span>
              <span className="font-mono text-[10px] text-brand">FONNTE_TOKEN / WABLAS_TOKEN</span>
            </div>
          </div>

          {/* Form Uji Coba WhatsApp */}
          <form onSubmit={handleSendTestWhatsApp} className="space-y-2 pt-2 border-t border-line">
            <label className="block text-xs font-medium text-ink">
              Uji Coba Kirim WhatsApp
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="08123456789 atau 628..."
                  required
                  className="flex-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs text-ink focus:border-brand focus:outline-none dark:bg-slate-900"
                />
                <Button type="submit" disabled={waSending} size="sm" className="gap-1.5 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Send size={13} />
                  <span>{waSending ? "Mengirim..." : "Kirim"}</span>
                </Button>
              </div>
            </label>
            {waResult && (
              <div className={`text-[11px] rounded-lg p-2.5 space-y-1.5 ${waResult.success ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"}`}>
                <p>{waResult.msg}</p>
                {waResult.clickLink && (
                  <a
                    href={waResult.clickLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    <span>Buka Tautan Langsung di WhatsApp Web/App</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}
          </form>
        </Card>
      </div>

      {/* Petunjuk Pengaktifan API Gateway */}
      <Card className="p-5 space-y-3 bg-slate-50/50 dark:bg-slate-900/40">
        <div className="flex items-center gap-2 text-ink font-semibold text-sm">
          <HelpCircle size={16} className="text-blue-600" />
          <span>Panduan Pengaktifan Otomatis Email & WhatsApp Gateway</span>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          Sistem ERP GSP telah menyediakan arsitektur integrasi lengkap. Untuk mengaktifkan pengiriman otomatis tanpa batas, tambahkan kredensial berikut ke dalam berkas <code className="rounded bg-slate-200 px-1 py-0.5 font-mono text-[11px] text-slate-800 dark:bg-slate-800 dark:text-slate-200">.env.local</code> di server:
        </p>
        <div className="rounded-xl bg-slate-900 p-3.5 text-xs font-mono text-slate-200 space-y-1">
          <p className="text-slate-400"># 1. Notifikasi Email via Resend (Gratis 3.000 email/bulan)</p>
          <p className="text-emerald-400">RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx</p>
          <p className="text-emerald-400">NOTIFICATION_FROM_EMAIL=&quot;ERP GSP &lt;notifikasi@domain-anda.com&gt;&quot;</p>
          <p className="text-slate-400 pt-1"># 2. Notifikasi WhatsApp Otomatis via Fonnte atau Wablas</p>
          <p className="text-emerald-400">FONNTE_TOKEN=xxxxxxxxxxxxxxxxxxxx</p>
          <p className="text-slate-400"># ATAU via Wablas:</p>
          <p className="text-slate-400"># WABLAS_TOKEN=xxxxxxxxxxxxxx</p>
          <p className="text-slate-400"># WABLAS_DOMAIN=https://sby.wablas.com</p>
        </div>
      </Card>
    </div>
  )
}
