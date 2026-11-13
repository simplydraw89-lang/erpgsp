"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireWorkspace } from "@/lib/auth/context"

const taxPath = "/modul/perpajakan"

function finish(key: "notice" | "error", message: string): never {
  const query = new URLSearchParams({ [key]: message })
  redirect(`${taxPath}?${query.toString()}`)
}

export async function saveFiscalAdjustmentAction(data: FormData) {
  const { supabase, organizationId, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) {
    finish("error", "Mode lihat sebagai aktif: perubahan dinonaktifkan.")
  }

  const fiscalYear = Number(data.get("fiscal_year") ?? new Date().getFullYear())
  const adjustmentType = String(data.get("adjustment_type") ?? "").trim()
  const differenceKind = String(data.get("difference_kind") ?? "permanent").trim()
  const accountCode = String(data.get("account_code") ?? "").trim()
  const description = String(data.get("description") ?? "").trim()
  const amount = Number(data.get("amount") ?? 0)
  const taxRuleRef = String(data.get("tax_rule_ref") ?? "").trim()

  if (!Number.isInteger(fiscalYear) || fiscalYear < 2020 || fiscalYear > 2100) {
    finish("error", "Tahun pajak tidak valid.")
  }
  if (!description || !Number.isFinite(amount) || amount <= 0) {
    finish("error", "Uraian dan nominal koreksi fiskal harus lebih dari nol.")
  }

  const { error } = await supabase.rpc("save_fiscal_adjustment", {
    p_org: organizationId,
    p_fiscal_year: fiscalYear,
    p_adjustment_type: adjustmentType,
    p_difference_kind: differenceKind,
    p_account_code: accountCode || null,
    p_description: description,
    p_amount: amount,
    p_tax_rule_ref: taxRuleRef || null,
  })

  if (error) finish("error", error.message)
  revalidatePath(taxPath)
  finish("notice", "Koreksi fiskal berhasil disimpan.")
}

export async function deleteFiscalAdjustmentAction(data: FormData) {
  const { supabase, organizationId, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) {
    finish("error", "Mode lihat sebagai aktif: penghapusan dinonaktifkan.")
  }

  const adjustmentId = String(data.get("adjustment_id") ?? "").trim()
  if (!adjustmentId) finish("error", "ID koreksi fiskal tidak ditemukan.")

  const { error } = await supabase.rpc("delete_fiscal_adjustment", {
    p_org: organizationId,
    p_adjustment_id: adjustmentId,
  })

  if (error) finish("error", error.message)
  revalidatePath(taxPath)
  finish("notice", "Koreksi fiskal berhasil dihapus.")
}
