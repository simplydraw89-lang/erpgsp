import { formatCurrency } from "@/lib/money"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { Card } from "@/components/ui/card"
import { ClientForm } from "./client-form"
import { ClientDirectory } from "./client-directory"
import { sphStatusLabels } from "@/lib/sales"
import type { SphRegisterRow } from "@/lib/sales"
import type { BusinessUnit, SalesDocument } from "@/lib/procurement-ui"
import { FolderCheck, ArrowRight } from "lucide-react"

export function SalesForms({ view, documents, disabled, canCreateDocuments, register = [], offset = 0, canRegisterClient, canReadClients }: {
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
      <tbody>{register.map((row,index) => <tr key={row.id} className="border-t border-line"><td className="p-3">{offset+index+1}</td><td className="p-3 font-medium">{row.document_number || `SPH No. ${row.sph_number}`}<span className="mt-1 block text-xs text-muted">{row.branch_name}</span></td><td className="p-3">{new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeZone:"Asia/Bangkok"}).format(new Date(row.created_at))}</td><td className="max-w-64 p-3"><span className="line-clamp-2">{row.title}</span></td><td className="p-3">{row.work_scopes.join(", ") || "—"}</td><td className="whitespace-nowrap p-3">{row.amount === null ? "—" : formatCurrency(row.amount)}</td><td className="p-3">{sphStatusLabels[row.status] ?? row.status}</td><td className="space-y-2 p-3">{row.can_open && <Link href={`/pengajuan/penjualan/sph/${row.id}`} target="_blank" rel="noopener noreferrer" className="block font-medium text-brand">{row.status === "draft" || row.status === "revision_requested" ? "Buka draft / revisi" : "Buka SPH"}</Link>}{row.can_create_spk && !disabled ? <Link href={`/pengajuan/penjualan/spk/baru?sph=${row.id}`} className="block font-semibold text-brand">Buat SPK →</Link> : !row.can_open ? <span className="text-xs text-muted">Ringkasan saja</span> : null}</td></tr>)}</tbody>
    </table>{!register.length && <p className="p-6 text-center text-sm text-muted">Belum ada SPH dalam cakupan cabang ini.</p>}</Card>
  </section>
  const rows = documents.filter(document => document.kind === "spk")
  return <div className="space-y-6">
    <section aria-label={`Daftar ${view.toUpperCase()}`} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Daftar {view.toUpperCase()}</h2>
          <p className="text-xs text-muted">Surat Perintah Kerja resmi berdasarkan SPH yang disetujui internal.</p>
        </div>
        {canCreateDocuments && !disabled && (
          <Link href="/pengajuan/penjualan/spk/baru" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
            + Buat SPK
          </Link>
        )}
      </div>

      {rows.map((document, index) => (
        <Card key={document.id} className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-muted">
                No. {index + 1}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-brand">
                {document.document_number || "SPK"}
              </span>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              document.status === "ready"
                ? "bg-emerald-100 text-emerald-800"
                : document.status === "director_review"
                ? "bg-amber-100 text-amber-800"
                : document.status === "draft"
                ? "bg-blue-100 text-blue-800"
                : document.status === "revision_requested"
                ? "bg-orange-100 text-orange-800"
                : "bg-slate-100 text-slate-700"
            }`}>
              {document.status === "director_review"
                ? "Menunggu Persetujuan Direktur"
                : document.status === "draft"
                ? "Draft SPK"
                : sphStatusLabels[document.status] ?? document.status}
            </span>
          </div>

          <h3 className="text-base font-bold text-ink">{document.title}</h3>
          <p className="text-sm text-muted">{document.client_snapshot?.name ?? "Klien terdaftar"}</p>

          <p className="text-xs text-muted">
            SPH Rujukan: {documents.find(item => item.id === document.accepted_sph_id)?.sph_number ? `SPH No. ${documents.find(item => item.id === document.accepted_sph_id)?.sph_number}` : "Lihat SPH"} · Diterbitkan oleh {document.source === "client" ? "Klien" : "Perusahaan"}
          </p>

          {document.notes && (
            <p className="whitespace-pre-wrap rounded-lg bg-canvas p-2.5 text-xs text-muted border border-line">
              {document.notes}
            </p>
          )}

          {document.project_id && (
            <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-900">
              <span className="flex items-center gap-1.5 font-medium">
                <FolderCheck size={16} className="text-emerald-700" /> Proyek resmi telah aktif dibuat otomatis
              </span>
              <Link href={`/portal-proyek?project=${document.project_id}`} className="flex items-center gap-1 font-semibold text-emerald-800 hover:underline">
                Portal Proyek <ArrowRight size={13} />
              </Link>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <div className="flex flex-wrap gap-2 text-xs text-brand">
              {(document.attachment_ids ?? []).map((id, attIdx) => (
                <a key={id} href={`/api/invoice-documents/${id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  Lampiran {attIdx + 1}
                </a>
              ))}
            </div>
            <Link href={`/pengajuan/penjualan/spk/${document.id}`} className="font-semibold text-brand text-sm hover:underline">
              Buka Detail / Periksa SPK →
            </Link>
          </div>
        </Card>
      ))}

      {!rows.length && <Card className="p-6 text-center text-sm text-muted">Belum ada {view.toUpperCase()} dalam cakupan akses Anda.</Card>}
    </section>
  </div>
}
