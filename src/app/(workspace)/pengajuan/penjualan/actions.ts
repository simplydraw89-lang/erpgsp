"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireWorkspace } from "@/lib/auth/context"
import type { SalesClient } from "@/lib/procurement-ui"

function value(data: FormData, key: string) { return String(data.get(key) ?? "").trim() }
function finish(path: string, kind: "error" | "notice", message: string): never { redirect(`${path}${path.includes("?") ? "&" : "?"}${new URLSearchParams({ [kind]: message })}`) }
async function workspace(path: string) {
  const context = await requireWorkspace()
  if (context.isReadOnlyPreview) finish(path, "error", "Mode lihat sebagai aktif. Perubahan dinonaktifkan.")
  return context
}
async function call(path: string, name: string, args: Record<string, unknown>, message: string, destination = path) {
  const { supabase } = await workspace(path)
  const { error } = await supabase.rpc(name, args)
  if (error) finish(path, "error", error.message)
  revalidatePath("/pengajuan/penjualan")
  for (const section of ["klien", "sph", "spk"]) revalidatePath(`/pengajuan/penjualan/${section}`)
  revalidatePath("/pekerjaan-saya/pengajuan")
  revalidatePath("/pekerjaan-saya")
  revalidatePath("/dashboard")
  revalidatePath("/approvals")
  revalidatePath("/portal-proyek")
  revalidatePath(path)
  revalidatePath("/modul/akuntansi")
  finish(destination, "notice", message)
}
function json(data: FormData, key: string, path: string): unknown {
  try { return JSON.parse(value(data, key) || "[]") } catch { finish(path, "error", "Rincian formulir tidak valid. Muat ulang dan coba kembali.") }
}
export async function saveSalesClient(data: FormData) {
  const path = "/pengajuan/penjualan/klien"
  const { organizationId } = await workspace(path)
  await call(path, "save_sales_client", { p_org: organizationId, p_branch: null, p_payload: {
    name: value(data, "name"), address: value(data, "address"), npwp: value(data, "npwp"), phone: value(data, "phone"), email: value(data, "email"), industry: value(data, "industry"), additional_information: value(data, "additional_information"),
  } }, "Klien tersimpan langsung pada master perusahaan tanpa persetujuan.")
}
export async function saveSalesDocument(data: FormData) {
  const kind = value(data, "kind")
  const path = kind === "spk" ? "/pengajuan/penjualan/spk" : "/pengajuan/penjualan/sph"
  if (!["sph", "spk"].includes(kind)) finish(path, "error", "Jenis dokumen tidak valid.")
  const { organizationId } = await workspace(path)
  await call(path, "save_sales_document", { p_org: organizationId, p_branch: value(data, "branch_id"), p_payload: {
    client_id: value(data, "client_id"), kind: value(data, "kind"), title: value(data, "title"), source: value(data, "source"),
    accepted_sph_id: value(data, "accepted_sph_id") || null, notes: value(data, "notes"), attachment_ids: json(data, "attachment_ids", path),
  } }, kind === "spk" ? "SPK berhasil diajukan untuk persetujuan Direktur Utama / Direktur Teknis." : "Draft dokumen penjualan tersimpan.")
}
export async function acceptSalesSph(data: FormData) {
  const path = `/pengajuan/penjualan/sph/${value(data, "document_id")}`
  if (data.get("bilateral_confirmed") !== "on" || !value(data, "acceptance_reference")) finish(path, "error", "Konfirmasi dan referensi bukti persetujuan kedua belah pihak wajib diisi.")
  await call(path, "accept_sales_sph", { p_id: value(data, "document_id"), p_reference: value(data, "acceptance_reference"), p_accepted_on: value(data, "accepted_on") }, "Persetujuan SPH kedua belah pihak dicatat. SPK dapat dibuat.")
}

export async function attachSalesDocument(data: FormData) {
  const path = value(data, "kind") === "spk" ? "/pengajuan/penjualan/spk" : "/pengajuan/penjualan/sph"
  await call(path, "attach_sales_document", { p_id: value(data, "document_id"), p_attachments: json(data, "attachment_ids", path) }, "Lampiran dokumen tersimpan.")
}

