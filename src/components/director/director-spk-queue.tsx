import Link from "next/link"
import { formatCurrency } from "@/lib/money"
import { FileCheck2, ExternalLink } from "lucide-react"

type PendingSpk = {
  id: string
  title: string
  branch_id: string
  branch_name?: string
  client_name?: string
  status: string
  notes?: string
  created_at: string
}

export function DirectorSpkQueue({ spkList }: { spkList: PendingSpk[] }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCheck2 size={20} className="text-brand" />
          <h3 className="font-semibold text-ink">
            Perintah Kerja (SPK) Butuh Verifikasi Direktur ({spkList.length})
          </h3>
        </div>
        <Link
          href="/pengajuan/penjualan/spk"
          className="text-xs font-semibold text-brand hover:underline"
        >
          Buka daftar seluruh SPK &rarr;
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas text-muted">
              <tr>
                <th scope="col" className="p-3.5 font-semibold">No.</th>
                <th scope="col" className="p-3.5 font-semibold">Judul SPK</th>
                <th scope="col" className="p-3.5 font-semibold">Cabang</th>
                <th scope="col" className="p-3.5 font-semibold">Klien / Mitra</th>
                <th scope="col" className="p-3.5 font-semibold">Status</th>
                <th scope="col" className="p-3.5 font-semibold">Tanggal Diajukan</th>
                <th scope="col" className="p-3.5 text-right font-semibold">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {spkList.length ? (
                spkList.map((spk, idx) => (
                  <tr key={spk.id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-medium text-muted">{idx + 1}</td>
                    <td className="p-3.5 font-semibold text-ink max-w-xs truncate">
                      {spk.title}
                    </td>
                    <td className="p-3.5 font-medium">{spk.branch_name ?? "Cabang"}</td>
                    <td className="p-3.5 text-muted">{spk.client_name ?? "Klien"}</td>
                    <td className="p-3.5">
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                        {spk.status === "draft" ? "Menunggu Penerbitan SPK" : spk.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-muted">
                      {new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",
                        timeZone: "Asia/Bangkok",
                      }).format(new Date(spk.created_at))}
                    </td>
                    <td className="p-3.5 text-right">
                      <Link
                        href={`/pengajuan/penjualan/spk`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                      >
                        Periksa SPK <ExternalLink size={13} />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-sm text-muted">
                    Tidak ada dokumen SPK yang menunggu verifikasi Direktur saat ini.
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
