"use client"

import { useEffect, useRef, useState } from "react"
import { Bell, ChevronRight, Search, X } from "lucide-react"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { LogoutButton } from "@/components/auth/logout-button"
import type { OrganizationRole } from "@/lib/auth/context"
import { getApplications, roleLabels } from "@/lib/app-catalog"

export function PortalHeader({
  organizationName,
  role,
  userName,
  email,
  greeting,
  firstName,
  date,
}: {
  organizationName: string
  role: OrganizationRole
  userName: string
  email: string
  greeting: string
  firstName: string
  date: string
}) {
  const [query, setQuery] = useState("")
  const dialog = useRef<HTMLDialogElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const apps = getApplications(role)
  const results = apps.filter((app) =>
    `${app.name} ${app.group} ${app.description}`
      .toLocaleLowerCase("id")
      .includes(query.trim().toLocaleLowerCase("id")),
  )
  function openSearch() {
    if (!dialog.current?.open) dialog.current?.showModal()
    searchInput.current?.focus()
  }
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        if (dialog.current?.open) dialog.current.close()
        else {
          dialog.current?.showModal()
          searchInput.current?.focus()
        }
      }
    }
    window.addEventListener("keydown", shortcut)
    return () => window.removeEventListener("keydown", shortcut)
  }, [])
  const initials = userName
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0])
    .join("")
    .toUpperCase()
  return (
    <>
      <header className="portal-header">
        <details className="portal-launcher">
          <summary
            aria-label="Menu aplikasi"
            className="flex size-11 cursor-pointer list-none items-center justify-center rounded-[13px] bg-slate-600/75 p-1.5 text-white shadow-sm transition hover:bg-slate-700/80"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 64 64"
              className="size-8 overflow-visible"
              fill="none"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="2.2"
            >
              <path d="M8 20 32 8l24 5v30L32 56 9 47Z" fill="white" fillOpacity=".08" />
              <path d="m8 20 24-12 24 5-24 13Z" fill="white" fillOpacity=".16" />
              <path d="M8 20v27l24 9V26L8 20Z" fill="black" fillOpacity=".07" />
              <path d="m32 26 24-13v30L32 56V26Z" fill="black" fillOpacity=".13" />
              <path d="m8 20 24-12 24 5-24 13L8 20Z" />
              <path d="M8 20v27l24 9V26" />
              <path d="m32 26 24-13v30L32 56" />
              <text
                x="50"
                y="75"
                transform="matrix(.23 .06 .01 .26 8 20)"
                fill="currentColor"
                stroke="none"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="48"
                fontWeight="700"
                textAnchor="middle"
              >G</text>
              <text
                x="49"
                y="75"
                transform="matrix(.21 -.11 .02 .28 32 26)"
                fill="currentColor"
                stroke="none"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="48"
                fontWeight="700"
                textAnchor="middle"
              >P</text>
              <text
                x="50"
                y="67"
                transform="matrix(.23 -.11 .23 .06 8 20)"
                fill="currentColor"
                stroke="none"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="45"
                fontWeight="700"
                textAnchor="middle"
              >S</text>
            </svg>
          </summary>
          <nav
            aria-label="Menu aplikasi"
            className="portal-popover left-0 top-12 max-h-[75vh] w-72 overflow-auto p-2"
          >
            <Link
              href="/dashboard"
              className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Beranda workspace
            </Link>
            {apps.map((app) => (
              <Link
                key={app.href}
                href={app.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
              >
                <app.icon size={16} />
                {app.name}
              </Link>
            ))}
          </nav>
        </details>
        <div className="portal-header-content">
          <div className="min-w-0">
            <h1 className="text-[23px] font-semibold tracking-tight text-slate-950 md:text-[29px]">
              <span className="font-medium text-[#b67b13]">{greeting},</span>{" "}
              {firstName}
            </h1>
            <p className="mt-1 truncate text-xs text-slate-500 md:text-[13px]">
              {date} <span className="px-1">·</span> {organizationName}
            </p>
          </div>
          <button
            type="button"
            onClick={openSearch}
            aria-label="Cari aplikasi"
            className="portal-search-button"
          >
            <Search size={16} />
            <span className="hidden flex-1 text-left sm:inline">
              Cari aplikasi
            </span>
            <kbd className="hidden text-xs sm:inline">Ctrl+K</kbd>
          </button>
        </div>
        <div className="portal-account-actions">
          <details className="relative">
            <summary
              aria-label="Notifikasi"
              className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full text-slate-600 hover:bg-white/70"
            >
              <Bell size={19} />
            </summary>
            <div className="portal-popover right-0 top-12 w-72 p-4">
              <p className="text-sm font-semibold">Pengajuan & persetujuan</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Lihat status pengajuan Anda atau permintaan yang perlu
                diperiksa.
              </p>
              <Link
                href="/approvals"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand"
              >
                Buka pusat persetujuan <ChevronRight size={14} />
              </Link>
            </div>
          </details>
          <details className="relative">
            <summary
              aria-label="Menu akun"
              className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full bg-emerald-100 text-sm font-medium text-emerald-800"
            >
              {initials || "U"}
            </summary>
            <div className="portal-popover right-0 top-12 w-72 p-4">
              <p className="font-semibold">{userName}</p>
              <p className="mt-1 break-all text-xs text-slate-500">{email}</p>
              <p className="mt-3 text-xs text-slate-500">
                {roleLabels[role]} · {organizationName}
              </p>
              <div className="mt-4 border-t border-slate-100 pt-2">
                <LogoutButton />
              </div>
            </div>
          </details>
        </div>
      </header>
      <dialog
        ref={dialog}
        onClose={() => setQuery("")}
        className="portal-search-dialog rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-900/30"
        aria-labelledby="app-search-title"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 p-4">
          <Search size={20} className="text-slate-400" />
          <label id="app-search-title" htmlFor="app-search" className="sr-only">
            Cari aplikasi perusahaan
          </label>
          <input
            id="app-search"
            ref={searchInput}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari aplikasi, modul, atau pengajuan..."
            className="min-w-0 flex-1 text-sm outline-none"
          />
          <button
            aria-label="Tutup pencarian"
            onClick={() => dialog.current?.close()}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {results.length ? (
            results.map((app) => (
              <Link
                key={app.href}
                href={app.href}
                onNavigate={() => dialog.current?.close()}
                className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-slate-50"
              >
                <span className="rounded-xl bg-slate-100 p-2 text-slate-600">
                  <app.icon size={19} />
                </span>
                <span>
                  <span className="block text-sm font-medium">{app.name}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {app.group} · {app.description}
                  </span>
                </span>
              </Link>
            ))
          ) : (
            <p className="p-6 text-center text-sm text-slate-500">
              Tidak ada aplikasi yang sesuai dengan pencarian Anda.
            </p>
          )}
        </div>
        <p className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">
          Aplikasi ditampilkan sesuai hak akses Anda. Esc untuk menutup.
        </p>
      </dialog>
    </>
  )
}
