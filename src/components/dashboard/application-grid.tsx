"use client"

import { useState } from "react"
import { getApplicationGroups } from "@/lib/app-catalog"
import { SalesMenu } from "@/components/sales/sales-menu"
import { SettingsModal } from "@/components/settings/settings-modal"
import type { OrganizationRole } from "@/lib/auth/context"

export function ApplicationGrid({
  role,
  navigationRoles = [role],
}: {
  role: OrganizationRole
  navigationRoles?: OrganizationRole[]
}) {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  return (
    <>
      <section
        aria-label="Aplikasi perusahaan"
        className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {getApplicationGroups(navigationRoles).map((group) => (
          <section
            key={group.id}
            aria-labelledby={`group-${group.id}`}
            className={`portal-group portal-tone-${group.tone}`}
          >
            <h2 id={`group-${group.id}`} className="portal-group-title">
              {group.name}
            </h2>
            <div className="mt-5 grid grid-cols-3 gap-x-3 gap-y-6">
              {group.apps.map((app) =>
                app.href === "/pengajuan/penjualan" ? (
                  <SalesMenu
                    key={app.href}
                    openInNewTab
                    triggerClassName="portal-application group"
                    triggerLabel="Penjualan"
                  >
                    <span className="portal-app-icon">
                      <app.icon size={27} strokeWidth={1.7} aria-hidden="true" />
                    </span>
                    <span className="mt-2.5 block max-w-[102px] text-center text-[13px] font-medium leading-[1.3] text-slate-900 dark:text-slate-100">
                      {app.name}
                    </span>
                  </SalesMenu>
                ) : app.href === "/pengaturan" ? (
                  <button
                    key={app.href}
                    type="button"
                    onClick={() => setIsSettingsModalOpen(true)}
                    title={`${app.description} · Buka Pengaturan`}
                    className="portal-application group cursor-pointer text-left bg-transparent border-0 p-0"
                  >
                    <span className="portal-app-icon">
                      <app.icon size={27} strokeWidth={1.7} aria-hidden="true" />
                    </span>
                    <span className="mt-2.5 block max-w-[102px] text-center text-[13px] font-medium leading-[1.3] text-slate-900 dark:text-slate-100">
                      {app.name}
                    </span>
                  </button>
                ) : (
                  <a
                    key={app.href}
                    href={app.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${app.description} · Buka di tab baru`}
                    className="portal-application group"
                  >
                    <span className="portal-app-icon">
                      <app.icon size={27} strokeWidth={1.7} aria-hidden="true" />
                    </span>
                    <span className="mt-2.5 block max-w-[102px] text-center text-[13px] font-medium leading-[1.3] text-slate-900 dark:text-slate-100">
                      {app.name}
                    </span>
                  </a>
                )
              )}
            </div>
          </section>
        ))}
      </section>

      {/* Pop Up Pengaturan (Tidak Buka Tab Baru) */}
      <SettingsModal
        open={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </>
  )
}
