"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClipboardCheck, LayoutDashboard, ShieldCheck } from "lucide-react"
import { modules } from "@/lib/modules"
import { cn } from "@/lib/utils"

const links = [
  { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/approvals", label: "Persetujuan", icon: ClipboardCheck },
  { href: "/audit", label: "Audit", icon: ShieldCheck },
  ...modules.map(({ href, name, icon }) => ({ href, label: name, icon })),
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Navigasi workspace" className="flex gap-2 overflow-x-auto border-b border-line bg-white px-4 py-2 lg:hidden">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted",
            pathname === href && "bg-brand-light text-brand-dark",
          )}
        >
          <Icon size={15} />
          {label}
        </Link>
      ))}
    </nav>
  )
}
