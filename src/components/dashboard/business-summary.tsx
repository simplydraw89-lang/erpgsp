import { formatCurrency as money } from "@/lib/money"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { Card } from "@/components/ui/card"
import type { loadBusinessSummary } from "@/lib/business-summary"


export function BusinessSummary({ summary, queueOnly = false }: {
  summary: Awaited<ReturnType<typeof loadBusinessSummary>>
  queueOnly?: boolean
}) {
  return <section aria-label={queueOnly ? "Verifikasi dan pelaksanaan saya" : "Pengajuan bisnis dan laporan cabang"} className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold">{queueOnly ? "Verifikasi dan pelaksanaan saya" : "Pengajuan bisnis"}</h2><p className="mt-1 text-xs text-muted">{queueOnly ? "Permintaan yang perlu Anda periksa atau jalankan sesuai kewenangan." : "Pemeriksaan Anda dan ringkasan pembelian sesuai cakupan akses."}</p></div>
      {!queueOnly && <Link href="/pengajuan/pembelian" className="text-sm font-semibold text-brand">Buka pembelian →</Link>}
    </div>
    <div className={`grid gap-4 ${queueOnly ? "" : "lg:grid-cols-2"}`}>
      <Card className="p-5">
        <h3 className="font-semibold">Butuh verifikasi saya</h3>
        {summary.queueError ? <p role="status" className="mt-3 text-sm text-amber-800">Antrean bisnis belum tersedia. Periksa penerapan database di Pengajuan.</p>
          : summary.queue.length ? <ul className="mt-3 divide-y divide-line">{summary.queue.map(item => <li key={`${item.kind}-${item.id}`}>
            <Link href={item.kind === "sph" ? `/pengajuan/penjualan/sph/${item.id}` : item.kind === "purchase" ? "/pengajuan/pembelian" : "/vendor"} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 py-3 text-sm">
              <span><span className="block font-medium">{item.title}</span><span className="mt-1 block text-xs text-muted">{item.kind === "sph" ? "Pemeriksaan SPH" : item.kind === "vendor" ? "Validasi vendor" : "Pemeriksaan pembelian"}</span></span>
              <span className="shrink-0 text-brand">Periksa →</span>
            </Link>
          </li>)}</ul> : <p className="mt-3 text-sm text-muted">Tidak ada pengajuan bisnis yang menunggu tindakan Anda.</p>}
        {summary.notificationsError ? <p role="alert" className="mt-4 text-sm text-amber-800">Notifikasi tindak lanjut SPH gagal dimuat.</p> : Boolean(summary.notifications?.items.some(item=>item.category === "follow_up")) && <div className="mt-5 border-t border-line pt-4"><h3 className="font-semibold">SPH perlu tindak lanjut</h3><ul className="mt-2 divide-y divide-line">{summary.notifications!.items.filter(item=>item.category === "follow_up").map(item=><li key={item.id} className="py-3"><Link href={`/pengajuan/penjualan/sph/${item.id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand">SPH {item.sph_number} · {item.status === "rejected" ? "Ditolak" : item.status === "revision_requested" ? "Perlu revisi" : "Disetujui Direktur Keuangan"}</Link>{item.review_note && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{item.review_note}</p>}</li>)}</ul></div>}
      </Card>
      {!queueOnly && <Card className="overflow-hidden">
        <div className="p-5"><h3 className="font-semibold">Pembelian per cabang</h3><p className="mt-1 text-xs text-muted">Utang dan pembayaran dari pengajuan yang telah melalui pemeriksaan akuntansi.</p></div>
        {summary.reportError ? <p role="status" className="px-5 pb-5 text-sm text-amber-800">Ringkasan belum tersedia. Tidak ada saldo yang diasumsikan nol.</p>
          : summary.branches.length ? <div className="overflow-x-auto"><table className="w-full text-left text-xs">
            <caption className="sr-only">Ringkasan utang dan pembayaran cabang yang boleh diakses</caption>
            <thead className="bg-canvas"><tr><th scope="col" className="p-3">Cabang</th><th scope="col" className="p-3 text-right">Belum dibayar</th><th scope="col" className="p-3 text-right">Dibayar</th></tr></thead>
            <tbody>{summary.branches.map(branch => <tr key={branch.branch_id} className="border-t border-line"><th scope="row" className="p-3 font-medium">{branch.branch_name}</th><td className="p-3 text-right">{money(branch.unpaid_amount)}</td><td className="p-3 text-right">{money(branch.paid_amount)}</td></tr>)}</tbody>
          </table></div> : <p className="px-5 pb-5 text-sm text-muted">Belum ada laporan pembelian dalam cakupan akses Anda.</p>}
      </Card>}
    </div>
  </section>
}
