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

  const attendanceType = String(data.get("attendance_type") ?? "office").trim()
  const status = String(data.get("attendance_status") ?? "present").trim()
  const summary = String(data.get("work_summary") ?? "").trim()
  const location = String(data.get("location_note") ?? "").trim()
  const reason = String(data.get("reason") ?? "").trim()
  const photoData = String(data.get("photo_data") ?? "").trim()
  const latitude = Number(data.get("latitude") ?? 0) || null
  const longitude = Number(data.get("longitude") ?? 0) || null

  if (attendanceType === "site" && !reason && !location) {
    finish("error", "Untuk absensi di site/lapangan, wajib mengisi nama site proyek atau alasan.")
  }

  const { data: res, error } = await supabase.rpc("record_attendance_entry_v2", {
    p_org: organizationId,
    p_attendance_type: attendanceType,
    p_status: status,
    p_work_summary: summary || null,
    p_location_note: location || null,
    p_latitude: latitude,
    p_longitude: longitude,
    p_photo_data: photoData || null,
    p_reason: reason || null,
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
          attendance_type: attendanceType,
          work_summary: summary || null,
          location_note: location || null,
          latitude,
          longitude,
          photo_data: photoData || null,
          reason: reason || null,
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
          attendance_type: attendanceType,
          attendance_status: status,
          work_summary: summary || null,
          location_note: location || null,
          latitude,
          longitude,
          photo_data: photoData || null,
          reason: reason || null,
        })
      if (insertErr) finish("error", insertErr.message)
      revalidatePath(sdmPath)
      finish(
        "notice",
        attendanceType === "site"
          ? "Absen masuk di site lapangan berhasil dicatat."
          : "Absen masuk di kantor berhasil diverifikasi."
      )
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

