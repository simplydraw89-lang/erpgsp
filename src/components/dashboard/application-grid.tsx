"use client"

import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { getApplicationGroups } from "@/lib/app-catalog"
import type { OrganizationRole } from "@/lib/auth/context"

export function ApplicationGrid({ role }: { role: OrganizationRole }) {
  return (
    <section
      aria-label="Aplikasi perusahaan"
      className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      {getApplicationGroups(role).map((group) => (
        <section
          key={group.id}
          aria-labelledby={`group-${group.id}`}
          className={`portal-group portal-tone-${group.tone}`}
        >
          <h2 id={`group-${group.id}`} className="portal-group-title">
            {group.name}
          </h2>
          <div className="mt-5 grid grid-cols-3 gap-x-3 gap-y-6">
            {group.apps.map((app) => (
              <Link
                key={app.href}
                href={app.href}
                title={app.description}
                className="portal-application group"
              >
                <span className="portal-app-icon">
                  <app.icon size={27} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <span className="mt-2.5 block max-w-[102px] text-center text-[13px] font-medium leading-[1.3] text-slate-900">
                  {app.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </section>
  )
}
