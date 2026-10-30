import "server-only"
import type { requireWorkspace } from "@/lib/auth/context"
import {
  recordSpecs,
  type RecordType,
  type ReferenceOptions,
} from "@/lib/workflow"

export async function loadReferences(
  supabase: Awaited<ReturnType<typeof requireWorkspace>>["supabase"],
  org: string,
  type: RecordType,
): Promise<ReferenceOptions> {
  const result: ReferenceOptions = {}
  const fields = recordSpecs[type].fields.filter((f) => f.type === "reference")
  await Promise.all(
    fields.map(async (field) => {
      if (field.name === "client_id" || field.name === "project_id") {
        const { data, error } = await supabase
          .from(field.name === "client_id" ? "crm_clients" : "crm_projects")
          .select("id,name")
          .eq("organization_id", org)
          .order("name")
          .limit(500)
        if (error) throw new Error("Pilihan relasi gagal dimuat.")
        result[field.name] = (data ?? []).map((row) => ({
          value: row.id,
          label: row.name,
        }))
      } else {
        const { data, error } = await supabase
          .from("organization_members")
          .select("user_id,role")
          .eq("organization_id", org)
          .neq("role","owner")
        if (error) throw new Error("Pilihan penanggung jawab gagal dimuat.")
        result[field.name] = (data ?? []).map((row) => ({
          value: row.user_id,
          label: `${row.role} · ${row.user_id.slice(0, 8)}`,
        }))
      }
    }),
  )
  return result
}
