"use client"

import { usePathname } from "next/navigation"
import { Topbar } from "@/components/layout/topbar"
import { ModuleDock } from "@/components/layout/module-dock"
import { PortalHeader } from "@/components/dashboard/portal-header"
import type { OrganizationRole } from "@/lib/auth/context"
import { ViewAsBanner } from "@/components/auth/view-as-control"

type ShellProps = {
  children: React.ReactNode
  organizationName: string
  role: OrganizationRole
  navigationRoles: OrganizationRole[]
  roleLabel?: string
  actorRole: OrganizationRole
  isReadOnlyPreview: boolean
  isPreviewInvalid: boolean
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
        {props.isReadOnlyPreview && (
          <ViewAsBanner role={props.role} isInvalid={props.isPreviewInvalid} />
        )}
        <PortalHeader {...props} />
        <main className="mx-auto max-w-[1184px] px-5 pb-12 pt-6 md:px-6 md:pt-5">
          <fieldset
            disabled={props.isReadOnlyPreview}
            className="m-0 min-w-0 border-0 p-0"
          >
            {children}
          </fieldset>
        </main>
      </div>
    )
  return (
    <div className="min-h-screen">
      {props.isReadOnlyPreview && (
        <ViewAsBanner role={props.role} isInvalid={props.isPreviewInvalid} />
      )}
      <Topbar
        organizationName={props.organizationName}
        role={props.role}
        roleLabel={props.roleLabel}
        actorRole={props.actorRole}
        isReadOnlyPreview={props.isReadOnlyPreview}
        isPreviewInvalid={props.isPreviewInvalid}
      />
      <main className="mx-auto max-w-[1500px] px-5 pb-32 pt-7 md:px-8 md:pb-36 md:pt-9">
        <fieldset
          disabled={props.isReadOnlyPreview}
          className="m-0 min-w-0 border-0 p-0"
        >
          {children}
        </fieldset>
      </main>
      <ModuleDock role={props.role} navigationRoles={props.navigationRoles} />
    </div>
  )
}
