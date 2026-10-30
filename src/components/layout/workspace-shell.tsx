"use client"

import { usePathname } from "next/navigation"
import { Topbar } from "@/components/layout/topbar"
import { ModuleDock } from "@/components/layout/module-dock"
import { PortalHeader } from "@/components/dashboard/portal-header"
import type { OrganizationRole } from "@/lib/auth/context"

type ShellProps = {
  children: React.ReactNode
  organizationName: string
  role: OrganizationRole
  userName: string
  email: string
  greeting: string
  firstName: string
  date: string
}
export function WorkspaceShell({ children, ...props }: ShellProps) {
  const portal = usePathname() === "/dashboard"
  if (portal)
    return (
      <div className="portal-background min-h-screen">
        <PortalHeader {...props} />
        <main className="mx-auto max-w-[1184px] px-5 pb-12 pt-6 md:px-6 md:pt-5">
          {children}
        </main>
      </div>
    )
  return (
    <div className="min-h-screen">
      <Topbar organizationName={props.organizationName} role={props.role} />
      <main className="mx-auto max-w-[1500px] px-5 pb-32 pt-7 md:px-8 md:pb-36 md:pt-9">
        {children}
      </main>
      <ModuleDock role={props.role} />
    </div>
  )
}
