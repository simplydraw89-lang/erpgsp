"use client"

import { FormEvent, useState, useTransition } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, CheckCircle2, Mail, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageLoading } from "@/components/ui/page-loading"
import { requestPasswordReset } from "./actions"

export function ForgotPasswordForm() {
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage("")
    setSuccessMessage("")

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get("email") ?? "").trim()

    if (!email) {
      setErrorMessage("Email wajib diisi.")
      return
    }

    startTransition(async () => {
      const origin = window.location.origin
      const result = await requestPasswordReset(email, origin)

      if (!result.success) {
        setErrorMessage(result.error ?? "Permintaan gagal diproses.")
      } else {
        setSuccessMessage(
          "Tautan reset password telah dikirim ke email Anda. Silakan periksa kotak masuk atau folder spam Anda."
        )
      }
    })
  }

  return (
    <main className="portal-background flex h-dvh w-full items-center justify-center overflow-hidden p-4">
      <div className="w-full max-w-[390px] rounded-[28px] border border-slate-200/80 bg-white/95 px-6 py-6 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.08)] backdrop-blur-md sm:px-8 sm:py-7">
        <Link
          href="/login"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
        >
          <ArrowLeft size={14} />
          Back to Login
        </Link>

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
            Reset Password
          </h1>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Recover Your Account
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Masukkan email terdaftar Anda untuk menerima tautan pembuatan kata sandi baru.
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
                <p className="font-semibold">Email Terkirim</p>
                <p className="mt-0.5 leading-relaxed">{successMessage}</p>
              </div>
            </div>
            <Link href="/login" className="block w-full">
              <Button
                variant="secondary"
                className="h-11 w-full rounded-xl border border-slate-200 font-semibold text-xs"
              >
                Kembali ke Login
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            {isPending && (
              <PageLoading
                overlay
                title="Memeriksa akun"
                description="Memproses verifikasi email..."
              />
            )}
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                required
                disabled={isPending}
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Username or email address"
                className="h-11 w-full rounded-xl border border-slate-200/90 bg-slate-50/70 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 disabled:bg-slate-100"
              />
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="h-11 w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition active:scale-[0.99]"
            >
              {isPending ? "Memproses..." : "Kirim Reset Password"}
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}
