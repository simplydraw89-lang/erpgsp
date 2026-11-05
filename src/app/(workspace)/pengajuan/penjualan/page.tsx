import { SalesMenu } from "@/components/sales/sales-menu"
import { requireWorkspace } from "@/lib/auth/context"
import { ProcurementMessage } from "@/components/procurement/section-nav"

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  await requireWorkspace()
  const query = await searchParams
  return <div className="space-y-6">
    <header><p className="text-sm font-medium text-brand">Pengajuan</p><h1 className="mt-2 text-3xl font-bold">Penjualan</h1><p className="mt-2 text-sm leading-6 text-muted">Klien → SPH → persetujuan kedua pihak → SPK → proyek. Pilih bagian yang ingin dikelola.</p></header>
    <ProcurementMessage {...query} />
    <SalesMenu autoOpen />
  </div>
}
