"use server"

import { revalidatePath } from "next/cache"
import { requireWorkspace } from "@/lib/auth/context"
import { isRecordType, recordSpecs, isWorkflowMissing } from "@/lib/workflow"

export async function saveWorkflowDraft(
  formData: FormData,
): Promise<{ id?: string; error?: string }> {
  const { supabase, organizationId, role } = await requireWorkspace()
  const type = String(formData.get("recordType") ?? "")
  if (!isRecordType(type) || !recordSpecs[type].writers.includes(role))
    return { error: "Anda tidak memiliki izin untuk membuat dokumen ini." }
  const paymentCreate =
    type === "payment" &&
    !formData.get("targetId") &&
    formData.get("documentOperation") !== "update"
  const payload: Record<string, string | boolean | null> = {}
  for (const field of recordSpecs[type].fields) {
    const value = String(formData.get(field.name) ?? "").trim()
    if (field.required && !value && !(paymentCreate && field.name === "status"))
      return { error: `${field.label} wajib diisi.` }
    payload[field.name] =
      field.type === "checkbox" ? formData.has(field.name) : value || null
  }
  if (
    paymentCreate
  )
    payload.status = "unpaid"
  if (type === "payment" && payload.status === "paid") {
    if (!payload.paid_on || !payload.payment_method)
      return { error: "Tanggal dan metode pembayaran wajib saat menandai lunas." }
    if (
      typeof payload.invoice_date === "string" &&
      typeof payload.paid_on === "string" &&
      payload.paid_on < payload.invoice_date
    )
      return { error: "Tanggal pembayaran tidak boleh mendahului tanggal tagihan." }
  }
  if (type === "account")
    payload.normal_balance = ["liability", "equity", "revenue"].includes(
      String(payload.account_type),
    )
      ? "credit"
      : "debit"
  const { data, error } = await supabase.rpc("save_workflow_draft", {
    p_org: organizationId,
    p_type: type,
    p_payload: payload,
    p_document_id: formData.get("documentId") || null,
    p_expected_version: formData.get("version")
      ? Number(formData.get("version"))
      : null,
    p_target_id: formData.get("targetId") || null,
    p_target_version: formData.get("targetVersion")
      ? Number(formData.get("targetVersion"))
      : null,
  })
  if (error)
    return {
      error: isWorkflowMissing(error)
        ? "Pembaruan database workflow belum diterapkan."
        : error.message,
    }
  revalidatePath(`/modul/${recordSpecs[type].module}`)
  revalidatePath("/approvals")
  if (formData.get("documentId"))
    revalidatePath(`/dokumen/${formData.get("documentId")}`)
  return { id: String(data) }
}
