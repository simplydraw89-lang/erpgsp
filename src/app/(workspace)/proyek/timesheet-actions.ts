"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireWorkspace } from "@/lib/auth/context"

export async function logProjectTimesheetAction(data: FormData) {
  const projectId = String(data.get("project_id") ?? "").trim()
  const targetPath = `/proyek/${projectId}`
  const { supabase, organizationId, isReadOnlyPreview } = await requireWorkspace()

  if (isReadOnlyPreview) {
    redirect(`${targetPath}?error=${encodeURIComponent("Mode lihat sebagai aktif.")}`)
  }

  const workDate = String(data.get("work_date") ?? "").trim()
  const personnelName = String(data.get("personnel_name") ?? "").trim()
  const personnelRole = String(data.get("personnel_role") ?? "").trim()
  const phaseName = String(data.get("phase_name") ?? "").trim()
  const hoursWorked = Number(data.get("hours_worked") ?? 0)
  const progressPct = Number(data.get("progress_pct") ?? 0)
  const notes = String(data.get("notes") ?? "").trim()

  if (!projectId || !workDate || !personnelName || !phaseName || !Number.isFinite(hoursWorked) || hoursWorked <= 0) {
    redirect(`${targetPath}?error=${encodeURIComponent("Lengkapi tanggal, personil, fase, dan jam kerja.")}`)
  }

  const { error } = await supabase.rpc("log_project_timesheet", {
    p_org: organizationId,
    p_project_id: projectId,
    p_work_date: workDate,
    p_personnel_name: personnelName,
    p_personnel_role: personnelRole || null,
    p_phase_name: phaseName,
    p_hours_worked: hoursWorked,
    p_progress_pct: Number.isFinite(progressPct) ? Math.min(100, Math.max(0, progressPct)) : 0,
    p_notes: notes || null,
  })

  if (error) {
    redirect(`${targetPath}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(targetPath)
  redirect(`${targetPath}?notice=${encodeURIComponent("Realisasi timesheet berhasil dicatat.")}`)
}
