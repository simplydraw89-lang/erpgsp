"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireWorkspace } from "@/lib/auth/context"

function value(data: FormData, key: string) { return String(data.get(key) ?? "").trim() }
function destination(data: FormData) { const id = value(data, "id"); return /^[0-9a-f-]{36}$/i.test(id) ? `/pengajuan/${id}` : "/pengajuan" }
function finish(path: string, kind: "error" | "notice", message: string): never { redirect(`${path}${path.includes("?") ? "&" : "?"}${new URLSearchParams({ [kind]: message })}`) }
async function workspace(path: string) {
  const context = await requireWorkspace()
  if (context.isReadOnlyPreview) finish(path, "error", "Mode lihat sebagai aktif. Perubahan dinonaktifkan.")
  return context
}
async function call(path: string, name: string, args: Record<string, unknown>, message: string, nextDetail = false) {
  const { supabase } = await workspace(path)
  const { data, error } = await supabase.rpc(name, args)
  if (error) finish(path, "error", error.message)
  revalidatePath("/pengajuan", "layout")
  revalidatePath("/pengajuan/pembelian")
  revalidatePath("/vendor")
  revalidatePath("/pekerjaan-saya")
  revalidatePath("/dashboard")
  revalidatePath("/approvals")
  revalidatePath("/modul/akuntansi")
  finish(nextDetail && typeof data === "string" ? `/pengajuan/${data}` : path, "notice", message)
}
function json(data: FormData, key: string, path: string): unknown {
  try { return JSON.parse(value(data, key) || "[]") } catch { finish(path, "error", "Rincian formulir tidak valid. Muat ulang dan coba kembali.") }
}
export async function initializePurchasing(data: FormData) {
  const path = "/pengajuan/pembelian/baru"
  const context = await workspace(path)
  if (context.actorRole !== "owner") finish(path, "error", "Hanya Super Admin dapat menyiapkan data awal pembelian.")
  const month = value(data, "month")
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) finish(path, "error", "Pilih bulan pembukuan yang valid.")
  const start = `${month}-01`
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10)
  await call(path, "initialize_purchasing_workspace", { p_org: context.organizationId, p_starts_on: start, p_ends_on: end }, "Cabang pembukuan, periode dan COA awal siap. Periksa COA sesuai kebijakan perusahaan sebelum posting pertama.")
}
export async function savePurchase(data: FormData) {
  const isSubmit = value(data, "action_type") === "submit";
  const redirectTarget = "/pengajuan/pembelian";
  const context = await workspace(redirectTarget);

  // 1. Simpan perubahan pengajuan / invoice
  const { data: savedId, error: saveError } = await context.supabase.rpc("save_purchase_request", {
    p_org: context.organizationId,
    p_branch: value(data, "branch_id"),
    p_id: value(data, "id") || null,
    p_version: value(data, "version") ? Number(value(data, "version")) : null,
    p_payload: {
      invoice_number: value(data, "invoice_number"),
      invoice_date: value(data, "invoice_date"),
      tax_invoice_number: value(data, "tax_invoice_number") || null,
      tax_invoice_date: value(data, "tax_invoice_date") || null,
      vendor_id: value(data, "vendor_id") || null,
      vendor_snapshot: { name: value(data, "vendor_name"), address: value(data, "vendor_address") },
      lines: json(data, "lines", redirectTarget),
      vat_mode: value(data, "vat_mode"),
      vat_creditable: data.get("vat_creditable") === "on",
      withholding_code: value(data, "withholding_code"),
      withholding_rate: Number(value(data, "withholding_rate") || 0),
      withholding_timing: value(data, "withholding_timing") || "invoice",
      withholding_base: Number(value(data, "withholding_base") || value(data, "base_fallback") || 0),
      requested_payment_date: value(data, "requested_payment_date") || null,
      notes: value(data, "notes"),
      attachment_ids: json(data, "attachment_ids", redirectTarget),
    },
  });

  if (saveError) finish(redirectTarget, "error", saveError.message);

  const purchaseId = typeof savedId === "string" ? savedId : value(data, "id");

  // 2. Jika user mengklik "Kirim pengajuan"
  if (isSubmit && purchaseId) {
    const { data: currentDoc } = await context.supabase
      .from("purchase_requests")
      .select("version")
      .eq("id", purchaseId)
      .maybeSingle();

    const currentVersion = currentDoc?.version ?? 0;

    const { error: submitError } = await context.supabase.rpc("submit_purchase_request", {
      p_id: purchaseId,
      p_version: currentVersion,
    });

    if (submitError) finish(redirectTarget, "error", submitError.message);
  }

  // 3. Revalidasi semua halaman terkait
  revalidatePath("/pengajuan", "layout");
  revalidatePath("/pengajuan/pembelian");
  revalidatePath("/pekerjaan-saya/pengajuan");
  revalidatePath("/pekerjaan-saya");
  revalidatePath("/dashboard");
  revalidatePath("/modul/akuntansi");

  // 4. SELALU redirect kembali ke /pengajuan/pembelian
  finish(
    redirectTarget,
    "notice",
    isSubmit
      ? "Pengajuan pembelian berhasil diajukan ke pemeriksa berikutnya."
      : "Draft pembelian berhasil disimpan."
  );
}

