"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireWorkspace } from "@/lib/auth/context"

const sdmPath = "/modul/sdm"

function finish(key: "notice" | "error", message: string): never {
  const query = new URLSearchParams({ [key]: message })
  redirect(`${sdmPath}?${query.toString()}`)
}

export async function createPayrollRunAction(data: FormData) {
  const { supabase, organizationId, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) {
    finish("error", "Mode lihat sebagai aktif: pembuatan payroll dinonaktifkan.")
  }

  const periodMonth = String(data.get("period_month") ?? "").trim()
  const title = String(data.get("title") ?? "").trim()
  const employeeId = String(data.get("employee_id") ?? "").trim()
  const baseSalary = Number(data.get("base_salary") ?? 0)
  const allowances = Number(data.get("allowances") ?? 0)
  const deductions = Number(data.get("deductions") ?? 0)
  const pph21 = Number(data.get("pph21_amount") ?? 0)
  const notes = String(data.get("notes") ?? "").trim()

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonth)) {
    finish("error", "Format periode payroll harus YYYY-MM.")
  }
  if (!title || !employeeId) {
    finish("error", "Judul dan karyawan wajib diisi.")
  }

  const { error } = await supabase.rpc("create_payroll_run", {
    p_org: organizationId,
    p_period_month: periodMonth,
    p_title: title,
    p_items: [
      {
        employee_id: employeeId,
        base_salary: Number.isFinite(baseSalary) ? baseSalary : 0,
        allowances: Number.isFinite(allowances) ? allowances : 0,
        deductions: Number.isFinite(deductions) ? deductions : 0,
        pph21_amount: Number.isFinite(pph21) ? pph21 : 0,
        notes,
      },
    ],
  })

  if (error) finish("error", error.message)
  revalidatePath(sdmPath)
  finish("notice", `Daftar payroll ${periodMonth} berhasil dibuat.`)
}

export async function approvePayrollRunAction(data: FormData) {
  const { supabase, organizationId, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) {
    finish("error", "Mode lihat sebagai aktif: persetujuan payroll dinonaktifkan.")
  }

  const runId = String(data.get("run_id") ?? "").trim()
  const nextStatus = String(data.get("next_status") ?? "").trim()
  if (!runId || (nextStatus !== "approved" && nextStatus !== "paid")) {
    finish("error", "Status payroll tidak valid.")
  }

  const { error } = await supabase.rpc("approve_payroll_run", {
    p_org: organizationId,
    p_run_id: runId,
    p_next_status: nextStatus,
  })

  if (error) finish("error", error.message)
  revalidatePath(sdmPath)
  finish(
    "notice",
    nextStatus === "approved"
      ? "Payroll disetujui dan siap dibayarkan."
      : "Payroll ditandai sudah dibayarkan.",
  )
}
