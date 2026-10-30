"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { modules } from "@/lib/modules"
import type { OrganizationRole } from "@/lib/auth/context"
import { recordSpecs } from "@/lib/workflow"
import { getApplications } from "@/lib/app-catalog"
import {
  ClipboardCheck,
  Home,
  LayoutGrid,
  Search,
  X,
} from "lucide-react"

export function ModuleDock({ role }: { role: OrganizationRole }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchDialogRef = useRef<HTMLDialogElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const apps = getApplications(role)
  const results = apps.filter((app) =>
    `${app.name} ${app.group} ${app.description}`
      .toLocaleLowerCase("id")
      .includes(query.trim().toLocaleLowerCase("id")),
  )
  const shortcuts = [
    { href: "/dashboard", label: "Beranda", icon: Home },
    { href: "/approvals", label: "Persetujuan", icon: ClipboardCheck },
    ...modules
      .filter(({ key }) => Object.values(recordSpecs).some((spec) => spec.module === key && spec.readers.includes(role)))
      .map(({ href, name, icon }) => ({ href, label: name, icon })),
  ]

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = searchDialogRef.current
    if (!dialog) return
    if (searchOpen && !dialog.open) dialog.showModal()
    if (!searchOpen && dialog.open) dialog.close()
  }, [searchOpen])

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen((value) => !value)
      }
    }
    window.addEventListener("keydown", shortcut)
    return () => window.removeEventListener("keydown", shortcut)
  }, [])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  return (
    <>
      <nav aria-label="Navigasi modul" className="module-dock hidden lg:flex">
        <button
          type="button"
          aria-label="Cari aplikasi"
          title="Cari aplikasi · Ctrl+K"
          className="module-dock-item module-dock-search"
          onClick={() => setSearchOpen(true)}
        >
          <Search size={19} strokeWidth={1.8} />
          <span className="module-dock-tooltip" role="tooltip">Cari aplikasi · Ctrl+K</span>
        </button>
        <span aria-hidden="true" className="module-dock-divider" />
        {shortcuts.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && href !== "/approvals" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              title={label}
              className={`module-dock-item${active ? " is-active" : ""}`}
            >
              <Icon size={20} strokeWidth={1.8} />
              <span className="module-dock-tooltip" role="tooltip">{label}</span>
              {active && <span className="module-dock-indicator" />}
            </Link>
          )
        })}
      </nav>

      <button
        type="button"
        className="module-dock-mobile lg:hidden"
        aria-label="Buka navigasi modul"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <LayoutGrid size={19} />
        <span>Modul</span>
      </button>

      <dialog
        ref={dialogRef}
        className="module-dock-dialog"
        aria-label="Navigasi modul"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false)
        }}
      >
        <div className="module-dock-dialog-head">
          <div>
            <p className="text-sm font-semibold text-ink">Navigasi ERP</p>
            <p className="mt-1 text-xs text-muted">Pilih halaman yang ingin dibuka</p>
          </div>
          <button type="button" aria-label="Tutup navigasi" className="rounded-full p-2 text-muted hover:bg-canvas" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="module-dock-mobile-grid">
          <button
            type="button"
            className="module-dock-mobile-link"
            onClick={() => {
              setOpen(false)
              setSearchOpen(true)
            }}
          >
            <span className="module-dock-mobile-icon"><Search size={19} /></span>
            <span>Cari aplikasi</span>
          </button>
          {shortcuts.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && href !== "/approvals" && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`module-dock-mobile-link${active ? " is-active" : ""}`}
                onClick={() => setOpen(false)}
              >
                <span className="module-dock-mobile-icon"><Icon size={19} /></span>
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      </dialog>

      <dialog
        ref={searchDialogRef}
        className="portal-search-dialog rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-900/30"
        aria-labelledby="module-app-search-title"
        onClick={(event) => {
          if (event.target === searchDialogRef.current) searchDialogRef.current?.close()
        }}
        onClose={() => {
          setSearchOpen(false)
          setQuery("")
        }}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 p-4">
          <Search size={20} className="text-slate-400" />
          <label id="module-app-search-title" htmlFor="module-app-search" className="sr-only">Cari aplikasi perusahaan</label>
          <input
            id="module-app-search"
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari aplikasi atau modul..."
            className="min-w-0 flex-1 text-sm outline-none"
          />
          <button type="button" aria-label="Tutup pencarian" onClick={() => searchDialogRef.current?.close()} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {results.length ? results.map((app) => (
            <Link
              key={app.href}
              href={app.href}
              onNavigate={() => searchDialogRef.current?.close()}
              className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-slate-50"
            >
              <span className="rounded-xl bg-slate-100 p-2 text-slate-600"><app.icon size={19} /></span>
              <span>
                <span className="block text-sm font-medium">{app.name}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{app.group} · {app.description}</span>
              </span>
            </Link>
          )) : (
            <p className="p-6 text-center text-sm text-slate-500">Tidak ada aplikasi yang sesuai dengan pencarian.</p>
          )}
        </div>
        <p className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">Hasil mengikuti hak akses Anda. Tekan Esc untuk menutup.</p>
      </dialog>
    </>
  )
}
