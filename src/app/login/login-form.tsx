"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState(initialError ?? "")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
      router.replace("/dashboard")
      router.refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Login tidak dapat diproses.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 space-y-4">
      <label className="block space-y-2 text-sm font-medium text-ink">
        Email
        <input
          required
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
      <Button className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Memverifikasi..." : "Masuk ke workspace"}
      </Button>
    </form>
  )
}
