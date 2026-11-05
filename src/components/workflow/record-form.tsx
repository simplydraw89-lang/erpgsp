"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  labels,
  recordSpecs,
  type RecordType,
  type ReferenceOptions,
} from "@/lib/workflow"
import { saveWorkflowDraft } from "@/app/(workspace)/modul/actions"

export function RecordForm({
  type,
  values = {},
  references = {},
  documentId,
  operation,
  version,
  targetId,
  targetVersion,
}: {
  type: RecordType
  values?: Record<string, unknown>
  references?: ReferenceOptions
  documentId?: string
  operation?: "create" | "update"
  version?: number
  targetId?: string
  targetVersion?: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [paymentStatus, setPaymentStatus] = useState(
    String(values.status ?? "unpaid"),
  )
  const [advancePurpose, setAdvancePurpose] = useState(
    String(values.purpose_type ?? "project"),
  )
  const paymentUpdate = Boolean(targetId || operation === "update")
  const fields = recordSpecs[type].fields.filter((field) => {
    if (type === "advance") {
      if (advancePurpose === "project" && ["trip_destination", "departure_on", "return_on"].includes(field.name)) return false
      if (advancePurpose === "business_trip" && field.name === "project_id") return false
    }
    if (type !== "payment") return true
    if (!paymentUpdate && ["status", "paid_on", "payment_method", "reference_number"].includes(field.name))
      return false
    if (paymentStatus !== "paid" && ["paid_on", "payment_method"].includes(field.name))
      return false
    return true
  })
  const inputClass =
    "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
  return (
    <form
      aria-busy={pending}
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (pending) return
        const data = new FormData(event.currentTarget)
        setError("")
        startTransition(async () => {
          try {
            const result = await saveWorkflowDraft(data)
            if (result.error) setError(result.error)
            else if (result.id) {
              startTransition(() => router.push(`/dokumen/${result.id}`))
              router.refresh()
            }
          } catch {
            setError("Dokumen gagal disimpan. Silakan coba kembali.")
          }
        })
      }}
    >
      <input type="hidden" name="recordType" value={type} />
      {documentId && (
        <>
          <input type="hidden" name="documentId" value={documentId} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="documentOperation" value={operation} />
        </>
      )}
      {targetId && (
        <>
          <input type="hidden" name="targetId" value={targetId} />
          <input type="hidden" name="targetVersion" value={targetVersion} />
        </>
      )}
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const value = values[field.name] ?? field.defaultValue ?? ""
          const requiredField =
            field.required ||
            (type === "advance" &&
              ((advancePurpose === "project" && field.name === "project_id") ||
                (advancePurpose === "business_trip" && ["trip_destination", "departure_on", "return_on"].includes(field.name)))) ||
            (type === "payment" &&
              paymentStatus === "paid" &&
              ["paid_on", "payment_method"].includes(field.name))
          return (
            <label
              key={field.name}
              className={`space-y-1.5 text-sm font-medium text-ink ${field.type === "textarea" ? "sm:col-span-2" : ""}`}
            >
              <span className="block">
                {field.label}
                {requiredField ? " *" : ""}
              </span>
              {field.type === "select" || field.type === "reference" ? (
                <select
                aria-label={field.label}
                  name={field.name}
                  required={requiredField}
                  defaultValue={String(value)}
                  onChange={
                    type === "payment" && field.name === "status"
                      ? (event) => setPaymentStatus(event.target.value)
                      : type === "advance" && field.name === "purpose_type"
                        ? (event) => setAdvancePurpose(event.target.value)
                        : undefined
                  }
                  className={inputClass}
                >
                  {field.type === "reference" && (
                    <option value="">Belum ditentukan</option>
                  )}
                  {(field.type === "reference"
                    ? (references[field.name] ?? [])
                    : (field.options ?? []).map((v) => ({
                        value: v,
                        label: labels[v] ?? v,
                      }))
                  ).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  name={field.name}
                  defaultValue={String(value)}
                  maxLength={2000}
                  rows={3}
                  required={requiredField}
                  className={inputClass}
                />
              ) : field.type === "checkbox" ? (
                <input
                  name={field.name}
                  type="checkbox"
                  defaultChecked={Boolean(value)}
                  className="size-5 accent-brand"
                />
              ) : (
                <input
                  name={field.name}
                  type={
                    field.type === "money" ? "number" : (field.type ?? "text")
                  }
                  min={field.type === "money" ? "0" : undefined}
                  step={field.type === "money" ? "0.01" : undefined}
                  maxLength={2000}
                  required={requiredField}
                  readOnly={type === "advance" && field.name === "advance_number"}
                  placeholder={type === "advance" && field.name === "advance_number" && !value ? "Dibuat otomatis saat draft disimpan" : undefined}
                  defaultValue={String(value)}
                  className={inputClass}
                />
              )}
            </label>
          )
        })}
      </fieldset>
      <p className="text-xs leading-5 text-muted">
        {type === "advance"
          ? "Kasbon harus disetujui Manager lalu Accounting & Finance. Setelah eksekusi, kewajiban pencairan otomatis tercatat di modul Pembayaran."
          : type === "payment"
          ? paymentUpdate
            ? "Perubahan status lunas merupakan usulan pembayaran. Isi tanggal, metode, dan referensi; data resmi baru berubah setelah disetujui dan dieksekusi."
            : "Tagihan baru selalu dimulai sebagai belum lunas. Draft belum mengubah data resmi; ajukan untuk diperiksa, lalu tunggu persetujuan dan eksekusi."
          : "Draft belum mengubah data resmi. Ajukan pemeriksaan, tunggu persetujuan, lalu eksekusi."}
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending
          ? "Menyimpan..."
          : documentId
            ? "Simpan perubahan draft"
            : "Simpan draft"}
      </Button>
    </form>
  )
}
