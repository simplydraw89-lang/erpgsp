import { WorkspaceShell } from "@/components/layout/workspace-shell"
import { requireWorkspace } from "@/lib/auth/context"
import { getDisplayName, getPersonalGreeting } from "@/lib/dashboard"

export const dynamic = "force-dynamic"

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const {
    organizationName,
    role,
    navigationRoles,
    roleLabel,
    actorRole,
    relationshipStatus,
    isReadOnlyPreview,
    isPreviewInvalid,
    user,
    supabase,
    organizationId,
  } = await requireWorkspace()

  let userName = getDisplayName(user)

  // Jika akun adalah klien dan nama masih nomor HP atau default, ambil nama perusahaan resmi
  if (relationshipStatus === "client" || (!navigationRoles.length && user.email?.includes("bara"))) {
    try {
      const { data: clientData } = await supabase
        .from("sales_clients")
        .select("name, contact")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (clientData?.name) {
        userName = clientData.name
      }
    } catch {
      // fallback to userName
    }
  }

  return (
    <WorkspaceShell
      organizationName={organizationName}
      role={role}
      navigationRoles={navigationRoles}
      roleLabel={roleLabel}
      actorRole={actorRole}
      isReadOnlyPreview={isReadOnlyPreview}
      isPreviewInvalid={isPreviewInvalid}
      userName={userName}
      email={user.email ?? ""}
      {...getPersonalGreeting(userName)}
    >
      {children}
    </WorkspaceShell>
  )
}
