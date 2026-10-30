"use server"

import { requireWorkspace } from "@/lib/auth/context"
import { revalidatePath } from "next/cache"
import { isRecordType } from "@/lib/workflow"

export async function updateApprovalPolicy(
  data: FormData,
): Promise<{ error?: string }> {
  const { supabase, organizationId, role } = await requireWorkspace()
  const type = String(data.get("recordType") ?? "")
  if (role !== "owner" || !isRecordType(type))
    return { error: "Hanya Superuser dapat mengatur kebijakan persetujuan." }
  const raw = String(data.get("threshold") ?? "").trim()
  if (raw && (!Number.isFinite(Number(raw)) || Number(raw) < 0))
    return { error: "Batas nominal harus nol atau lebih." }
  const { error } = await supabase.rpc("set_approval_policy", {
    p_org: organizationId,
    p_type: type,
    p_reviewer: String(data.get("reviewer")),
    p_threshold: raw || null,
    p_escalation: String(data.get("escalation") ?? "owner"),
    p_expected_version: Number(data.get("version")),
  })
  if (error) return { error: error.message }
  revalidatePath("/pengaturan/persetujuan")
  return {}
}
