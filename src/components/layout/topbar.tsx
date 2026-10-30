import { Bell, Building2 } from "lucide-react"
import type { OrganizationRole } from "@/lib/auth/context"
import { LogoutButton } from "@/components/auth/logout-button"

const roleLabels: Record<OrganizationRole, string> = {
  owner: "Superuser",
  director: "Direksi",
  finance: "Keuangan",
  hr: "SDM",
  operations: "Operasional",
  auditor: "Auditor",
  staff: "Staf",
}

export function Topbar({
  organizationName,
  role,
}: {
  organizationName: string
  role: OrganizationRole
}) {
  return (
    <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b border-line bg-white/95 px-5 backdrop-blur md:px-8">
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted">
        <Building2 size={16} className="shrink-0 text-brand" />
        <span className="truncate font-medium text-ink">{organizationName}</span>
        <span className="hidden text-line sm:inline">/</span>
        <span className="hidden sm:inline">{roleLabels[role]}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Notifikasi"
          className="flex size-10 items-center justify-center rounded-lg border border-line text-muted transition hover:bg-canvas hover:text-ink"
        >
          <Bell size={18} />
        </button>
        <LogoutButton />
      </div>
    </header>
  )
}
