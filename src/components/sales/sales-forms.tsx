import { formatCurrency } from "@/lib/money"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { Card } from "@/components/ui/card"
import { ClientForm } from "./client-form"
import { ClientDirectory } from "./client-directory"
import { sphStatusLabels, spkStatusLabels } from "@/lib/sales"
import type { SphRegisterRow } from "@/lib/sales"
import type { BusinessUnit, SalesDocument } from "@/lib/procurement-ui"
import { FolderCheck, ArrowRight } from "lucide-react"

export function SalesForms({
  view, branches, allBranches, documents, disabled,
  canRegisterClient, canReadClients, canCreateDocuments, draftId,
  register = [], offset = 0
}: {
  view: "klien" | "sph" | "spk"; branches: BusinessUnit[]; allBranches: BusinessUnit[]; documents: SalesDocument[]; disabled: boolean;
  canRegisterClient: boolean; canReadClients: boolean; canCreateDocuments: boolean; draftId: string
  register?: SphRegisterRow[]; offset?: number
}) {
  if (view === "klien") return <div className="space-y-6">
    {canRegisterClient ? <ClientForm disabled={disabled} /> : <Card className="p-5 text-sm text-muted">Pendaftaran klien hanya tersedia untuk pengguna internal yang terdaftar.</Card>}
    {canReadClients ? <ClientDirectory /> : <Card className="p-5 text-sm text-muted">Akses daftar klien dibatasi untuk role pemasaran yang berwenang. Pengguna internal tetap dapat mendaftarkan klien melalui formulir di atas.</Card>}
  </div>
  if (view === "sph") {
    const sphPriority = (status: string) => {
      switch (status) {
        case "director_review": return 1;
        case "branch_review": return 2;
        case "revision_requested": return 3;
        case "ready": return 4;
        case "draft": return 5;
        case "accepted": return 6;
        case "rejected": return 7;
        default: return 8;
      }
    };
    const sortedRegister = [...register].sort((a, b) => {
      const diff = sphPriority(a.status) - sphPriority(b.status);
      if (diff !== 0) return diff;
      return Number(b.sph_number ?? 0) - Number(a.sph_number ?? 0);
    });

    return <section aria-label="Daftar SPH" className="space-y-4">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Daftar SPH</h2>{canCreateDocuments && !disabled && <Link href="/pengajuan/penjualan/sph/baru" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Buat SPH</Link>}</div>
      <p className="text-sm text-muted">Daftar diurutkan berdasarkan prioritas: Pengajuan yang menunggu persetujuan Direktur & Verifikasi Manager Cabang selalu berada di posisi paling atas.</p>
      <Card className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><caption className="sr-only">Daftar SPH cabang</caption><thead className="bg-canvas"><tr>{["No.","Nomor SPH","Tanggal dibuat","Keterangan","Lingkup pekerjaan","Nilai SPH","Status","Tindakan / Buat SPK"].map(title => <th key={title} scope="col" className="p-3">{title}</th>)}</tr></thead>
        <tbody>{sortedRegister.map((row,index) => {
          const isUrgent = ["director_review", "branch_review", "revision_requested"].includes(row.status);
          return <tr key={row.id} className={`border-t border-line ${isUrgent ? "bg-amber-50/40" : ""}`}><td className="p-3">{offset+index+1}</td><td className="p-3 font-medium">{row.document_number || `SPH No. ${row.sph_number}`}<span className="mt-1 block text-xs text-muted">{row.branch_name}</span></td><td className="p-3">{new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeZone:"Asia/Bangkok"}).format(new Date(row.created_at))}</td><td className="max-w-64 p-3"><span className="line-clamp-2">{row.title}</span></td><td className="p-3">{row.work_scopes.join(", ") || "-"}</td><td className="whitespace-nowrap p-3">{row.amount === null ? "-" : formatCurrency(row.amount)}</td><td className="p-3">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              row.status === "director_review"
                ? "bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                : row.status === "branch_review"
                ? "bg-blue-100 text-blue-900 border border-blue-200"
                : row.status === "revision_requested"
                ? "bg-orange-100 text-orange-900 border border-orange-200"
                : row.status === "ready"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-700"
            }`}>
              {isUrgent ? "⚡ " : ""}
              {sphStatusLabels[row.status] ?? row.status}
            </span>
          </td><td className="space-y-2 p-3">{row.can_open && <Link href={`/pengajuan/penjualan/sph/${row.id}`} className="block font-medium text-brand hover:underline">{row.status === "draft" || row.status === "revision_requested" ? "Buka draft / revisi →" : isUrgent ? "Periksa & Setujui →" : "Buka SPH →"}</Link>}{row.can_create_spk && !disabled ? <Link href={`/pengajuan/penjualan/spk/baru?sph=${row.id}`} className="block font-semibold text-brand">Buat SPK →</Link> : !row.can_open ? <span className="text-xs text-muted">Ringkasan saja</span> : null}</td></tr>;
        })}</tbody>
      </table>{!sortedRegister.length && <p className="p-6 text-center text-sm text-muted">Belum ada SPH dalam cakupan cabang ini.</p>}</Card>
    </section>;
  }
  const rows = documents.filter(document => document.kind === "spk")
  const spkPriority = (status: string) => {
    switch (status) {
      case "director_review": return 1; // Prioritas Tertinggi: Butuh Persetujuan Direktur Utama
      case "revision_requested": return 2; // Butuh Perbaikan
      case "draft": return 3; // Masih Draft
      case "ready": return 4; // Sudah Disetujui & Proyek Aktif
      case "rejected": return 5; // Ditolak
      default: return 6;
    }
  }
  const sortedSpk = [...rows].sort((a, b) => {
    const diff = spkPriority(a.status) - spkPriority(b.status);
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return <div className="space-y-6">
    <section aria-label={`Daftar ${view.toUpperCase()}`} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Daftar {view.toUpperCase()}</h2>
          <p className="text-xs text-muted">Surat Perintah Kerja resmi. Pengajuan yang menunggu persetujuan Direktur Utama berada di posisi paling atas.</p>
        </div>
        {canCreateDocuments && !disabled && (
          <Link href="/pengajuan/penjualan/spk/baru" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
            + Buat SPK
          </Link>
        )}
      </div>

      {sortedSpk.map((document, index) => {
        const isUrgent = document.status === "director_review" || document.status === "revision_requested";
        return (
          <Card key={document.id} className={`space-y-3 p-5 transition-colors ${
            document.status === "director_review"
              ? "border-2 border-amber-300 bg-amber-50/20 shadow-sm"
              : document.status === "revision_requested"
              ? "border-2 border-orange-200 bg-orange-50/20"
              : ""
          }`}>
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
                  ? "bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                  : document.status === "draft"
                  ? "bg-blue-100 text-blue-800"
                  : document.status === "revision_requested"
                  ? "bg-orange-100 text-orange-900 border border-orange-200"
                  : "bg-slate-100 text-slate-700"
              }`}>
                {isUrgent ? "⚡ " : ""}
                {spkStatusLabels[document.status] ?? sphStatusLabels[document.status] ?? document.status}
              </span>
            </div>

            <h3 className="text-base font-bold text-ink">{document.title}</h3>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
              <p>{document.client_snapshot?.name ?? "Klien terdaftar"}</p>
              {document.amount ? (
                <span className="font-semibold text-brand">
                  {formatCurrency(document.amount)}
                </span>
              ) : null}
            </div>

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
                {!document.attachment_ids?.length && (
                  <span className="text-xs text-muted">Tidak ada berkas lampiran</span>
                )}
              </div>

              <Link href={`/pengajuan/penjualan/spk/${document.id}`} className="font-semibold text-brand text-sm hover:underline">
                {document.status === "director_review" ? "Periksa & Setujui SPK →" : "Buka Detail / Periksa SPK →"}
              </Link>
            </div>
          </Card>
        );
      })}

      {!sortedSpk.length && <Card className="p-6 text-center text-sm text-muted">Belum ada {view.toUpperCase()} dalam cakupan akses Anda.</Card>}
    </section>
  </div>
}
