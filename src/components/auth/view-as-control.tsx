"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import type { OrganizationRole } from "@/lib/auth/context"
import { roleLabels } from "@/lib/app-catalog"
import { previewRoles } from "@/lib/auth/view-as-roles"

export function ViewAsControl({
  actorRole,
  role,
  isActive,
  isInvalid,
}: {
  actorRole: OrganizationRole
  role: OrganizationRole
  isActive: boolean
  isInvalid: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  if (actorRole !== "owner") return null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    const formData = new FormData(event.currentTarget)
    const role = String(formData.get("role") ?? "")
    startTransition(async () => {
      await updatePreview("POST", role)
    })
  }

  function exitPreview() {
    setError("")
    startTransition(async () => {
      await updatePreview("DELETE")
    })
  }

  async function updatePreview(method: "POST" | "DELETE", role?: string) {
    try {
      const response = await fetch("/api/view-as", {
        method,
        headers: method === "POST" ? { "Content-Type": "application/json" } : {},
        body: method === "POST" ? JSON.stringify({ role }) : undefined,
      })
      const result: { error?: string } | null = await response
        .json()
        .catch(() => null)

      if (!response.ok) {
        setError(result?.error ?? "Permintaan pratinjau gagal.")
        return
      }

      router.refresh()
    } catch (error) {
      setError(
        error instanceof Error
          ? `Permintaan pratinjau gagal: ${error.message}`
          : "Permintaan pratinjau gagal.",
      )
    }
  }

  return (
    <div className="min-w-52 rounded-lg border border-slate-200 bg-white p-3 text-slate-900 shadow-sm">
      <p className="flex items-center gap-2 text-xs font-semibold">
        <Eye size={15} aria-hidden="true" />
        Lihat sebagai · UI saja
      </p>
      {isActive ? (
        <div className="mt-2">
          <p className="text-xs text-slate-600">
            {isInvalid
              ? "Sesi pratinjau berakhir atau tidak valid. Mode tulis tetap dikunci."
              : `Pratinjau ${roleLabels[role]} aktif.`}
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={exitPreview}
            className="mt-2 inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            <EyeOff size={14} aria-hidden="true" />
            {pending ? "Memproses..." : "Akhiri pratinjau"}
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-2 flex items-center gap-2">
          <label className="sr-only" htmlFor="view-as-role">
            Peran pratinjau
          </label>
          <select
            id="view-as-role"
            name="role"
            defaultValue=""
            required
            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="" disabled>
              Pilih peran
            </option>
            {previewRoles.map((previewRole) => (
              <option key={previewRole} value={previewRole}>
                {roleLabels[previewRole]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pending ? "..." : "Lihat"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

export function ViewAsBanner({
  role,
  isInvalid,
}: {
  role: OrganizationRole
  isInvalid: boolean
}) {
  return (
    <aside
      role="status"
      className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 md:px-8"
    >
      <p className="mx-auto max-w-[1500px]">
        <strong>
          {isInvalid
            ? "Mode lihat sebagai tidak valid"
            : `Mode lihat sebagai: ${roleLabels[role]}`}
        </strong>
        {" · "}Mode UI read-only: perubahan dan persetujuan diblokir. Data tetap
        menggunakan akses akun Superuser; ini bukan simulasi RLS dan tidak
        merepresentasikan batas data peran tersebut.
      </p>
    </aside>
  )
}
