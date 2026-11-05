import { redirect } from "next/navigation"
import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { readViewAsState } from "@/lib/auth/view-as"
import { navigationForJobs } from "@/lib/auth/job-access"

// "owner" is the legacy database key for the system owner's unrestricted Super Admin.
export type OrganizationRole =
  "owner" | "director" | "manager" | "finance" | "hr" | "operations" | "auditor" | "staff"

export const requireWorkspace = cache(async function requireWorkspace() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError && authError.name !== "AuthSessionMissingError") {
    throw new Error(`Gagal memverifikasi sesi: ${authError.message}`)
  }
  if (!user) redirect("/login")

  const { data: membership, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Gagal memuat keanggotaan organisasi: ${error.message}`)
  }
  if (!membership) redirect("/setup?reason=membership")

  const organization = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations

  if (!organization) redirect("/setup?reason=organization")

  const actorRole = membership.role as OrganizationRole
  const viewAs = await readViewAsState(
    supabase,
    user.id,
    membership.organization_id,
  )
  const [profile, assignments] = await Promise.all([
    supabase.from("person_profiles").select("relationship_status")
      .eq("organization_id", membership.organization_id).eq("user_id", user.id).maybeSingle(),
    supabase.from("work_assignments").select("id,branch_id,job_role")
      .eq("organization_id", membership.organization_id).eq("user_id", user.id),
  ])
  const navigationRoles = navigationForJobs(actorRole, profile.data?.relationship_status ?? null,
    assignments.data ?? [], viewAs.role)

  return {
    supabase,
    user,
    actorRole,
    role: navigationRoles[0] ?? "staff" as OrganizationRole,
    navigationRoles,
    roleLabel: !navigationRoles.length
      ? ({ client: "Klien", consultant: "Konsultan / tenaga ahli", vendor: "Vendor" } as Record<string, string>)[profile.data?.relationship_status ?? ""]
      : undefined,
    relationshipStatus: profile.data?.relationship_status as string | undefined,
    workAssignments: assignments.data ?? [],
    isReadOnlyPreview: viewAs.isActive,
    isPreviewInvalid: viewAs.isInvalid,
    organizationId: membership.organization_id as string,
    organizationName: organization.name as string,
  }
})
