"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireWorkspace } from "@/lib/auth/context"

const cutiPath = "/pengajuan/cuti"

function finish(key: "notice" | "error", message: string): never {
  const query = new URLSearchParams({ [key]: message })
  redirect(`${cutiPath}?${query.toString()}`)
}

function daysBetweenInclusive(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00Z`)
  const e = new Date(`${end}T00:00:00Z`)
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime()) || e < s) return 0
  return Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

export async function submitLeaveAction(data: FormData) {
  const { supabase, organizationId, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) {
    finish("error", "Mode lihat sebagai aktif: pengajuan dinonaktifkan.")
  }

  const leaveType = String(data.get("leave_type") ?? "").trim()
  const branchId = String(data.get("branch_id") ?? "").trim() || null
  const startsOn = String(data.get("starts_on") ?? "").trim()
  const endsOn = String(data.get("ends_on") ?? "").trim()
  const reason = String(data.get("reason") ?? "").trim()

  const totalDays = daysBetweenInclusive(startsOn, endsOn)
  if (totalDays <= 0) {
    finish("error", "Tanggal mulai dan selesai cuti tidak valid.")
  }
  if (!reason) {
    finish("error", "Alasan pengajuan cuti wajib diisi.")
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
  revalidatePath(cutiPath)
  finish("notice", `Pengajuan cuti (${totalDays} hari) berhasil dikirim.`)
}

export async function reviewLeaveAction(data: FormData) {
  const { supabase, organizationId, isReadOnlyPreview } = await requireWorkspace()
  if (isReadOnlyPreview) {
    finish("error", "Mode lihat sebagai aktif: persetujuan dinonaktifkan.")
  }

  const requestId = String(data.get("request_id") ?? "").trim()
  const decision = String(data.get("decision") ?? "").trim()
  const note = String(data.get("review_note") ?? "").trim()

  if (!requestId || (decision !== "approved" && decision !== "rejected")) {
    finish("error", "Parameter keputusan cuti tidak valid.")
  }

  const { error } = await supabase.rpc("review_leave_request", {
    p_org: organizationId,
    p_request_id: requestId,
    p_decision: decision,
    p_note: note || null,
  })

  if (error) finish("error", error.message)
  revalidatePath(cutiPath)
  finish(
    "notice",
    decision === "approved"
      ? "Pengajuan cuti disetujui dan saldo cuti diperbarui."
      : "Pengajuan cuti ditolak.",
  )
}
