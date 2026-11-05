import { Building2 } from "lucide-react"
import { SalesNotificationBell } from "@/components/sales/notifications"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import type { OrganizationRole } from "@/lib/auth/context"
import { LogoutButton } from "@/components/auth/logout-button"
import { ViewAsControl } from "@/components/auth/view-as-control"

const roleLabels: Record<OrganizationRole, string> = {
  owner: "Super Admin",
  director: "Direksi",
  manager: "Manager",
  finance: "Keuangan",
  hr: "SDM",
  operations: "Operasional",
  auditor: "Auditor",
  staff: "Staf",
}

export function Topbar({
  organizationName,
  role,
  roleLabel,
  actorRole,
  isReadOnlyPreview,
  isPreviewInvalid,
}: {
  organizationName: string
  role: OrganizationRole
  roleLabel?: string
  actorRole: OrganizationRole
  isReadOnlyPreview: boolean
  isPreviewInvalid: boolean
}) {
  return (
    <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b border-line bg-white/95 px-5 backdrop-blur md:px-8">
      <Link href="/dashboard" aria-label={`${organizationName} — kembali ke beranda`} className="flex min-w-0 items-center gap-2 rounded-lg text-sm text-muted transition hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
        <Building2 size={16} className="shrink-0 text-brand" />
        <span className="truncate font-medium text-ink">{organizationName}</span>
        <span className="hidden text-line sm:inline">/</span>
        <span className="hidden sm:inline">{roleLabel ?? roleLabels[role]}</span>
      </Link>
      <div className="flex items-center gap-2">
        <ViewAsControl
          actorRole={actorRole}
          role={role}
          isActive={isReadOnlyPreview}
          isInvalid={isPreviewInvalid}
        />
        <SalesNotificationBell disabled={isReadOnlyPreview} />
        <LogoutButton />
      </div>
    </header>
  )
}
