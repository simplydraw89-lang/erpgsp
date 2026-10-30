"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { PageLoading } from "@/components/ui/page-loading"

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState(initialError ?? "")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isNavigating, startNavigation] = useTransition()
  const busy = isSubmitting || isNavigating

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setErrorMessage("")
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? ""),
      })
      if (error) {
        setErrorMessage(`Login gagal: ${error.message}`)
        return
      }
      startNavigation(() => {
        router.replace("/dashboard")
        router.refresh()
      })
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Login tidak dapat diproses.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={busy} className="mt-7 space-y-4">
      {busy && (
        <PageLoading
          overlay
          title={isSubmitting ? "Memverifikasi akun" : "Membuka workspace"}
          description={isSubmitting ? "Mohon tunggu, kami sedang memproses login Anda." : "Login berhasil. Halaman Anda sedang disiapkan."}
        />
      )}
      <label className="block space-y-2 text-sm font-medium text-ink">
        Email
        <input
          required
          disabled={busy}
          name="email"
          type="email"
          autoComplete="email"
          className="h-11 w-full rounded-lg border border-line bg-white px-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
        />
      </label>
      <label className="block space-y-2 text-sm font-medium text-ink">
        Kata sandi
        <input
          required
          disabled={busy}
          name="password"
          type="password"
          autoComplete="current-password"
          className="h-11 w-full rounded-lg border border-line bg-white px-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
        />
      </label>
      {errorMessage && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}
      <Button className="w-full" disabled={busy}>
        {busy ? "Mohon tunggu..." : "Masuk ke workspace"}
      </Button>
    </form>
  )
}
