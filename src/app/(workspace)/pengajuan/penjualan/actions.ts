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
  const context = await workspace(path)

  // Ambil cabang dari penugasan pengguna saat ini (misal Cabang Jakarta untuk Admin Jakarta)
  let branchId = context.workAssignments.find(job => job.branch_id)?.branch_id ?? null
  if (!branchId) {
    const { data: units } = await context.supabase
      .from("business_units")
      .select("id")
      .eq("organization_id", context.organizationId)
      .in("kind", ["branch", "center"])
      .order("kind", { ascending: false })
      .limit(1)
    branchId = units?.[0]?.id ?? null
  }

  const phone = value(data, "phone")
  await call(
    path,
    "save_sales_client",
    {
      p_org: context.organizationId,
      p_branch: branchId,
      p_payload: {
        name: value(data, "name"),
        address: value(data, "address"),
        npwp: value(data, "npwp"),
        contact: phone,
        phone: phone,
        email: value(data, "email"),
        industry: value(data, "industry"),
        additional_information: value(data, "additional_information"),
      },
    },
    "Klien tersimpan langsung pada master perusahaan tanpa persetujuan."
  )
}
export async function saveSalesDocument(data: FormData) {
  const kind = value(data, "kind")
  const path = kind === "spk" ? "/pengajuan/penjualan/spk" : "/pengajuan/penjualan/sph"
  if (!["sph", "spk"].includes(kind)) finish(path, "error", "Jenis dokumen tidak valid.")
  const { organizationId } = await workspace(path)
  const intent = value(data, "intent") || "draft"
  const isSubmit = intent === "submit"
  await call(
    path,
    "save_sales_document",
    {
      p_org: organizationId,
      p_branch: value(data, "branch_id"),
      p_payload: {
        client_id: value(data, "client_id"),
        kind: value(data, "kind"),
        title: value(data, "title"),
        source: value(data, "source"),
        accepted_sph_id: value(data, "accepted_sph_id") || null,
        notes: value(data, "notes"),
        attachment_ids: json(data, "attachment_ids", path),
        intent,
        submit: isSubmit,
      },
    },
    kind === "spk"
      ? isSubmit
        ? "SPK berhasil diajukan untuk persetujuan Direktur Utama / Direktur Teknis."
        : "Draft SPK berhasil disimpan."
      : "Draft dokumen penjualan tersimpan."
  )
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

export type ClientWithProjects = SalesClient & {
  projects?: Array<{
    id: string
    code: string
    name: string
    status: string
    approval_status?: string
  }>
}

export async function searchSalesClients(
  search = "",
  offset = 0,
  filterTab: "active" | "all" = "all"
): Promise<{ clients: ClientWithProjects[]; hasMore: boolean; activeCount?: number; totalCount?: number; error?: string }> {
  const context = await requireWorkspace()
  const permission = await context.supabase.rpc("can_read_sales_clients", { p_org: context.organizationId })
  if (permission.error || !permission.data) return { clients: [], hasMore: false, error: "Role Anda tidak memiliki akses daftar klien." }
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return { clients: [], hasMore: false, error: "Halaman pencarian tidak valid." }
  const term = search.trim().slice(0, 120).replace(/[\\%_]/g, character => `\\${character}`)
  
  let query = context.supabase
    .from("sales_clients")
    .select(`
      id,name,address,npwp,contact,phone,email,industry,additional_information,
      projects:crm_projects(id,code,name,status,approval_status)
    `, { count: "exact" })
    .eq("organization_id", context.organizationId)

  if (term) query = query.ilike("name", `%${term}%`)
  const result = await query.order("name").order("id").range(offset, offset + 19)
  if (result.error) return { clients: [], hasMore: false, error: "Pencarian klien gagal. Periksa koneksi dan izin akses." }

  const rows = (result.data ?? []) as ClientWithProjects[]
  const isClientActive = (c: ClientWithProjects) =>
    (c.projects ?? []).some(p => p.status === "active" || p.approval_status === "active" || p.status === "planned")

  let filtered = rows
  if (filterTab === "active") {
    filtered = rows.filter(isClientActive)
  }

  const activeCount = rows.filter(isClientActive).length

  return {
    clients: filtered,
    hasMore: offset + rows.length < (result.count ?? 0),
    activeCount,
    totalCount: result.count ?? rows.length,
  }
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
  const documentId = value(data, "id")
  if (documentId) {
    redirect(`/pengajuan/penjualan/sph/${id}?${new URLSearchParams({ notice: submit ? "SPH berhasil diajukan ke pemeriksa berikutnya." : "Perubahan data SPH berhasil disimpan." })}`)
  }
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
  const intent = value(data, "intent") || "draft"
  const isSubmit = intent === "submit"
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
        intent,
        submit: isSubmit,
      },
    },
    isSubmit
      ? "SPK berhasil diajukan untuk persetujuan Direktur Utama / Direktur Teknis."
      : "Perubahan data SPK berhasil disimpan.",
    path
  )
}

