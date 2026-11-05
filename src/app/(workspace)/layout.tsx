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
    isReadOnlyPreview,
    isPreviewInvalid,
    user,
  } = await requireWorkspace()
  const userName = getDisplayName(user)

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
