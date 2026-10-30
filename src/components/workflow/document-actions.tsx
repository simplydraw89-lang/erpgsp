"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { transitionDocument } from "@/app/(workspace)/approvals/actions"
import { Button } from "@/components/ui/button"

export function DocumentActions({
  id,
  version,
  canSubmit,
  canReview,
  canExecute,
  canRevise,
}: {
  id: string
  version: number
  canSubmit: boolean
  canReview: boolean
  canExecute: boolean
  canRevise: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [note, setNote] = useState("")
  function act(action: string) {
    if (pending) return
    setError("")
    startTransition(async () => {
      try {
        const data = new FormData()
        data.set("documentId", id)
        data.set("version", String(version))
        data.set("action", action)
        data.set("note", note)
        const result = await transitionDocument(data)
        if (result.error) setError(result.error)
        else startTransition(() => router.refresh())
      } catch {
        setError("Permintaan gagal diproses. Silakan coba kembali.")
      }
    })
  }
  return (
    <div aria-busy={pending} className="space-y-4">
      {canReview && (
        <label className="block text-sm font-medium">
          Catatan keputusan (wajib)
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={pending}
            maxLength={2000}
            rows={3}
            className="mt-2 w-full rounded-lg border border-line p-3"
          />
        </label>
      )}
      <div className="flex flex-wrap gap-3">
        {canSubmit && (
          <Button onClick={() => act("submit")} disabled={pending}>
            Ajukan pemeriksaan
          </Button>
        )}
        {canReview && (
          <>
            <Button
              onClick={() => act("approved")}
              disabled={pending || !note.trim()}
            >
              Setujui versi {version}
            </Button>
            <Button
              variant="secondary"
              onClick={() => act("rejected")}
              disabled={pending || !note.trim()}
            >
              Tolak
            </Button>
          </>
        )}
        {canExecute && (
          <Button onClick={() => act("execute")} disabled={pending}>
            Eksekusi versi {version}
          </Button>
        )}
        {canRevise && (
          <Button onClick={() => act("revise")} disabled={pending}>
            Buat revisi draft
          </Button>
        )}
      </div>
      {pending && (
        <p role="status" className="text-sm text-brand">
          Memproses dokumen...
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  )
}
