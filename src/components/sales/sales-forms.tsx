import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { Card } from "@/components/ui/card"
import { ClientForm } from "./client-form"
import { ClientDirectory } from "./client-directory"
import { sphStatusLabels } from "@/lib/sales"
import type { SphRegisterRow } from "@/lib/sales"
import type { BusinessUnit, SalesDocument } from "@/lib/procurement-ui"

export function SalesForms({ view, documents, disabled, canRegisterClient, canReadClients, canCreateDocuments, register = [], offset = 0 }: {
  view: "klien" | "sph" | "spk"; branches: BusinessUnit[]; allBranches: BusinessUnit[]; documents: SalesDocument[]; disabled: boolean;
  canRegisterClient: boolean; canReadClients: boolean; canCreateDocuments: boolean; draftId: string
  register?: SphRegisterRow[]; offset?: number
}) {
  if (view === "klien") return <div className="space-y-6">
    {canRegisterClient ? <ClientForm disabled={disabled} /> : <Card className="p-5 text-sm text-muted">Pendaftaran klien hanya tersedia untuk pengguna internal yang terdaftar.</Card>}
    {canReadClients ? <ClientDirectory /> : <Card className="p-5 text-sm text-muted">Akses daftar klien dibatasi untuk role pemasaran yang berwenang. Pengguna internal tetap dapat mendaftarkan klien melalui formulir di atas.</Card>}
  </div>
  if (view === "sph") return <section aria-label="Daftar SPH" className="space-y-4">
    <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Daftar SPH</h2>{canCreateDocuments && !disabled && <Link href="/pengajuan/penjualan/sph/baru" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Buat SPH</Link>}</div>
    <p className="text-sm text-muted">Ringkasan SPH seluruh pengaju dalam cakupan cabang Anda. Detail dan tindakan mengikuti kewenangan.</p>
    <Card className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><caption className="sr-only">Daftar SPH cabang</caption><thead className="bg-canvas"><tr>{["No.","Nomor SPH","Tanggal dibuat","Keterangan","Lingkup pekerjaan","Nilai SPH","Status","Tindakan / Buat SPK"].map(title => <th key={title} scope="col" className="p-3">{title}</th>)}</tr></thead>
      <tbody>{register.map((row,index) => <tr key={row.id} className="border-t border-line"><td className="p-3">{offset+index+1}</td><td className="p-3 font-medium">SPH {row.sph_number}<span className="mt-1 block text-xs text-muted">{row.branch_name}</span></td><td className="p-3">{new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeZone:"Asia/Bangkok"}).format(new Date(row.created_at))}</td><td className="max-w-64 p-3"><span className="line-clamp-2">{row.title}</span></td><td className="p-3">{row.work_scopes.join(", ") || "—"}</td><td className="whitespace-nowrap p-3">{row.amount === null ? "—" : new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR"}).format(Number(row.amount))}</td><td className="p-3">{sphStatusLabels[row.status] ?? row.status}</td><td className="space-y-2 p-3">{row.can_open && <Link href={`/pengajuan/penjualan/sph/${row.id}`} className="block font-medium text-brand">{row.status === "draft" || row.status === "revision_requested" ? "Buka draft / revisi" : "Buka SPH"}</Link>}{row.can_create_spk && !disabled ? <Link href={`/pengajuan/penjualan/spk/baru?sph=${row.id}`} className="block font-semibold text-brand">Buat SPK →</Link> : !row.can_open ? <span className="text-xs text-muted">Ringkasan saja</span> : null}</td></tr>)}</tbody>
    </table>{!register.length && <p className="p-6 text-center text-sm text-muted">Belum ada SPH dalam cakupan cabang ini.</p>}</Card>
  </section>
  const rows = documents.filter(document => document.kind === "spk")
  return <div className="space-y-6">
    <section aria-label={`Daftar ${view.toUpperCase()}`} className="space-y-4"><h2 className="text-lg font-semibold">Daftar {view.toUpperCase()}</h2>
      {rows.map(document => <Card key={document.id} className="space-y-3 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-brand">SPK</p>
        <h3 className="font-semibold">{document.title}</h3>
        <p className="text-sm text-muted">{document.client_snapshot?.name ?? "Klien terdaftar"}</p>
        <p className="text-sm font-medium text-muted">{sphStatusLabels[document.status] ?? document.status}</p>
        <>
          <p className="text-sm text-muted">SPH rujukan: {documents.find(item => item.id === document.accepted_sph_id)?.sph_number ?? "Lihat daftar SPH"} · {document.source === "client" ? "Dokumen klien" : "Dokumen perusahaan"}</p>
          <p className="whitespace-pre-wrap text-sm">{document.notes}</p>
          {(document.attachment_ids ?? []).map((id, index) => <a key={id} href={`/api/invoice-documents/${id}`} target="_blank" rel="noopener noreferrer" className="block text-sm text-brand">Buka dokumen {index + 1}</a>)}
        </>
      </Card>)}
      {!rows.length && <Card className="p-6 text-center text-sm text-muted">Belum ada {view.toUpperCase()} dalam cakupan akses Anda.</Card>}
    </section>
  </div>
}
