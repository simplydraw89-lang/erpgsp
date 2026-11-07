"use client"

import { FormEvent, useState, useTransition } from "react"
import Link from "next/link"
import Image from "next/image"
import { CheckCircle2, LockKeyhole, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageLoading } from "@/components/ui/page-loading"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export function ResetPasswordForm() {
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage("")
    setSuccessMessage("")

    if (!isSupabaseConfigured()) {
      setErrorMessage("Konfigurasi Supabase belum lengkap di .env.local.")
      return
    }

    const formData = new FormData(event.currentTarget)
    const password = String(formData.get("password") ?? "")
    const confirmPassword = String(formData.get("confirmPassword") ?? "")

    if (!password || password.length < 8) {
      setErrorMessage("Kata sandi baru minimal 8 karakter.")
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage("Konfirmasi kata sandi tidak cocok.")
      return
    }

    startTransition(async () => {
      try {
        const supabase = createClient()
        const { error } = await supabase.auth.updateUser({ password })

        if (error) {
          setErrorMessage(error.message)
        } else {
          setSuccessMessage("Kata sandi Anda berhasil diperbarui! Silakan login dengan kata sandi baru.")
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Gagal memperbarui kata sandi.")
      }
    })
  }

  return (
    <main className="portal-background flex h-dvh w-full items-center justify-center overflow-hidden p-4">
      <div className="w-full max-w-[390px] rounded-[28px] border border-slate-200/80 bg-white/95 px-6 py-6 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.08)] backdrop-blur-md sm:px-8 sm:py-7">
        <div className="flex flex-col items-center text-center">
          <div className="mb-2.5 flex size-16 items-center justify-center rounded-full border border-slate-100 bg-white p-2 shadow-[0_6px_20px_rgba(0,0,0,0.06)]">
            <Image
              src="/gsp-brand-logo.jpg"
              alt="PT. Global Solusi Prima"
              width={80}
              height={80}
              priority
              unoptimized
              className="h-full w-full object-contain select-none"
            />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Buat Kata Sandi Baru
          </h1>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            PT. Global Solusi Prima
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Silakan masukkan kata sandi baru Anda untuk akun perusahaan ini.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700"
          >
            <ShieldAlert size={15} className="mt-0.5 shrink-0 text-red-600" />
            <div>
              <p className="font-semibold">{errorMessage}</p>
            </div>
          </div>
        )}

        {successMessage ? (
          <div className="mt-5 space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-semibold">Berhasil</p>
                <p className="mt-0.5 leading-relaxed">{successMessage}</p>
              </div>
            </div>
            <Link href="/login" className="block w-full">
              <Button className="h-11 w-full rounded-xl font-semibold text-xs">
                Masuk ke Workspace
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            {isPending && (
              <PageLoading
                overlay
                title="Menyimpan kata sandi baru"
                description="Memperbarui kata sandi..."
              />
            )}
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                required
                disabled={isPending}
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Kata sandi baru (min. 8 karakter)"
                className="h-11 w-full rounded-xl border border-slate-200/90 bg-slate-50/70 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 disabled:bg-slate-100"
              />
            </div>

            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                required
                disabled={isPending}
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Ulangi kata sandi baru"
                className="h-11 w-full rounded-xl border border-slate-200/90 bg-slate-50/70 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 disabled:bg-slate-100"
              />
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="h-11 w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition active:scale-[0.99]"
            >
              {isPending ? "Memproses..." : "Simpan Kata Sandi"}
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}
