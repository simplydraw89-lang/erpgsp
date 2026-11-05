"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireWorkspace } from "@/lib/auth/context"

const accountingPath = "/modul/akuntansi"
const paymentPath = "/modul/pembayaran?type=advance"

function finish(path: string, key: "notice" | "error", message: string): never {
  const query = new URLSearchParams({ [key]: message })
  redirect(`${path}?${query.toString()}`)
}

function text(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim()
}

function required(data: FormData, key: string, label: string) {
  const value = text(data, key)
  if (!value) finish(accountingPath, "error", `${label} wajib diisi.`)
  return value
}

async function requireWritableWorkspace(path: string) {
  const workspace = await requireWorkspace()
  if (workspace.isReadOnlyPreview)
    finish(path, "error", "Mode lihat sebagai aktif: semua perubahan dinonaktifkan.")
  return workspace
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(new Date(`${value}T00:00:00Z`).getTime()) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}

async function callRpc<T>(
  path: string,
  supabase: Awaited<ReturnType<typeof requireWorkspace>>["supabase"],
  name: string,
  params: Record<string, unknown>,
  success: string,
) {
  const { data, error } = await supabase.rpc(name, params)
  if (error) finish(path, "error", error.message)
  revalidatePath(path.split("?")[0])
  finish(path, "notice", success)
  return data as T
}

export async function createCompanyEntity(data: FormData) {
  const { supabase, organizationId } = await requireWritableWorkspace(accountingPath)
  await callRpc(accountingPath, supabase, "create_company_entity", {
    p_org: organizationId,
    p_entity_code: required(data, "entity_code", "Kode entitas"),
    p_legal_name: required(data, "legal_name", "Nama legal"),
    p_entity_type: required(data, "entity_type", "Jenis entitas"),
    p_functional_currency: text(data, "functional_currency") || "IDR",
    p_parent_entity_id: text(data, "parent_entity_id") || null,
    p_tax_id: text(data, "tax_id") || null,
    p_is_reporting_parent: data.get("is_reporting_parent") === "on",
  }, "Entitas berhasil dibuat.")
}

export async function setEntityMembership(data: FormData) {
  const { supabase, organizationId } = await requireWritableWorkspace(accountingPath)
  await callRpc(accountingPath, supabase, "set_entity_membership", {
    p_org: organizationId,
    p_entity_id: required(data, "entity_id", "Entitas"),
    p_user_id: required(data, "user_id", "Anggota"),
    p_is_default: data.get("is_default") === "on",
  }, "Keanggotaan entitas berhasil disimpan.")
}

export async function createAccountingPeriod(data: FormData) {
  const { supabase, organizationId } = await requireWritableWorkspace(accountingPath)
  const startsOn = required(data, "starts_on", "Tanggal mulai")
  const endsOn = required(data, "ends_on", "Tanggal selesai")
  if (!validDate(startsOn) || !validDate(endsOn))
    finish(accountingPath, "error", "Tanggal periode tidak valid.")
  await callRpc(accountingPath, supabase, "create_accounting_period", {
    p_org: organizationId,
    p_entity_id: required(data, "entity_id", "Entitas"),
    p_period_code: required(data, "period_code", "Kode periode"),
    p_starts_on: startsOn,
    p_ends_on: endsOn,
  }, "Periode akuntansi berhasil dibuat.")
}

export async function closeAccountingPeriod(data: FormData) {
  const { supabase } = await requireWritableWorkspace(accountingPath)
  await callRpc(accountingPath, supabase, "close_accounting_period", {
    p_period_id: required(data, "period_id", "Periode"),
  }, "Periode berhasil ditutup.")
}

