"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireWorkspace } from "@/lib/auth/context"

function finish(key: string, message: string): never {
  redirect(`/modul/keuangan?${new URLSearchParams({ [key]: message })}`)
}

export async function saveCoa(form: FormData) {
  const { supabase, organizationId, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) finish("error", "Perubahan dinonaktifkan dalam pratinjau.")
  const get = (key: string) => String(form.get(key) ?? "").trim()
  const payload = Object.fromEntries(["code", "name", "account_type", "normal_balance", "report_section", "posting_category"].map(key => [key, get(key)]))
  const { error } = await supabase.rpc("save_finance_account", {
    p_org: organizationId, p_id: get("id") || null,
    p_expected_version: get("id") ? Number(get("version")) : null,
    p_payload: { ...payload, parent_account_id: get("parent_account_id") || null, is_postable: get("is_postable") === "true", is_active: form.has("is_active") },
  })
  if (error) finish("error", error.message)
  revalidatePath("/modul/keuangan"); revalidatePath("/modul/akuntansi"); revalidatePath("/pengajuan", "layout")
  finish("notice", "COA tersimpan. Akun detail aktif tersedia pada pengajuan dan jurnal.")
}

export async function installCoa() {
  const { supabase, organizationId, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) finish("error", "Perubahan dinonaktifkan dalam pratinjau.")
  const { error } = await supabase.rpc("install_recommended_coa", { p_org: organizationId })
  if (error) finish("error", error.message)
  revalidatePath("/modul/keuangan"); revalidatePath("/pengajuan", "layout")
  finish("notice", "Rekomendasi COA dilengkapi tanpa membuat saldo atau transaksi.")
}
