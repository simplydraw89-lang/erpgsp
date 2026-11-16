import { requireWorkspace } from "@/lib/auth/context"
import { getDisplayName } from "@/lib/dashboard"
import { roleLabels } from "@/lib/app-catalog"
import { ThemeSettingsView } from "@/components/settings/theme-settings-view"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const { user, role, roleLabel, organizationName } = await requireWorkspace()

  const userName = getDisplayName(user)
  const activeRoleLabel = roleLabel ?? roleLabels[role] ?? "Pengguna"

  return (
    <div className="mx-auto max-w-5xl">
      <ThemeSettingsView
        userName={userName}
        email={user.email ?? "-"}
        roleLabel={activeRoleLabel}
        organizationName={organizationName}
      />
    </div>
  )
}
