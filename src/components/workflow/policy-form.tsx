"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { labels, recordSpecs, type RecordType } from "@/lib/workflow"
import { updateApprovalPolicy } from "@/app/(workspace)/pengaturan/persetujuan/actions"

export type ApprovalPolicy = {
  record_type: RecordType
  reviewer_role: string
  escalation_amount: number | null
  escalation_role: string
  version: number
}
export function PolicyForm({
  policy,
  canEdit,
}: {
  policy: ApprovalPolicy
  canEdit: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState("")
  const [failed, setFailed] = useState(false)
  const router = useRouter()
  const spec = recordSpecs[policy.record_type]
  const roles = ["owner", "director", "finance", "hr", "operations"].filter(
    (role) => spec.readers.some((reader) => reader === role),
  )
  const money = ["asset", "tax_record", "payment"].includes(policy.record_type)
  const inputClass =
    "mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (pending) return
        const data = new FormData(event.currentTarget)
        setMessage("")
        startTransition(async () => {
          try {
            const result = await updateApprovalPolicy(data)
            setFailed(!!result.error)
            setMessage(
              result.error ??
                "Kebijakan disimpan. Berlaku untuk pengajuan berikutnya.",
            )
            if (!result.error) startTransition(() => router.refresh())
          } catch {
            setFailed(true)
            setMessage("Kebijakan gagal disimpan.")
          }
        })
      }}
    >
      <input type="hidden" name="recordType" value={policy.record_type} />
      <input type="hidden" name="version" value={policy.version} />
      <h2 className="text-lg font-semibold">{spec.label}</h2>
      <p className="text-xs text-muted">Kebijakan versi {policy.version}</p>
      <fieldset
        disabled={!canEdit || pending}
        className="grid gap-4 sm:grid-cols-3"
      >
        <label className="text-sm">
          Pemeriksa utama
          <select
            aria-label="Pemeriksa utama"
            name="reviewer"
            defaultValue={policy.reviewer_role}
            className={inputClass}
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {labels[role]}
              </option>
            ))}
          </select>
        </label>
        {money ? (
          <>
            <label className="text-sm">
              Eskalasi mulai nominal (IDR)
              <input
                aria-label="Eskalasi mulai nominal (IDR)"
                type="number"
                name="threshold"
                step="0.01"
                min="0"
                defaultValue={policy.escalation_amount ?? ""}
                placeholder="Kosong = tanpa eskalasi"
                className={inputClass}
              />
            </label>
            <label className="text-sm">
              Pemeriksa eskalasi
              <select
                aria-label="Pemeriksa eskalasi"
                name="escalation"
                defaultValue={policy.escalation_role}
                className={inputClass}
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {labels[role]}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <input type="hidden" name="escalation" value="owner" />
        )}
      </fieldset>
      {money && (
        <p className="text-xs text-muted">
          Nominal menggunakan{" "}
          {policy.record_type === "asset"
            ? "nilai perolehan aset"
            : policy.record_type === "tax_record"
              ? "nilai pajak"
              : "jumlah pembayaran"}
          . Batas bersifat inklusif (nominal ≥ batas).
        </p>
      )}
      {canEdit && (
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan kebijakan"}
        </Button>
      )}
      {message && (
        <p
          role={failed ? "alert" : "status"}
          className={`text-sm ${failed ? "text-red-700" : "text-brand"}`}
        >
          {message}
        </p>
      )}
    </form>
  )
}
