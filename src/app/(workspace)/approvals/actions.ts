"use server"

import { revalidatePath } from "next/cache"
import { requireWorkspace } from "@/lib/auth/context"

export async function transitionDocument(
  data: FormData,
): Promise<{ error?: string }> {
  const { supabase, organizationId } = await requireWorkspace()
  const id = String(data.get("documentId") ?? "")
  const version = Number(data.get("version"))
  const action = String(data.get("action") ?? "")
  const { data: document, error: loadError } = await supabase
    .from("workflow_documents")
    .select("id,module_key")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (loadError || !document || !Number.isInteger(version) || version < 1)
    return { error: "Dokumen atau versi tidak valid." }
  let error: { message: string } | null = null
  if (action === "submit" || action === "execute" || action === "revise") {
    const name =
      action === "submit"
        ? "submit_workflow_document"
        : action === "execute"
          ? "execute_workflow_document"
          : "revise_workflow_document"
    ;({ error } = await supabase.rpc(name, {
      p_document_id: id,
      p_expected_version: version,
    }))
  } else if (action === "approved" || action === "rejected") {
    const { data: request, error: requestError } = await supabase
      .from("approval_requests")
      .select("id")
      .eq("document_id", id)
      .eq("document_version", version)
      .maybeSingle()
    if (requestError || !request)
      return { error: "Permintaan persetujuan tidak ditemukan." }
    ;({ error } = await supabase.rpc("review_approval_request", {
      p_request_id: request.id,
      p_decision: action,
      p_note: String(data.get("note") ?? "").trim(),
    }))
  } else return { error: "Aksi tidak valid." }
  if (error) return { error: error.message }
  for (const path of [
    "/dashboard",
    "/approvals",
    "/audit",
    "/modul/manajemen",
    `/modul/${document.module_key}`,
    `/dokumen/${id}`,
  ])
    revalidatePath(path)
  return {}
}
