import { redirect } from "next/navigation"
import { cache } from "react"
import { createClient } from "@/lib/supabase/server"

// "owner" remains the legacy database key for the technical Superuser.
export type OrganizationRole =
  "owner" | "director" | "finance" | "hr" | "operations" | "auditor" | "staff"

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

  return {
    supabase,
    user,
    role: membership.role as OrganizationRole,
    organizationId: membership.organization_id as string,
    organizationName: organization.name as string,
  }
})
