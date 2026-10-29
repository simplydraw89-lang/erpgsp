"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { ModuleKey } from "@/lib/modules"
import { requireWorkspace, type OrganizationRole } from "@/lib/auth/context"

const writeRoles: Record<ModuleKey, OrganizationRole[]> = {
  crm: ["owner", "director", "operations", "staff"],
  operasional: ["owner", "director", "operations", "staff"],
  keuangan: ["owner", "finance"],
  sdm: ["owner", "hr"],
  perpajakan: ["owner", "finance"],
  manajemen: [],
}

function requiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim()
  if (!value) throw new Error(`${label} wajib diisi.`)
  return value
}

function optionalText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null
}

function optionalDate(formData: FormData, key: string) {
  const value = optionalText(formData, key)
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Format tanggal tidak valid.")
  }
  return value
}

function amount(formData: FormData, key: string, label: string) {
  const rawValue = String(formData.get(key) ?? "").trim()
  if (!rawValue) throw new Error(`${label} wajib diisi.`)
  const value = Number(rawValue)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} harus berupa angka nol atau lebih.`)
  }
  return value
}

export async function createModuleRecord(formData: FormData) {
  const moduleKey = String(formData.get("moduleKey") ?? "") as ModuleKey
  const recordType = String(formData.get("recordType") ?? "")
  const { supabase, organizationId, role, user } = await requireWorkspace()
  if (!Object.hasOwn(writeRoles, moduleKey)) {
    throw new Error("Modul tidak valid.")
  }
  const allowedRoles = writeRoles[moduleKey]

  if (!allowedRoles.includes(role)) {
    throw new Error("Peran Anda tidak diizinkan menambahkan data pada modul ini.")
  }

  let error: { message: string } | null = null

  if (moduleKey === "crm" && recordType === "client") {
    const result = await supabase.from("crm_clients").insert({
      organization_id: organizationId,
      created_by: user.id,
      name: requiredText(formData, "name", "Nama kontak"),
      company_name: optionalText(formData, "company_name"),
      email: optionalText(formData, "email"),
      phone: optionalText(formData, "phone"),
      status: requiredText(formData, "status", "Status"),
      notes: optionalText(formData, "notes"),
    })
    error = result.error
  } else if (moduleKey === "crm" && recordType === "project") {
    const result = await supabase.from("crm_projects").insert({
      organization_id: organizationId,
      created_by: user.id,
      code: requiredText(formData, "code", "Kode proyek"),
      name: requiredText(formData, "name", "Nama proyek"),
      starts_on: optionalDate(formData, "starts_on"),
      ends_on: optionalDate(formData, "ends_on"),
    })
    error = result.error
  } else if (moduleKey === "operasional" && recordType === "work_item") {
    const result = await supabase.from("operational_work_items").insert({
      organization_id: organizationId,
      created_by: user.id,
      title: requiredText(formData, "title", "Judul pekerjaan"),
      description: optionalText(formData, "description"),
      priority: requiredText(formData, "priority", "Prioritas"),
      due_on: optionalDate(formData, "due_on"),
    })
    error = result.error
  } else if (moduleKey === "keuangan" && recordType === "account") {
    const accountType = requiredText(formData, "account_type", "Jenis akun")
    const normalBalance =
      accountType === "liability" ||
      accountType === "equity" ||
      accountType === "revenue"
        ? "credit"
        : "debit"
    const result = await supabase.from("finance_accounts").insert({
      organization_id: organizationId,
      created_by: user.id,
      code: requiredText(formData, "code", "Kode akun"),
      name: requiredText(formData, "name", "Nama akun"),
      account_type: accountType,
      normal_balance: normalBalance,
    })
    error = result.error
  } else if (moduleKey === "sdm" && recordType === "employee") {
    const result = await supabase.from("hr_employees").insert({
      organization_id: organizationId,
      created_by: user.id,
      employee_number: requiredText(formData, "employee_number", "Nomor karyawan"),
      full_name: requiredText(formData, "full_name", "Nama karyawan"),
      email: optionalText(formData, "email"),
      job_title: optionalText(formData, "job_title"),
      department: optionalText(formData, "department"),
      started_on: optionalDate(formData, "started_on"),
    })
    error = result.error
  } else if (moduleKey === "perpajakan" && recordType === "tax_record") {
    const period = requiredText(formData, "tax_period", "Masa pajak")
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new Error("Masa pajak harus menggunakan format YYYY-MM.")
    }

    const result = await supabase.from("tax_records").insert({
      organization_id: organizationId,
      created_by: user.id,
      tax_period: period,
      tax_type: requiredText(formData, "tax_type", "Jenis pajak"),
      reference_number: optionalText(formData, "reference_number"),
      tax_base: amount(formData, "tax_base", "Dasar pajak"),
      tax_amount: amount(formData, "tax_amount", "Nilai pajak"),
      due_on: optionalDate(formData, "due_on"),
      notes: optionalText(formData, "notes"),
    })
    error = result.error
  } else {
    throw new Error("Jenis data tidak valid untuk modul ini.")
  }

  if (error) {
    throw new Error(`Data gagal disimpan: ${error.message}`)
  }

  revalidatePath("/dashboard")
  revalidatePath(`/modul/${moduleKey}`)
  revalidatePath("/audit")
  redirect(`/modul/${moduleKey}?saved=1`)
}
