"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Eye, EyeOff, Lock, User, ShieldAlert } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { Button } from "@/components/ui/button"
import { PageLoading } from "@/components/ui/page-loading"

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState(initialError ?? "")
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isNavigating, startNavigation] = useTransition()
  const busy = isSubmitting || isNavigating || isGoogleLoading

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setErrorMessage("")
    setIsSubmitting(true)

    const cleanEmail = email.trim()
    const cleanPassword = password

    if (!cleanEmail.includes("@")) {
      setErrorMessage("Gunakan alamat email lengkap (contoh: nama@perusahaan.com), bukan hanya username.")
      setIsSubmitting(false)
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      })
      if (error) {
        let msg = error.message
        if (msg.toLowerCase().includes("invalid login credentials")) {
          msg = "Email atau kata sandi tidak cocok. Pastikan akun sudah terdaftar di Supabase Auth dan kata sandi sesuai."
        } else if (msg.toLowerCase().includes("email not confirmed")) {
          msg = "Email belum dikonfirmasi. Periksa kotak masuk email Anda atau konfirmasi user di Supabase Dashboard."
        }
        setErrorMessage(msg)
        return
      }
      startNavigation(() => {
        router.replace("/dashboard")
        router.refresh()
      })
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Login tidak dapat diproses."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGoogleLogin() {
    if (busy) return
    setErrorMessage("")

    if (!isSupabaseConfigured()) {
      setErrorMessage("Konfigurasi Supabase belum lengkap di .env.local.")
      return
    }

    try {
      setIsGoogleLoading(true)
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setErrorMessage(`Login Google gagal: ${error.message}`)
        setIsGoogleLoading(false)
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Tidak dapat menghubungkan ke Google."
      )
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="mt-4">
      <form onSubmit={handleSubmit} aria-busy={busy} className="space-y-3">
        {busy && (
          <PageLoading
            overlay
            title={
              isGoogleLoading
                ? "Menghubungkan ke Google"
                : isSubmitting
                ? "Memverifikasi akun"
                : "Membuka workspace"
            }
            description={
              isGoogleLoading
                ? "Mohon tunggu, Anda sedang dialihkan..."
                : isSubmitting
                ? "Memeriksa kredensial login Anda..."
                : "Login berhasil. Menyiapkan dashboard Anda..."
            }
          />
        )}

        {/* Input Email / Username */}
        <div className="relative">
          <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            required
            disabled={busy}
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="Username or email address"
            className="h-11 w-full rounded-xl border border-slate-200/90 bg-slate-50/70 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 disabled:bg-slate-100"
          />
        </div>

        {/* Input Password dengan toggle show/hide */}
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            required
            disabled={busy}
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={email.trim().toLowerCase() === "demo@gsp.test" ? "off" : "current-password"}
            placeholder="Password"
            className="h-11 w-full rounded-xl border border-slate-200/90 bg-slate-50/70 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 disabled:bg-slate-100"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
            aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between text-xs pt-0.5">
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-600">
            <input
              type="checkbox"
              name="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="size-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Remember Me</span>
          </label>
          <Link
            href="/forgot-password"
            className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            Forgot Password?
          </Link>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700"
          >
            <ShieldAlert size={15} className="mt-0.5 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Button with Arrow */}
        <Button
          type="submit"
          disabled={busy}
          className="h-11 w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition active:scale-[0.99]"
        >
          <span>{busy ? "Memproses..." : "Login"}</span>
          <ArrowRight size={16} />
        </Button>
      </form>

      {/* OR CONTINUE WITH */}
      <div className="relative my-4 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200/80" />
        </div>
        <span className="relative bg-white px-2.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Or Continue With
        </span>
      </div>

      {/* Google Button */}
      <Button
        type="button"
        variant="secondary"
        onClick={handleGoogleLogin}
        disabled={busy}
        className="h-11 w-full rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99]"
      >
        <svg className="size-4 shrink-0" viewBox="0 0 24 24">
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
        <span className="text-xs font-semibold">Google</span>
      </Button>

      {/* Akses Cepat Tamu / Akun Demo (Hanya Lihat - Dikunci di Aplikasi & RLS Database) */}
      {process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN !== "false" && (
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col items-center gap-1.5 text-center">
          <p className="text-[11px] text-slate-400 font-medium">Ingin melihat pratinjau sistem (Hanya Lihat)?</p>
          <button
            type="button"
            onClick={() => {
              setEmail("demo@gsp.test")
              setPassword("GspPreview!2026#ReadOnly")
              setErrorMessage("")
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 active:scale-95"
          >
            <span>Gunakan Akun Demo (Read-Only)</span>
          </button>
        </div>
      )}
    </div>
  )
}
