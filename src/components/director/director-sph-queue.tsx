import Link from "next/link"
import { formatCurrency } from "@/lib/money"
import { sphStatusLabels } from "@/lib/sales"
import { FileText, ExternalLink } from "lucide-react"

type PendingSph = {
  id: string
  sph_number: number
  branch_id: string
  branch_name?: string
  title: string
  work_scopes?: string[]
  amount: number | string | null
  status: string
  created_at: string
}

export function DirectorSphQueue({ sphList }: { sphList: PendingSph[] }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText size={20} className="text-brand" />
          <h3 className="font-semibold text-ink">
            Penawaran (SPH) Butuh Verifikasi Direktur ({sphList.length})
          </h3>
        </div>
        <Link
          href="/pengajuan/penjualan/sph"
          className="text-xs font-semibold text-brand hover:underline"
        >
          Buka daftar seluruh SPH &rarr;
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas text-muted">
              <tr>
                <th scope="col" className="p-3.5 font-semibold">No.</th>
                <th scope="col" className="p-3.5 font-semibold">Nomor SPH</th>
                <th scope="col" className="p-3.5 font-semibold">Cabang</th>
                <th scope="col" className="p-3.5 font-semibold">Judul / Pekerjaan</th>
                <th scope="col" className="p-3.5 font-semibold">Status</th>
                <th scope="col" className="p-3.5 text-right font-semibold">Nilai Penawaran</th>
                <th scope="col" className="p-3.5 text-right font-semibold">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sphList.length ? (
                sphList.map((sph, idx) => (
                  <tr key={sph.id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-medium text-muted">{idx + 1}</td>
                    <td className="p-3.5 font-semibold text-ink">
                      SPH {sph.sph_number}
                    </td>
                    <td className="p-3.5 font-medium">{sph.branch_name ?? "Cabang"}</td>
                    <td className="p-3.5 font-medium text-ink max-w-xs truncate">
                      {sph.title}
                    </td>
                    <td className="p-3.5">
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                        {sphStatusLabels[sph.status] ?? sph.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-bold text-ink">
                      {sph.amount != null ? formatCurrency(sph.amount) : "-"}
                    </td>
                    <td className="p-3.5 text-right">
                      <Link
                        href={`/pengajuan/penjualan/sph/${sph.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                      >
                        Verifikasi SPH <ExternalLink size={13} />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-sm text-muted">
                    Tidak ada dokumen SPH yang menunggu verifikasi Direktur saat ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
