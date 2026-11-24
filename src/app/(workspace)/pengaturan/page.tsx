import { requireWorkspace } from "@/lib/auth/context"
import { getDisplayName } from "@/lib/dashboard"
import { roleLabels } from "@/lib/app-catalog"
import { SettingsTabShell } from "@/components/settings/settings-tab-shell"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const { user, role, roleLabel, organizationName } = await requireWorkspace()

  const userName = getDisplayName(user)
  const activeRoleLabel = roleLabel ?? roleLabels[role] ?? "Pengguna"

  return (
    <div className="mx-auto max-w-5xl">
      <SettingsTabShell
        userName={userName}
        email={user.email ?? "-"}
        roleLabel={activeRoleLabel}
        organizationName={organizationName}
      />
    </div>
  )
}
