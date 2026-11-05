import Link from "next/link"
import { Card } from "@/components/ui/card"
import { PersonalNav } from "@/components/workflow/personal-nav"
import { requireWorkspace } from "@/lib/auth/context"
import { loadMySubmissions } from "@/lib/my-submissions"
import { labels } from "@/lib/workflow"
import { purchaseStatusLabels } from "@/lib/procurement-ui"
import { sphStatusLabels } from "@/lib/sales"

export default async function MySubmissionsPage() {
  const { supabase, organizationId, user } = await requireWorkspace()
  const rows = await loadMySubmissions(supabase, organizationId, user.id)
  const statuses: Record<string,string> = { ...labels, ...purchaseStatusLabels, pending:"Menunggu verifikasi", approved:"Disetujui", rejected:"Ditolak / perlu revisi", accepted:"Disetujui kedua pihak", registered:"Terdaftar" }
  const statusLabel = (row: typeof rows[number]) => row.kind === "SPH" ? sphStatusLabels[row.status] ?? row.status : statuses[row.status] ?? row.status
  return <div className="space-y-6">
    <header><p className="text-sm font-medium text-brand">Pekerjaan saya</p><h1 className="mt-2 text-3xl font-bold">Pengajuan saya</h1><p className="mt-2 text-sm leading-6 text-muted">Dokumen dan pengajuan yang Anda buat sendiri. Permintaan yang perlu Anda verifikasi tersedia di antrean Persetujuan.</p></header>
    <PersonalNav active="mine" />
    <Card className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><caption className="p-4 text-left text-xs text-muted">50 data terbaru per jenis, sesuai hak akses akun. Super Admin juga hanya melihat buatannya sendiri di halaman ini.</caption><thead className="bg-canvas"><tr>{["Dibuat","Jenis","Dokumen / pengajuan","Status",""].map(t=><th key={t} className="p-3">{t}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={`${row.source}-${row.id}`} className="border-t border-line"><td className="p-3">{new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeZone:"Asia/Bangkok"}).format(new Date(row.createdAt))}</td><td className="p-3">{row.kind}</td><td className="p-3 font-medium">{row.title}</td><td className="p-3">{statusLabel(row)}</td><td className="p-3"><Link href={row.href} className="font-medium text-brand">Buka</Link></td></tr>)}</tbody></table>{!rows.length && <p className="p-8 text-center text-sm text-muted">Belum ada dokumen atau pengajuan yang Anda buat dalam cakupan akses saat ini.</p>}</Card>
  </div>
}
