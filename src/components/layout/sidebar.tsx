"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  ArrowUpRight,
  ClipboardCheck,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react"
import { modules } from "@/lib/modules"
import { cn } from "@/lib/utils"

const primaryLinks = [
  { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/approvals", label: "Persetujuan", icon: ClipboardCheck },
  { href: "/audit", label: "Jejak audit", icon: ShieldCheck },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[252px] border-r border-line bg-white lg:flex lg:flex-col">
      <Link href="/dashboard" className="flex h-[76px] items-center gap-3 border-b border-line px-6">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-white">
          <Activity size={21} />
        </span>
        <span>
          <span className="block text-sm font-bold tracking-tight text-ink">GSP Group</span>
          <span className="block text-xs text-muted">Enterprise workspace</span>
        </span>
      </Link>
      <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-6">
        <div>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            Workspace
          </p>
          <div className="space-y-1">
            {primaryLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-canvas hover:text-ink",
                  pathname === href && "bg-brand-light text-brand-dark",
                )}
              >
                <Icon size={17} strokeWidth={1.8} />
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            Modul perusahaan
          </p>
          <div className="space-y-1">
            {modules.map(({ href, name, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-canvas hover:text-ink",
                  pathname === href && "bg-brand-light text-brand-dark",
                )}
              >
                <Icon size={17} strokeWidth={1.8} />
                {name}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      <div className="border-t border-line p-4">
        <div className="flex items-center justify-between rounded-lg bg-canvas p-3">
          <div>
            <p className="text-xs font-semibold text-ink">Check & balance</p>
            <p className="mt-1 text-[11px] text-muted">Akses tercatat dan terbatas</p>
          </div>
          <ArrowUpRight size={16} className="text-brand" />
        </div>
      </div>
    </aside>
  )
}