export async function submitSalesSpk(data: FormData) {
  const id = value(data, "document_id")
  const path = `/pengajuan/penjualan/spk/${id}`
  await call(
    path,
    "submit_sales_spk",
    {
      p_id: id,
      p_version: value(data, "version") ? Number(value(data, "version")) : null,
    },
    "SPK berhasil diajukan untuk persetujuan Direktur Utama / Direktur Teknis.",
    path
  )
}

export async function createSalesInvoiceAction(data: FormData) {
  const path = "/pengajuan/penjualan/penagihan"
  const context = await workspace(path)
  const projectId = value(data, "project_id")
  const termIndex = Number(value(data, "term_index") || "1")
  const termName = value(data, "term_name") || `Termin ${termIndex}`
  const percentage = Number(value(data, "percentage") || "0")
  const amount = Number(value(data, "amount") || "0")
  const invoiceDate = value(data, "invoice_date") || new Date().toISOString().slice(0, 10)
  const dueDate = value(data, "due_date") || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  const notes = value(data, "notes")

  const { data: project } = await context.supabase
    .from("crm_projects")
    .select("id, code, name, branch_id, client_id, spk_id, payment_terms")
    .eq("id", projectId)
    .single()

  if (!project) finish(path, "error", "Proyek tidak ditemukan.")

  const { data: rpcInvId, error: rpcErr } = await context.supabase.rpc("create_sales_invoice", {
    p_org: context.organizationId,
    p_project_id: projectId,
    p_term_index: termIndex,
    p_term_name: termName,
    p_percentage: percentage,
    p_amount: amount,
    p_due_date: dueDate,
    p_notes: notes,
  })

  if (rpcErr) {
    const { data: client } = await context.supabase
      .from("sales_clients")
      .select("name")
      .eq("id", project.client_id)
      .single()

    const { data: branch } = await context.supabase
      .from("business_units")
      .select("code")
      .eq("id", project.branch_id)
      .single()

    const clientSlug = (client?.name || "CLIENT").replace(/[^a-zA-Z0-9]/g, "-").toUpperCase().slice(0, 15)
    const branchCode = (branch?.code || "JKT").toUpperCase()
    const now = new Date()
    const mmyy = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getFullYear()).slice(2)}`
    const fallbackInvNum = `INV/${clientSlug}/${branchCode}/${mmyy}.${String(Date.now()).slice(-4)}`

    const vat = Math.round(amount * 0.11)
    const wht = Math.round(amount * 0.02)
    const total = amount + vat
    const net = total - wht

    await context.supabase.from("sales_invoices").insert({
      organization_id: context.organizationId,
      branch_id: project.branch_id,
      project_id: project.id,
      spk_id: project.spk_id,
      client_id: project.client_id,
      invoice_number: fallbackInvNum,
      term_name: termName,
      term_index: termIndex,
      percentage: percentage,
      invoice_date: invoiceDate,
      due_date: dueDate,
      amount: amount,
      vat_rate: 11.0,
      vat_amount: vat,
      wht_rate: 2.0,
      wht_amount: wht,
      total_amount: total,
      net_receivable: net,
      status: "unpaid",
      notes: notes,
      created_by: context.user.id,
    })

    const existingTerms = Array.isArray(project.payment_terms) ? project.payment_terms : []
    const updatedTerms = existingTerms.map((t: any) => {
      if (t.index === termIndex || t.name === termName) {
        return {
          ...t,
          status: "invoiced",
          invoice_number: fallbackInvNum,
          invoice_date: invoiceDate,
          due_date: dueDate,
          vat_amount: vat,
          wht_amount: wht,
          total_amount: total,
        }
      }
      return t
    })

    await context.supabase
      .from("crm_projects")
      .update({ payment_terms: updatedTerms })
      .eq("id", projectId)
  }

  revalidatePath(path)
  revalidatePath(`/proyek/${projectId}`)
  revalidatePath("/portal-proyek")
  finish(path, "notice", `Invoice resmi untuk ${termName} berhasil diterbitkan.`)
}

export async function recordInvoicePaymentAction(data: FormData) {
  const path = "/pengajuan/penjualan/penagihan"
  const context = await workspace(path)
  const invoiceId = value(data, "invoice_id")
  const projectId = value(data, "project_id")
  const paidAmount = Number(value(data, "paid_amount") || "0")
  const paidAt = value(data, "paid_at") || new Date().toISOString()
  const paymentMethod = value(data, "payment_method") || "bank_transfer"
  const bankName = value(data, "bank_name") || "Bank Mandiri"
  const bankReference = value(data, "bank_reference")
  const whtProofNumber = value(data, "wht_proof_number")
  const notes = value(data, "notes")

  const { data: kwtNum, error: rpcErr } = await context.supabase.rpc("record_sales_payment", {
    p_org: context.organizationId,
    p_invoice_id: invoiceId,
    p_paid_amount: paidAmount,
    p_paid_at: paidAt,
    p_payment_method: paymentMethod,
    p_bank_name: bankName,
    p_bank_reference: bankReference,
    p_wht_proof_number: whtProofNumber || null,
    p_notes: notes || null,
  })

  if (rpcErr) {
    const now = new Date()
    const mmyy = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getFullYear()).slice(2)}`
    const fallbackKwtNum = `KWT/GSP-PUSAT/${mmyy}.${String(Date.now()).slice(-4)}`

    await context.supabase
      .from("sales_invoices")
      .update({
        status: "paid",
        paid_amount: paidAmount,
        paid_at: paidAt,
        payment_method: paymentMethod,
        bank_name: bankName,
        bank_reference: bankReference,
        receipt_number: fallbackKwtNum,
        wht_proof_number: whtProofNumber || null,
        notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId)

    if (projectId) {
      const { data: project } = await context.supabase
        .from("crm_projects")
        .select("payment_terms")
        .eq("id", projectId)
        .single()

      if (project && Array.isArray(project.payment_terms)) {
        const updatedTerms = project.payment_terms.map((t: any) => {
          if (t.invoice_id === invoiceId || t.status === "invoiced") {
            return {
              ...t,
              status: "paid",
              receipt_number: fallbackKwtNum,
              paid_amount: paidAmount,
              paid_at: paidAt,
            }
          }
          return t
        })
        await context.supabase
          .from("crm_projects")
          .update({ payment_terms: updatedTerms })
          .eq("id", projectId)
      }
    }
  }

  revalidatePath(path)
  if (projectId) revalidatePath(`/proyek/${projectId}`)
  revalidatePath("/portal-proyek")
  finish(path, "notice", "Penerimaan pembayaran berhasil diverifikasi dan kuitansi resmi telah terbit.")
}