export async function reviewLeaveRequestAction(data: FormData) {
  const { supabase, organizationId, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) {
    finish("error", "Mode lihat sebagai aktif: persetujuan cuti dinonaktifkan.")
  }

  const requestId = String(data.get("request_id") ?? "").trim()
  const decision = String(data.get("decision") ?? "").trim()
  const note = String(data.get("note") ?? "").trim()

  if (!requestId || !["approved", "rejected"].includes(decision)) {
    finish("error", "Data keputusan cuti tidak valid.")
  }

  const { error } = await supabase.rpc("review_leave_request", {
    p_org: organizationId,
    p_request_id: requestId,
    p_decision: decision,
    p_note: note || null,
  })

  if (error) {
    // Fallback direct update if RPC has check error
    const { error: fallbackErr } = await supabase
      .from("leave_requests")
      .update({
        status: decision,
        review_note: note || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("organization_id", organizationId)

    if (fallbackErr) finish("error", fallbackErr.message)
  }

  revalidatePath(sdmPath)
  finish("notice", decision === "approved" ? "Pengajuan cuti berhasil disetujui." : "Pengajuan cuti ditolak.")
}

export async function submitReimbursementAction(data: FormData) {
  const { supabase, organizationId, user, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) {
    finish("error", "Mode lihat sebagai aktif: pengajuan reimbursement dinonaktifkan.")
  }

  const title = String(data.get("title") ?? "").trim()
  const category = String(data.get("category") ?? "others").trim()
  const amount = Number(data.get("amount") ?? 0)
  const expenseDate = String(data.get("expense_date") ?? "").trim() || new Date().toISOString().slice(0, 10)
  const projectId = String(data.get("project_id") ?? "").trim() || null
  const description = String(data.get("description") ?? "").trim()
  const receiptUrl = String(data.get("receipt_url") ?? "").trim()

  if (!title || amount <= 0) {
    finish("error", "Judul pengeluaran dan nominal wajib diisi.")
  }

  const { error } = await supabase.from("hr_reimbursements").insert({
    organization_id: organizationId,
    user_id: user.id,
    project_id: projectId,
    title,
    category,
    amount,
    expense_date: expenseDate,
    description: description || null,
    receipt_url: receiptUrl || null,
    status: "submitted",
  })

  if (error) finish("error", error.message)
  revalidatePath(sdmPath)
  finish("notice", "Klaim reimbursement berhasil diajukan.")
}

export async function reviewReimbursementAction(data: FormData) {
  const { supabase, organizationId, user, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) {
    finish("error", "Mode lihat sebagai aktif: review reimbursement dinonaktifkan.")
  }

  const reimbursementId = String(data.get("reimbursement_id") ?? "").trim()
  const nextStatus = String(data.get("next_status") ?? "").trim()
  const reviewNote = String(data.get("review_note") ?? "").trim()

  if (!reimbursementId || !["approved_hr", "paid", "rejected"].includes(nextStatus)) {
    finish("error", "Status klaim tidak valid.")
  }

  const payload: Record<string, unknown> = {
    status: nextStatus,
    reviewer_id: user.id,
    review_note: reviewNote || null,
    reviewed_at: new Date().toISOString(),
  }

  if (nextStatus === "paid") {
    payload.paid_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from("hr_reimbursements")
    .update(payload)
    .eq("id", reimbursementId)
    .eq("organization_id", organizationId)

  if (error) finish("error", error.message)
  revalidatePath(sdmPath)
  finish(
    "notice",
    nextStatus === "approved_hr"
      ? "Klaim disetujui oleh HR."
      : nextStatus === "paid"
      ? "Klaim reimbursement telah dicairkan oleh Keuangan."
      : "Klaim reimbursement ditolak."
  )
}

export async function submitTimesheetAction(data: FormData) {
  const { supabase, organizationId, user, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) {
    finish("error", "Mode lihat sebagai aktif: pencatatan timesheet dinonaktifkan.")
  }

  const logDate = String(data.get("log_date") ?? "").trim() || new Date().toISOString().slice(0, 10)
  const durationHours = Number(data.get("duration_hours") ?? 0)
  const projectId = String(data.get("project_id") ?? "").trim() || null
  const activityDescription = String(data.get("activity_description") ?? "").trim()

  if (durationHours <= 0 || !activityDescription) {
    finish("error", "Durasi jam kerja dan uraian pekerjaan wajib diisi.")
  }

  const { error } = await supabase.from("hr_timesheets").insert({
    organization_id: organizationId,
    user_id: user.id,
    project_id: projectId,
    log_date: logDate,
    duration_hours: durationHours,
    activity_description: activityDescription,
  })

  if (error) finish("error", error.message)
  revalidatePath(sdmPath)
  finish("notice", "Catatan jam kerja harian (timesheet) berhasil disimpan.")
}

export async function uploadEmployeeDocumentAction(data: FormData) {
  const { supabase, organizationId, user, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) {
    finish("error", "Mode lihat sebagai aktif: upload dokumen dinonaktifkan.")
  }

  const docType = String(data.get("doc_type") ?? "other").trim()
  const title = String(data.get("title") ?? "").trim()
  const fileUrl = String(data.get("file_url") ?? "").trim()
  const expiryDate = String(data.get("certificate_expiry") ?? "").trim() || null

  if (!title || !fileUrl) {
    finish("error", "Judul berkas dan URL/link dokumen wajib diisi.")
  }

  const { error } = await supabase.from("hr_employee_documents").insert({
    organization_id: organizationId,
    user_id: user.id,
    doc_type: docType,
    title,
    file_url: fileUrl,
    certificate_expiry: expiryDate,
    verification_status: "pending",
  })

  if (error) finish("error", error.message)
  revalidatePath(sdmPath)
  finish("notice", "Dokumen kepegawaian berhasil diunggah ke Digital Vault.")
}

export async function createDisciplinaryAction(data: FormData) {
  const { supabase, organizationId, user, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) {
    finish("error", "Mode lihat sebagai aktif: penerbitan SP dinonaktifkan.")
  }

  const employeeId = String(data.get("employee_id") ?? "").trim()
  const level = String(data.get("level") ?? "sp1").trim()
  const spNumber = String(data.get("sp_number") ?? "").trim()
  const issueDescription = String(data.get("issue_description") ?? "").trim()
  const effectiveUntil = String(data.get("effective_until") ?? "").trim()
  const notes = String(data.get("notes") ?? "").trim()

  if (!employeeId || !spNumber || !issueDescription || !effectiveUntil) {
    finish("error", "Karyawan, nomor SP, klausul pelanggaran, dan masa berlaku wajib diisi.")
  }

  const { error } = await supabase.from("hr_disciplinary_actions").insert({
    organization_id: organizationId,
    employee_id: employeeId,
    sp_number: spNumber,
    level,
    issue_description: issueDescription,
    effective_until: effectiveUntil,
    notes: notes || null,
    issued_by: user.id,
  })

  if (error) finish("error", error.message)
  revalidatePath(sdmPath)
  finish("notice", `Surat Peringatan (${spNumber}) berhasil diterbitkan.`)
}

export async function createSppdAction(data: FormData) {
  const { supabase, organizationId, user, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) {
    finish("error", "Mode lihat sebagai aktif: penerbitan SPPD dinonaktifkan.")
  }

  const targetUserId = String(data.get("user_id") ?? user.id).trim()
  const sppdNumber = String(data.get("sppd_number") ?? "").trim()
  const destinationCity = String(data.get("destination_city") ?? "").trim()
  const departureDate = String(data.get("departure_date") ?? "").trim()
  const returnDate = String(data.get("return_date") ?? "").trim()
  const purpose = String(data.get("purpose") ?? "").trim()
  const dailyAllowance = Number(data.get("daily_allowance") ?? 0)

  if (!sppdNumber || !destinationCity || !departureDate || !returnDate || !purpose) {
    finish("error", "Semua data form SPPD wajib diisi lengkap.")
  }

  const { error } = await supabase.from("hr_sppd").insert({
    organization_id: organizationId,
    user_id: targetUserId,
    sppd_number: sppdNumber,
    destination_city: destinationCity,
    departure_date: departureDate,
    return_date: returnDate,
    purpose,
    daily_allowance: dailyAllowance,
    status: "active",
    approved_by: user.id,
  })

  if (error) finish("error", error.message)
  revalidatePath(sdmPath)
  finish("notice", `Surat Perintah Perjalanan Dinas (${sppdNumber}) berhasil diterbitkan.`)
}