export async function submitPurchase(data: FormData) {
  await call("/pengajuan/pembelian", "submit_purchase_request", { p_id: value(data, "id"), p_version: Number(value(data, "version")) }, "Pengajuan dikirim ke pemeriksa berikutnya.")
}
export async function reviewPurchase(data: FormData) {
  const accounting = data.get("accounting") === "yes" ? {
    entity_id: value(data, "entity_id"), period_id: value(data, "period_id"), payable_account_id: value(data, "payable_account_id"),
    vat_account_id: value(data, "vat_account_id") || null, withholding_account_id: value(data, "withholding_account_id") || null,
    tax_invoice_number: value(data, "tax_invoice_number") || null, tax_invoice_date: value(data, "tax_invoice_date") || null,
    coa_confirmed: data.get("coa_confirmed") === "on", lines: json(data, "lines", destination(data)),
    vat_mode: value(data, "vat_mode"), vat_creditable: data.get("vat_creditable") === "on",
    withholding_code: value(data, "withholding_code"), withholding_rate: Number(value(data, "withholding_rate") || 0), withholding_timing: value(data, "withholding_timing") || "invoice",
    withholding_base: Number(value(data, "withholding_base") || 0),
  } : null
  await call(destination(data), "review_purchase_request", {
    p_id: value(data, "id"), p_version: Number(value(data, "version")), p_approve: value(data, "decision") === "approve", p_note: value(data, "note"), p_accounting: accounting,
  }, "Keputusan pemeriksaan tersimpan.")
}
export async function payPurchase(data: FormData) {
  await call(destination(data), "pay_purchase_request", {
    p_id: value(data, "id"), p_version: Number(value(data, "version")), p_payment_date: value(data, "payment_date"),
    p_reference: value(data, "payment_reference"), p_bank_account_id: value(data, "bank_account_id"), p_period_id: value(data, "period_id"),
  }, "Pembayaran dan jurnal pelunasan tercatat.")
}
export async function requestVendor(data: FormData) {
  const path = "/vendor"
  const { organizationId } = await workspace(path)
  await call(path, "save_procurement_vendor", { p_org: organizationId, p_branch: value(data, "branch_id"), p_payload: {
    name: value(data, "name"), address: value(data, "address"), npwp: value(data, "npwp"), bank_owner: value(data, "bank_owner"),
    bank_account: value(data, "bank_account"), payment_method: value(data, "payment_method"),
  } }, "Usulan vendor dikirim ke Finance. Vendor dapat dipilih setelah disetujui.")
}
// This action returns to the same mounted purchase form so invoice edits and OCR
// results are retained while Finance checks the proposed vendor.
export async function requestVendorFromPurchase(data: FormData): Promise<{
  id?: string; name?: string; error?: string; message?: string
}> {
  const context = await requireWorkspace()
  if (context.isReadOnlyPreview) return { error: "Mode lihat sebagai aktif. Pengajuan vendor dinonaktifkan." }
  const fields = {
    name: value(data, "new_vendor_name"), address: value(data, "new_vendor_address"),
    npwp: value(data, "new_vendor_npwp"), bank_owner: value(data, "new_vendor_bank_owner"),
    bank_account: value(data, "new_vendor_bank_account"), payment_method: value(data, "new_vendor_payment_method"),
  }
  if (Object.values(fields).some(field => !field)) return { error: "Lengkapi nama, alamat, NPWP, pemilik/nomor rekening dan metode pembayaran vendor." }
  const { data: id, error } = await context.supabase.rpc("save_procurement_vendor", {
    p_org: context.organizationId, p_branch: value(data, "branch_id"), p_payload: fields,
  })
  if (error || typeof id !== "string") return { error: error?.message ?? "Pengajuan vendor belum tersimpan. Coba kembali." }
  for (const path of ["/pengajuan/pembelian", "/vendor", "/dashboard", "/pekerjaan-saya"]) revalidatePath(path)
  return { id, name: fields.name, message: "Vendor diajukan ke Finance dan dipilih untuk draft ini. Simpan draft invoice; pembayaran dapat diajukan setelah vendor disetujui." }
}
export async function reviewVendor(data: FormData) {
  await call("/vendor", "review_procurement_vendor", { p_id: value(data, "vendor_id"), p_approve: value(data, "decision") === "approve", p_note: value(data, "note") }, "Keputusan vendor tersimpan.")
}