export async function createAccountingJournal(data: FormData) {
  const { supabase, organizationId } = await requireWritableWorkspace(accountingPath)
  const journalDate = required(data, "journal_date", "Tanggal jurnal")
  if (!validDate(journalDate))
    finish(accountingPath, "error", "Tanggal jurnal tidak valid.")
  const lines: Record<string, string>[] = []
  for (let index = 1; index <= 6; index += 1) {
    const accountId = text(data, `account_id_${index}`)
    if (!accountId) continue
    lines.push({
      account_id: accountId,
      description: text(data, `line_description_${index}`),
      debit: text(data, `debit_${index}`) || "0",
      credit: text(data, `credit_${index}`) || "0",
    })
  }
  if (lines.length < 2)
    finish(accountingPath, "error", "Jurnal membutuhkan minimal dua baris.")
  await callRpc(accountingPath, supabase, "create_accounting_journal", {
    p_org: organizationId,
    p_entity_id: required(data, "entity_id", "Entitas"),
    p_period_id: required(data, "period_id", "Periode"),
    p_journal_number: `MAN-${journalDate.replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
    p_journal_date: journalDate,
    p_source_type: "manual",
    p_description: required(data, "description", "Keterangan jurnal"),
    p_lines: lines,
  }, "Draft jurnal berhasil dibuat.")
}

export async function postAccountingJournal(data: FormData) {
  const { supabase } = await requireWritableWorkspace(accountingPath)
  await callRpc(accountingPath, supabase, "post_accounting_journal", {
    p_journal: required(data, "journal_id", "Jurnal"),
  }, "Jurnal berhasil diposting.")
}

export async function voidAccountingJournal(data: FormData) {
  const { supabase } = await requireWritableWorkspace(accountingPath)
  await callRpc(accountingPath, supabase, "void_accounting_journal", {
    p_journal: required(data, "journal_id", "Jurnal"),
  }, "Draft jurnal dibatalkan.")
}

export async function reverseAccountingJournal(data: FormData) {
  const { supabase } = await requireWritableWorkspace(accountingPath)
  const reversalDate = required(data, "reversal_date", "Tanggal pembalik")
  if (!validDate(reversalDate))
    finish(accountingPath, "error", "Tanggal pembalik tidak valid.")
  await callRpc(accountingPath, supabase, "reverse_accounting_journal", {
    p_journal_id: required(data, "journal_id", "Jurnal"),
    p_reversal_number: `REV-${reversalDate.replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
    p_reversal_date: reversalDate,
    p_description: required(data, "description", "Alasan reversal"),
  }, "Draft jurnal pembalik dibuat. Posting jurnal tersebut untuk menyelesaikan reversal.")
}

export async function reconcileBankBalance(data: FormData) {
  const { supabase, organizationId } = await requireWritableWorkspace(accountingPath)
  const statementDate = required(data, "statement_date", "Tanggal rekening koran")
  const statementBalance = Number(required(data, "statement_balance", "Saldo rekening koran"))
  if (!validDate(statementDate) || !Number.isFinite(statementBalance))
    finish(accountingPath, "error", "Tanggal atau saldo rekening koran tidak valid.")
  await callRpc(accountingPath, supabase, "reconcile_bank_balance", {
    p_org: organizationId,
    p_entity_id: required(data, "entity_id", "Entitas"),
    p_period_id: required(data, "period_id", "Periode"),
    p_account_id: required(data, "account_id", "Akun kas/bank"),
    p_statement_date: statementDate,
    p_statement_balance: statementBalance,
    p_note: text(data, "note") || null,
  }, "Hasil rekonsiliasi saldo bank berhasil dicatat.")
}

export async function submitCashAdvanceSettlement(data: FormData) {
  const { supabase, organizationId, role } = await requireWritableWorkspace(paymentPath)
  if (role === "auditor") finish(paymentPath, "error", "Auditor hanya memiliki akses baca.")
  const numberField = (key: string) => {
    const raw = required(data, key, key)
    const value = Number(raw)
    if (!Number.isFinite(value) || value < 0)
      finish(paymentPath, "error", "Nilai pertanggungjawaban harus berupa angka nol atau lebih.")
    return value
  }
  const additionalDue = numberField("additional_due")
  const additionalDueDate = text(data, "additional_due_on")
  if ((additionalDue > 0 && !validDate(additionalDueDate)) || (additionalDue === 0 && additionalDueDate))
    finish(paymentPath, "error", "Tanggal pembayaran tambahan wajib diisi hanya jika ada biaya tambahan.")
  const { error } = await supabase.rpc("submit_cash_advance_settlement", {
    p_org: organizationId,
    p_advance_id: required(data, "advance_id", "Kasbon"),
    p_expense_total: numberField("expense_total"),
    p_cash_returned: numberField("cash_returned"),
    p_additional_due: additionalDue,
    p_expense_note: required(data, "expense_note", "Rincian penggunaan"),
    p_receipt_references: text(data, "receipt_references") || null,
    p_additional_due_on: additionalDueDate || null,
  })
  if (error) finish(paymentPath, "error", error.message)
  revalidatePath("/modul/pembayaran")
  finish(paymentPath, "notice", "Pertanggungjawaban diajukan ke Finance.")
}

export async function reviewCashAdvanceSettlement(data: FormData) {
  const { supabase, role } = await requireWritableWorkspace(paymentPath)
  if (role !== "finance") finish(paymentPath, "error", "Hanya Finance dapat meninjau pertanggungjawaban.")
  const decision = required(data, "decision", "Keputusan")
  if (decision !== "approved" && decision !== "rejected")
    finish(paymentPath, "error", "Keputusan tidak valid.")
  const { error } = await supabase.rpc("review_cash_advance_settlement", {
    p_settlement_id: required(data, "settlement_id", "Pertanggungjawaban"),
    p_decision: decision,
    p_note: required(data, "review_note", "Catatan Finance"),
  })
  if (error) finish(paymentPath, "error", error.message)
  revalidatePath("/modul/pembayaran")
  finish(paymentPath, "notice", decision === "approved"
    ? "Pertanggungjawaban disetujui; kasbon ditutup."
    : "Pertanggungjawaban ditolak; pengaju dapat memperbaiki dan mengajukan ulang.")
}
