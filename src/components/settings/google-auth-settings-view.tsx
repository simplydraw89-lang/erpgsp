"use client"

import React, { useState } from "react"
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  KeyRound,
  Globe,
  LogIn,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export function GoogleAuthSettingsView() {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [testingOAuth, setTestingOAuth] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const redirectUri = supabaseUrl ? `${supabaseUrl}/auth/v1/callback` : "(Supabase URL belum diatur)"
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2500)
  }

  async function handleTestGoogleLogin() {
    setTestingOAuth(true)
    setTestError(null)

    if (!isSupabaseConfigured()) {
      setTestError("Konfigurasi Supabase URL / Anon Key belum lengkap di .env.local.")
      setTestingOAuth(false)
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${currentOrigin}/auth/callback`,
        },
      })

      if (error) {
        setTestError(`Inisialisasi Google OAuth ditolak Supabase: ${error.message}. Pastikan Google Provider sudah diaktifkan di Supabase Dashboard.`)
        setTestingOAuth(false)
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Gagal menginisialisasi Google OAuth.")
      setTestingOAuth(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="rounded-2xl border border-line bg-gradient-to-r from-red-50/50 via-amber-50/30 to-blue-50/30 p-6 dark:from-slate-900/60 dark:to-slate-800/40">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white shadow-md border border-slate-200 text-slate-800">
            <svg className="size-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">Integrasi Login via Google (Single Sign-On)</h2>
            <p className="text-xs text-muted">
              Status otentikasi Google OAuth untuk memudahkan staf login menggunakan akun Google perusahaan (@perusahaan.com).
            </p>
          </div>
        </div>
      </div>

      {/* Status & Test Card */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h3 className="text-sm font-bold text-ink">Status Kesiapan Login Google</h3>
            <p className="text-xs text-muted">Kode integrasi frontend & penanganan callback auth sudah terpasang.</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
            <CheckCircle2 size={13} /> Modul Kode Siap
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted flex items-center justify-between">
              <span>Supabase Callback URL (Wajib di Google Cloud):</span>
              <button
                type="button"
                onClick={() => copyToClipboard(redirectUri, "callback")}
                className="text-[11px] text-brand hover:underline flex items-center gap-1"
              >
                <Copy size={11} />
                <span>{copiedField === "callback" ? "Tersalin!" : "Salin URL"}</span>
              </button>
            </label>
            <div className="rounded-lg border border-line bg-slate-50 p-2.5 text-xs font-mono text-slate-800 break-all dark:bg-slate-900 dark:text-slate-200">
              {redirectUri}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted flex items-center justify-between">
              <span>Authorized JavaScript Origin:</span>
              <button
                type="button"
                onClick={() => copyToClipboard(currentOrigin, "origin")}
                className="text-[11px] text-brand hover:underline flex items-center gap-1"
              >
                <Copy size={11} />
                <span>{copiedField === "origin" ? "Tersalin!" : "Salin Origin"}</span>
              </button>
            </label>
            <div className="rounded-lg border border-line bg-slate-50 p-2.5 text-xs font-mono text-slate-800 break-all dark:bg-slate-900 dark:text-slate-200">
              {currentOrigin}
            </div>
          </div>
        </div>

        {/* Uji Coba Tombol */}
        <div className="pt-2">
          <Button
            type="button"
            onClick={handleTestGoogleLogin}
            disabled={testingOAuth}
            variant="secondary"
            className="gap-2 text-xs font-semibold border-slate-300 dark:border-slate-700"
          >
            <LogIn size={14} />
            <span>{testingOAuth ? "Mengalihkan ke Google..." : "Uji Coba Buka Alur Login Google Sekarang"}</span>
          </Button>

          {testError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-800 dark:bg-red-950/50 dark:text-red-300">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-600" />
              <span>{testError}</span>
            </div>
          )}
        </div>
      </Card>

      {/* 3 Langkah Mudah Mengaktifkan di Supabase Dashboard */}
      <Card className="p-5 space-y-3.5 bg-slate-50/50 dark:bg-slate-900/40">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2">
          <KeyRound size={16} className="text-blue-600" />
          <span>3 Langkah Pengaktifan Google OAuth di Supabase Console</span>
        </h3>
        <ol className="list-decimal list-inside text-xs text-muted space-y-2 leading-relaxed">
          <li>
            <strong className="text-ink">Buat Kredensial di Google Cloud Console</strong>: Buka <em>APIs & Services &gt; Credentials</em>, buat <strong>OAuth client ID</strong> (Web application). Masukkan Callback URL di atas ke kolom <em>Authorized redirect URIs</em>.
          </li>
          <li>
            <strong className="text-ink">Salin Client ID & Client Secret</strong>: Salin kedua nilai tersebut dari Google Cloud Console.
          </li>
          <li>
            <strong className="text-ink">Aktifkan di Supabase Dashboard</strong>: Buka proyek Supabase Anda &gt; <em>Authentication &gt; Providers &gt; Google</em>. Centang <strong>Enable Google provider</strong>, tempel Client ID & Secret, lalu klik <strong>Save</strong>.
          </li>
        </ol>
      </Card>
    </div>
  )
}
