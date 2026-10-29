"use server"

import { revalidatePath } from "next/cache"
import { requireWorkspace } from "@/lib/auth/context"

export async function reviewApprovalRequest(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "")
  const decision = String(formData.get("decision") ?? "")
  const note = String(formData.get("note") ?? "").trim()

  if (!requestId || !["approved", "rejected"].includes(decision)) {
    throw new Error("Permintaan persetujuan tidak valid.")
  }
  if (!note) {
    throw new Error("Catatan keputusan wajib diisi.")
  }

  const { supabase } = await requireWorkspace()
  const { error } = await supabase.rpc("review_approval_request", {
    p_request_id: requestId,
    p_decision: decision,
    p_note: note,
  })

  if (error) {
    throw new Error(`Gagal menyimpan keputusan: ${error.message}`)
  }

  revalidatePath("/approvals")
  revalidatePath("/audit")
}
