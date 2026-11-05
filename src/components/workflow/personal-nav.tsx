import Link from "next/link"

export function PersonalNav({ active }: { active: "work" | "mine" | "review" }) {
  return <nav aria-label="Pekerjaan saya" className="flex flex-wrap gap-2 border-b border-line pb-4">{[
    { key:"work", name:"Pekerjaan saya", href:"/pekerjaan-saya" },
    { key:"mine", name:"Pengajuan saya", href:"/pekerjaan-saya/pengajuan" },
    { key:"review", name:"Persetujuan", href:"/approvals?scope=review" },
  ].map(item => <Link key={item.key} href={item.href} aria-current={active===item.key?"page":undefined} className={`rounded-lg px-4 py-2 text-sm font-medium ${active===item.key?"bg-brand text-white":"bg-white text-muted hover:bg-canvas"}`}>{item.name}</Link>)}</nav>
}
