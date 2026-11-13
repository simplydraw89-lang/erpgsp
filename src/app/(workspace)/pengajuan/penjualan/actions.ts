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
        document_number: value(data, "document_number") || null,
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
    branch_id?: string | null
    branch?: { code?: string; name?: string } | null
  }>
  hasOtherBranchProjects?: boolean
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
      projects:crm_projects(id,code,name,status,approval_status,branch_id,branch:business_units(code,name))
    `, { count: "exact" })
    .eq("organization_id", context.organizationId)

  if (term) query = query.ilike("name", `%${term}%`)
  const result = await query.order("name").order("id").range(offset, offset + 19)
  if (result.error) return { clients: [], hasMore: false, error: "Pencarian klien gagal. Periksa koneksi dan izin akses." }

  const isOwner = context.actorRole === "owner"
  const isCentralLeadership = (context.workAssignments ?? []).some(
    (j) => !j.branch_id && ["president", "technical_director", "finance_director", "accounting_tax", "finance"].includes(j.job_role)
  )
  const userBranchIds = (context.workAssignments ?? []).map((j) => j.branch_id).filter(Boolean) as string[]

  const rawRows = (result.data ?? []) as any[]

  const processedRows: ClientWithProjects[] = rawRows.map((client) => {
    const rawProjects = (client.projects ?? []) as Array<{
      id: string
      code: string
      name: string
      status: string
      approval_status?: string
      branch_id?: string | null
      branch?: { code?: string; name?: string } | null
    }>

    if (isOwner || isCentralLeadership) {
      return {
        ...client,
        projects: rawProjects,
        hasOtherBranchProjects: false,
      }
    }

    // Hanya tampilkan proyek yang sesuai dengan cakupan cabang pengguna
    const branchProjects = rawProjects.filter(
      (p) => p.branch_id && userBranchIds.includes(p.branch_id)
    )
    const hasOtherBranch = rawProjects.some(
      (p) =>
        (!p.branch_id || !userBranchIds.includes(p.branch_id)) &&
        (p.status === "active" || p.approval_status === "active" || p.status === "planned")
    )

    return {
      ...client,
      projects: branchProjects,
      hasOtherBranchProjects: hasOtherBranch,
    }
  })

  const isClientActive = (c: ClientWithProjects) =>
    (c.projects ?? []).some(
      (p) => p.status === "active" || p.approval_status === "active" || p.status === "planned"
    )

  let filtered = processedRows
  if (filterTab === "active") {
    filtered = processedRows.filter(isClientActive)
  }

  const activeCount = processedRows.filter(isClientActive).length

  return {
    clients: filtered,
    hasMore: offset + processedRows.length < (result.count ?? 0),
    activeCount,
    totalCount: result.count ?? processedRows.length,
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

  let finalInvoiceId = rpcInvId as string | undefined

  if (rpcErr) {
    finish(path, "error", rpcErr.message || "Gagal menerbitkan invoice penagihan.")
  }

  // Otomatis posting jurnal akuntansi piutang penjualan
  if (finalInvoiceId) {
    await autoPostSalesInvoiceJournal(context, finalInvoiceId)
  }

  revalidatePath(path)
  revalidatePath("/modul/akuntansi")
  revalidatePath(`/proyek/${projectId}`)
  revalidatePath("/portal-proyek")
  finish(path, "notice", `Invoice resmi untuk ${termName} berhasil diterbitkan dan jurnal piutang telah diposting.`)
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
    finish(path, "error", rpcErr.message || "Gagal mencatat penerimaan pembayaran invoice.")
  }

  // Otomatis posting jurnal akuntansi penerimaan kas & uang muka PPh 23
  if (invoiceId) {
    await autoPostSalesPaymentJournal(context, invoiceId)
  }

  revalidatePath(path)
  revalidatePath("/modul/akuntansi")
  if (projectId) revalidatePath(`/proyek/${projectId}`)
  revalidatePath("/portal-proyek")
  finish(path, "notice", "Penerimaan pembayaran berhasil diverifikasi, kuitansi resmi terbit, dan jurnal kas/PPh 23 telah diposting.")
}

async function autoPostSalesInvoiceJournal(context: any, invoiceId: string) {
  try {
    const { data: rpcRes, error: rpcErr } = await context.supabase.rpc("post_sales_invoice_journal", {
      p_invoice_id: invoiceId,
    })
    if (!rpcErr && rpcRes) return rpcRes

    const { data: inv } = await context.supabase
      .from("sales_invoices")
      .select("*")
      .eq("id", invoiceId)
      .single()

    if (!inv || inv.invoice_journal_id) return

    const { data: branch } = await context.supabase
      .from("business_units")
      .select("entity_id")
      .eq("id", inv.branch_id)
      .single()

    let entityId = branch?.entity_id
    if (!entityId) {
      const { data: parentEntity } = await context.supabase
        .from("company_entities")
        .select("id")
        .eq("organization_id", context.organizationId)
        .order("is_reporting_parent", { ascending: false })
        .limit(1)
        .single()
      entityId = parentEntity?.id
    }
    if (!entityId) return

    const targetDate = inv.invoice_date || new Date().toISOString().slice(0, 10)
    const { data: openPeriod } = await context.supabase
      .from("accounting_periods")
      .select("id, starts_on, ends_on")
      .eq("organization_id", context.organizationId)
      .eq("entity_id", entityId)
      .eq("period_status", "open")
      .order("starts_on", { ascending: false })
      .limit(1)
      .single()

    let periodId = openPeriod?.id
    if (!periodId) {
      const pStart = `${targetDate.slice(0, 7)}-01`
      const pEnd = new Date(Number(targetDate.slice(0, 4)), Number(targetDate.slice(5, 7)), 0).toISOString().slice(0, 10)
      const { data: newPeriod } = await context.supabase
        .from("accounting_periods")
        .insert({
          organization_id: context.organizationId,
          entity_id: entityId,
          period_code: targetDate.slice(0, 7),
          starts_on: pStart,
          ends_on: pEnd,
          period_status: "open",
          created_by: context.user.id,
        })
        .select("id")
        .single()
      periodId = newPeriod?.id
    }
    if (!periodId) return

    async function getOrMakeAccount(code: string, name: string, type: string, normal: string, cat: string) {
      const { data: acc } = await context.supabase
        .from("finance_accounts")
        .select("id")
        .eq("organization_id", context.organizationId)
        .or(`code.eq.${code},posting_category.eq.${cat}`)
        .eq("is_active", true)
        .eq("is_postable", true)
        .limit(1)
        .single()
      if (acc?.id) return acc.id

      const { data: newAcc } = await context.supabase
        .from("finance_accounts")
        .insert({
          organization_id: context.organizationId,
          code,
          account_code: code,
          name,
          account_type: type,
          normal_balance: normal,
          is_postable: true,
          is_active: true,
          report_section: type,
          posting_category: cat,
          created_by: context.user.id,
        })
        .select("id")
        .single()
      return newAcc?.id
    }

    const arAcc = await getOrMakeAccount("1121", "Piutang Klien", "asset", "debit", "receivable")
    const revAcc = await getOrMakeAccount("4111", "Pendapatan Jasa Konsultansi & Proyek", "revenue", "credit", "revenue")
    const vatAcc = await getOrMakeAccount("2121", "PPN Keluaran", "liability", "credit", "output_vat")

    const journalNum = `JRN/${targetDate.replace(/-/g, "").slice(0, 6)}/${String(Date.now()).slice(-4)}`
    const { data: jrn } = await context.supabase
      .from("accounting_journals")
      .insert({
        organization_id: context.organizationId,
        entity_id: entityId,
        period_id: periodId,
        journal_number: journalNum,
        journal_date: targetDate,
        source_type: "receivable",
        source_id: inv.id,
        description: `Pengakuan piutang invoice ${inv.invoice_number} (${inv.term_name})`,
        status: "posted",
        created_by: context.user.id,
        posted_by: context.user.id,
        posted_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (!jrn?.id) return

    const lines: any[] = [
      {
        organization_id: context.organizationId,
        journal_id: jrn.id,
        line_number: 1,
        account_id: arAcc,
        debit: Number(inv.total_amount || 0),
        credit: 0,
        description: `Piutang klien invoice ${inv.invoice_number}`,
        counterparty_type: "customer",
        counterparty_id: inv.client_id,
        project_id: inv.project_id || null,
      },
      {
        organization_id: context.organizationId,
        journal_id: jrn.id,
        line_number: 2,
        account_id: revAcc,
        debit: 0,
        credit: Number(inv.amount || 0),
        description: `Pendapatan jasa termin ${inv.term_name} (${inv.invoice_number})`,
        project_id: inv.project_id || null,
      },
    ]

    if (Number(inv.vat_amount || 0) > 0) {
      lines.push({
        organization_id: context.organizationId,
        journal_id: jrn.id,
        line_number: 3,
        account_id: vatAcc,
        debit: 0,
        credit: Number(inv.vat_amount),
        description: `PPN Keluaran 11% invoice ${inv.invoice_number}`,
        project_id: inv.project_id || null,
      })
    }

    await context.supabase.from("accounting_journal_lines").insert(lines)
    await context.supabase.from("sales_invoices").update({ invoice_journal_id: jrn.id }).eq("id", inv.id)
  } catch (err) {
    console.warn("autoPostSalesInvoiceJournal error:", err)
  }
}

async function autoPostSalesPaymentJournal(context: any, invoiceId: string) {
  try {
    const { data: rpcRes, error: rpcErr } = await context.supabase.rpc("post_sales_payment_journal", {
      p_invoice_id: invoiceId,
    })
    if (!rpcErr && rpcRes) return rpcRes

    const { data: inv } = await context.supabase
      .from("sales_invoices")
      .select("*")
      .eq("id", invoiceId)
      .single()

    if (!inv || inv.payment_journal_id) return

    const { data: branch } = await context.supabase
      .from("business_units")
      .select("entity_id")
      .eq("id", inv.branch_id)
      .single()

    let entityId = branch?.entity_id
    if (!entityId) {
      const { data: parentEntity } = await context.supabase
        .from("company_entities")
        .select("id")
        .eq("organization_id", context.organizationId)
        .order("is_reporting_parent", { ascending: false })
        .limit(1)
        .single()
      entityId = parentEntity?.id
    }
    if (!entityId) return

    const targetDate = (inv.paid_at ? new Date(inv.paid_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10))
    const { data: openPeriod } = await context.supabase
      .from("accounting_periods")
      .select("id, starts_on, ends_on")
      .eq("organization_id", context.organizationId)
      .eq("entity_id", entityId)
      .eq("period_status", "open")
      .order("starts_on", { ascending: false })
      .limit(1)
      .single()

    let periodId = openPeriod?.id
    if (!periodId) {
      const pStart = `${targetDate.slice(0, 7)}-01`
      const pEnd = new Date(Number(targetDate.slice(0, 4)), Number(targetDate.slice(5, 7)), 0).toISOString().slice(0, 10)
      const { data: newPeriod } = await context.supabase
        .from("accounting_periods")
        .insert({
          organization_id: context.organizationId,
          entity_id: entityId,
          period_code: targetDate.slice(0, 7),
          starts_on: pStart,
          ends_on: pEnd,
          period_status: "open",
          created_by: context.user.id,
        })
        .select("id")
        .single()
      periodId = newPeriod?.id
    }
    if (!periodId) return

    async function getOrMakeAccount(code: string, name: string, type: string, normal: string, cat: string) {
      const { data: acc } = await context.supabase
        .from("finance_accounts")
        .select("id")
        .eq("organization_id", context.organizationId)
        .or(`code.eq.${code},posting_category.eq.${cat}`)
        .eq("is_active", true)
        .eq("is_postable", true)
        .limit(1)
        .single()
      if (acc?.id) return acc.id

      const { data: newAcc } = await context.supabase
        .from("finance_accounts")
        .insert({
          organization_id: context.organizationId,
          code,
          account_code: code,
          name,
          account_type: type,
          normal_balance: normal,
          is_postable: true,
          is_active: true,
          report_section: type,
          posting_category: cat,
          created_by: context.user.id,
        })
        .select("id")
        .single()
      return newAcc?.id
    }

    const bankAcc = await getOrMakeAccount("1102", "Bank Operasional", "asset", "debit", "cash_bank")
    const whtAcc = await getOrMakeAccount("1192", "Pajak Penghasilan Dibayar di Muka (PPh 23)", "asset", "debit", "general")
    const arAcc = await getOrMakeAccount("1121", "Piutang Klien", "asset", "debit", "receivable")

    const wht = Number(inv.wht_amount || 0)
    let paid = Number(inv.paid_amount || inv.net_receivable || 0)
    if (paid <= 0) paid = Number(inv.total_amount || 0) - wht
    const arCleared = paid + wht

    const kwtLabel = inv.receipt_number || `KWT-${inv.invoice_number}`
    const journalNum = `JRN/${targetDate.replace(/-/g, "").slice(0, 6)}/${String(Date.now()).slice(-4)}`

    const { data: jrn } = await context.supabase
      .from("accounting_journals")
      .insert({
        organization_id: context.organizationId,
        entity_id: entityId,
        period_id: periodId,
        journal_number: journalNum,
        journal_date: targetDate,
        source_type: "payment",
        source_id: inv.id,
        description: `Penerimaan pembayaran ${kwtLabel} atas invoice ${inv.invoice_number}`,
        status: "posted",
        created_by: context.user.id,
        posted_by: context.user.id,
        posted_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (!jrn?.id) return

    const lines: any[] = [
      {
        organization_id: context.organizationId,
        journal_id: jrn.id,
        line_number: 1,
        account_id: bankAcc,
        debit: paid,
        credit: 0,
        description: `Penerimaan kas/bank pelunasan ${kwtLabel}`,
        project_id: inv.project_id || null,
      },
    ]

    if (wht > 0) {
      lines.push({
        organization_id: context.organizationId,
        journal_id: jrn.id,
        line_number: 2,
        account_id: whtAcc,
        debit: wht,
        credit: 0,
        description: `Uang muka PPh 23 invoice ${inv.invoice_number}${inv.wht_proof_number ? ` (Bupot: ${inv.wht_proof_number})` : ""}`,
        project_id: inv.project_id || null,
      })
    }

    lines.push({
      organization_id: context.organizationId,
      journal_id: jrn.id,
      line_number: lines.length + 1,
      account_id: arAcc,
      debit: 0,
      credit: arCleared,
      description: `Pelunasan piutang klien ${kwtLabel}`,
      counterparty_type: "customer",
      counterparty_id: inv.client_id,
      project_id: inv.project_id || null,
    })

    await context.supabase.from("accounting_journal_lines").insert(lines)
    await context.supabase.from("sales_invoices").update({ payment_journal_id: jrn.id }).eq("id", inv.id)
  } catch (err) {
    console.warn("autoPostSalesPaymentJournal error:", err)
  }
}
