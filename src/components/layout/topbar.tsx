import { Building2 } from "lucide-react"
import { SalesNotificationBell } from "@/components/sales/notifications"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import type { OrganizationRole } from "@/lib/auth/context"
import { LogoutButton } from "@/components/auth/logout-button"
import { ViewAsControl } from "@/components/auth/view-as-control"
import { ThemeToggle } from "@/components/layout/theme-toggle"

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
    <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b border-line bg-white/95 px-5 backdrop-blur transition-colors md:px-8 dark:border-slate-800 dark:bg-slate-900/95">
      <Link
        href="/dashboard"
        aria-label={`${organizationName} — esperapp by GSP`}
        className="flex min-w-0 items-center gap-2 rounded-lg text-sm text-muted transition hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand dark:text-slate-400 dark:hover:text-teal-400"
      >
        <Building2 size={16} className="shrink-0 text-brand dark:text-teal-400" />
        <span className="truncate font-medium text-ink dark:text-slate-100">{organizationName}</span>
        <span className="rounded bg-teal-100 dark:bg-teal-950/80 px-1.5 py-0.5 text-[10px] font-bold text-teal-800 dark:text-teal-300">
          esperapp
        </span>
        <span className="hidden text-line sm:inline dark:text-slate-700">/</span>
        <span className="hidden sm:inline dark:text-slate-400">{roleLabel ?? roleLabels[role]}</span>
      </Link>
      <div className="flex items-center gap-2">
        <ViewAsControl
          actorRole={actorRole}
          role={role}
          isActive={isReadOnlyPreview}
          isInvalid={isPreviewInvalid}
        />
        <ThemeToggle align="right" />
        <SalesNotificationBell disabled={isReadOnlyPreview} />
        <LogoutButton />
      </div>
    </header>
  )
}
