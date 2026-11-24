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

export async function recordAttendanceAction(data: FormData) {
  const { supabase, organizationId, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) {
    finish("error", "Mode lihat sebagai aktif: absensi dinonaktifkan.")
  }

  const status = String(data.get("attendance_status") ?? "present").trim()
  const summary = String(data.get("work_summary") ?? "").trim()
  const location = String(data.get("location_note") ?? "").trim()

  const { data: res, error } = await supabase.rpc("record_attendance_entry", {
    p_org: organizationId,
    p_status: status,
    p_work_summary: summary || null,
    p_location_note: location || null,
  })

  if (error) {
    const today = new Date().toISOString().slice(0, 10)
    const { data: existing } = await supabase
      .from("hr_attendance")
      .select("id, clock_in")
      .eq("organization_id", organizationId)
      .eq("work_date", today)
      .maybeSingle()

    if (existing) {
      const { error: updateErr } = await supabase
        .from("hr_attendance")
        .update({
          clock_out: new Date().toISOString(),
          attendance_status: status,
          work_summary: summary || null,
          location_note: location || null,
        })
        .eq("id", existing.id)
      if (updateErr) finish("error", updateErr.message)
      revalidatePath(sdmPath)
      finish("notice", "Absen pulang berhasil dicatat.")
    } else {
      const { error: insertErr } = await supabase
        .from("hr_attendance")
        .insert({
          organization_id: organizationId,
          work_date: today,
          clock_in: new Date().toISOString(),
          attendance_status: status,
          work_summary: summary || null,
          location_note: location || null,
        })
      if (insertErr) finish("error", insertErr.message)
      revalidatePath(sdmPath)
      finish("notice", "Absen masuk berhasil dicatat.")
    }
  }

  revalidatePath(sdmPath)
  finish("notice", res?.message || "Data kehadiran berhasil dicatat.")
}

export async function submitLeaveAction(data: FormData) {
  const { supabase, organizationId, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) {
    finish("error", "Mode lihat sebagai aktif: pengajuan cuti dinonaktifkan.")
  }

  const leaveType = String(data.get("leave_type") ?? "annual").trim()
  const startsOn = String(data.get("starts_on") ?? "").trim()
  const endsOn = String(data.get("ends_on") ?? "").trim()
  const totalDays = Number(data.get("total_days") ?? 1)
  const reason = String(data.get("reason") ?? "").trim()
  const branchId = String(data.get("branch_id") ?? "").trim() || null

  if (!startsOn || !endsOn || !reason) {
    finish("error", "Tanggal mulai, selesai, dan alasan cuti wajib diisi.")
  }

  const { error } = await supabase.rpc("submit_leave_request", {
    p_org: organizationId,
    p_branch_id: branchId,
    p_leave_type: leaveType,
    p_starts_on: startsOn,
    p_ends_on: endsOn,
    p_total_days: totalDays,
    p_reason: reason,
  })

  if (error) finish("error", error.message)
  revalidatePath(sdmPath)
  finish("notice", "Pengajuan cuti berhasil dikirim.")
}
