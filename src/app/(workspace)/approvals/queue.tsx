"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, X } from "lucide-react"
import { reviewApprovalRequest } from "./actions"

type ApprovalRequest = {
  id: string
  module_key: string
  record_type: string
  record_id: string
  required_role: string
  status: string
  requested_by: string
  created_at: string
}

const statusLabels: Record<string, string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
}

export function ApprovalQueue({ request }: { request: ApprovalRequest }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function decide(decision: "approved" | "rejected") {
    const note = window.prompt(
      decision === "approved" ? "Catatan persetujuan (wajib):" : "Alasan penolakan (wajib):",
    )
    if (note === null) return
    setBusy(true)
    setError("")
    try {
      const data = new FormData()
      data.set("requestId", request.id)
      data.set("decision", decision)
      data.set("note", note)
      await reviewApprovalRequest(data)
      router.refresh()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Keputusan gagal disimpan.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr>
      <td className="px-5 py-4">
        <p className="font-medium text-ink">{request.record_type}</p>
        <p className="mt-1 font-mono text-xs text-muted">{request.record_id.slice(0, 8)}</p>
        {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      </td>
      <td className="px-5 py-4 capitalize text-ink">{request.module_key}</td>
      <td className="px-5 py-4 capitalize text-muted">{request.required_role}</td>
      <td className="px-5 py-4 text-muted">{new Date(request.created_at).toLocaleDateString("id-ID")}</td>
      <td className="px-5 py-4">
        <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink">
          {statusLabels[request.status] ?? request.status}
        </span>
      </td>
      <td className="px-5 py-4">
        {request.status === "pending" ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => decide("approved")}
              aria-label="Setujui permintaan"
              className="flex size-9 items-center justify-center rounded-lg border border-line text-brand hover:bg-brand-light disabled:opacity-50"
            >
              <Check size={16} />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide("rejected")}
              aria-label="Tolak permintaan"
              className="flex size-9 items-center justify-center rounded-lg border border-line text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted">Selesai</span>
        )}
      </td>
    </tr>
  )
}