export async function searchSalesClients(search = "", offset = 0): Promise<{ clients: SalesClient[]; hasMore: boolean; error?: string }> {
  const context = await requireWorkspace()
  const permission = await context.supabase.rpc("can_read_sales_clients", { p_org: context.organizationId })
  if (permission.error || !permission.data) return { clients: [], hasMore: false, error: "Role Anda tidak memiliki akses daftar klien." }
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return { clients: [], hasMore: false, error: "Halaman pencarian tidak valid." }
  const term = search.trim().slice(0, 120).replace(/[\\%_]/g, character => `\\${character}`)
  let query = context.supabase.from("sales_clients").select("id,name,address,npwp,contact,phone,email,industry,additional_information", { count: "exact" }).eq("organization_id", context.organizationId)
  if (term) query = query.ilike("name", `%${term}%`)
  const result = await query.order("name").order("id").range(offset, offset + 9)
  if (result.error) return { clients: [], hasMore: false, error: "Pencarian klien gagal. Periksa koneksi dan izin akses." }
  return { clients: (result.data ?? []) as SalesClient[], hasMore: offset + (result.data?.length ?? 0) < (result.count ?? 0) }
}

export async function saveSphRequest(_previous: { error?: string }, data: FormData): Promise<{ error?: string }> {
  const context = await requireWorkspace()
  if (context.isReadOnlyPreview) return { error: "Perubahan dinonaktifkan dalam mode lihat sebagai." }
  let attachments: unknown
  try { attachments = JSON.parse(value(data, "attachment_ids") || "[]") } catch { return { error: "Daftar lampiran tidak valid. Muat ulang formulir." } }
  const submit = value(data, "intent") === "submit"
  const { data: id, error } = await context.supabase.rpc("save_sph_request", {
    p_org: context.organizationId, p_branch: value(data, "branch_id"), p_id: value(data, "id") || null,
    p_version: value(data, "version") ? Number(value(data, "version")) : null, p_submit: submit,
    p_payload: { client_id: value(data, "client_id"), title: value(data, "title"), amount: value(data, "amount"), work_area: value(data, "work_area"), work_scopes: data.getAll("work_scopes").map(String), deal_status: value(data, "deal_status"), valid_until: value(data, "valid_until"), notes: value(data, "notes"), attachment_ids: attachments, confirmed: value(data, "confirmed") === "true" },
  })
  if (error) return { error: error.message }
  if (typeof id !== "string") return { error: "SPH belum mengembalikan identitas tersimpan. Muat ulang dan periksa daftar sebelum mengulang." }
  revalidatePath("/pengajuan/penjualan/sph")
  revalidatePath(`/pengajuan/penjualan/sph/${id}`)
  revalidatePath("/pekerjaan-saya/pengajuan")
  revalidatePath("/pekerjaan-saya")
  revalidatePath("/approvals")
  revalidatePath("/dashboard")
  redirect(`/pengajuan/penjualan/sph?${new URLSearchParams({ branch: value(data, "branch_id"), notice: submit ? "SPH berhasil diajukan ke pemeriksa berikutnya." : "Draft SPH tersimpan." })}`)
}

export async function reviewSphRequest(data: FormData) {
  const id = value(data, "document_id")
  const path = `/pengajuan/penjualan/sph/${id}`
  await call(path, "decide_sph", { p_id: id, p_version: value(data, "version") ? Number(value(data, "version")) : null, p_decision: value(data, "decision"), p_note: value(data, "note") }, "Keputusan pemeriksaan SPH tersimpan.", "/pengajuan/penjualan/sph")
}

export async function reviewSpkRequest(data: FormData) {
  const id = value(data, "document_id")
  const path = `/pengajuan/penjualan/spk/${id}`
  const decision = value(data, "decision")
  const message =
    decision === "approve"
      ? "SPK disetujui Direktur dan Proyek baru berhasil dibuat otomatis."
      : decision === "revise"
      ? "Permintaan revisi SPK tersimpan."
      : "SPK ditolak."
  await call(
    path,
    "decide_spk",
    {
      p_id: id,
      p_version: value(data, "version") ? Number(value(data, "version")) : null,
      p_decision: decision,
      p_note: value(data, "note"),
    },
    message,
    "/pengajuan/penjualan/spk"
  )
}

export async function updateSalesSpk(data: FormData) {
  const id = value(data, "document_id")
  const path = `/pengajuan/penjualan/spk/${id}`
  await call(
    path,
    "update_spk_document",
    {
      p_id: id,
      p_version: value(data, "version") ? Number(value(data, "version")) : null,
      p_payload: {
        title: value(data, "title"),
        source: value(data, "source"),
        notes: value(data, "notes"),
        attachment_ids: json(data, "attachment_ids", path),
      },
    },
    "Perubahan data SPK berhasil disimpan.",
    path
  )
}
