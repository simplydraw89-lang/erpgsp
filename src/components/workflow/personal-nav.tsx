import Link from "next/link"

export function PersonalNav({
  active,
  isDirector = false,
}: {
  active: "work" | "mine" | "review" | "executive"
  isDirector?: boolean
}) {
  const items = [
    { key: "work", name: "Pekerjaan saya", href: "/pekerjaan-saya" },
    ...(isDirector
      ? [{ key: "executive", name: "Executive Dashboard", href: "/pekerjaan-saya?tab=executive" }]
      : []),
    { key: "mine", name: "Pengajuan saya", href: "/pekerjaan-saya/pengajuan" },
    { key: "review", name: "Persetujuan", href: "/approvals?scope=review" },
  ]

  return (
    <nav aria-label="Pekerjaan saya" className="flex flex-wrap gap-2 border-b border-line pb-4">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={active === item.key ? "page" : undefined}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            active === item.key
              ? "bg-brand text-white shadow-sm"
              : "bg-white text-muted hover:bg-canvas hover:text-ink"
          }`}
        >
          {item.name}
        </Link>
      ))}
    </nav>
  )
}
