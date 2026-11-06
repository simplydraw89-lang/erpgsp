import Link from "next/link"
import { formatCurrency } from "@/lib/money"
import { purchaseStatusLabels } from "@/lib/procurement-ui"
import { ClipboardCheck, ExternalLink } from "lucide-react"

type PendingPurchase = {
  id: string
  invoice_number: string
  invoice_date: string
  branch_id: string
  branch_name?: string
  vendor_id?: string
  vendor_name?: string
  status: string
  payable_amount: number | string
  created_at: string
}

export function DirectorPurchaseQueue({
  purchases,
}: {
  purchases: PendingPurchase[]
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={20} className="text-brand" />
          <h3 className="font-semibold text-ink">
            Pengajuan Pembelian Butuh Verifikasi Direktur ({purchases.length})
          </h3>
        </div>
        <Link
          href="/pengajuan/pembelian"
          className="text-xs font-semibold text-brand hover:underline"
        >
          Buka modul pembelian &rarr;
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas text-muted">
              <tr>
                <th scope="col" className="p-3.5 font-semibold">No.</th>
                <th scope="col" className="p-3.5 font-semibold">Nomor Invoice</th>
                <th scope="col" className="p-3.5 font-semibold">Cabang</th>
                <th scope="col" className="p-3.5 font-semibold">Vendor</th>
                <th scope="col" className="p-3.5 font-semibold">Status Saat Ini</th>
                <th scope="col" className="p-3.5 text-right font-semibold">Nominal Pembayaran</th>
                <th scope="col" className="p-3.5 text-right font-semibold">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {purchases.length ? (
                purchases.map((req, idx) => (
                  <tr key={req.id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-medium text-muted">{idx + 1}</td>
                    <td className="p-3.5 font-semibold text-ink">
                      {req.invoice_number}
                      <span className="block text-[11px] font-normal text-muted">
                        Tgl: {req.invoice_date}
                      </span>
                    </td>
                    <td className="p-3.5 font-medium">{req.branch_name ?? "Cabang"}</td>
                    <td className="p-3.5 text-muted">{req.vendor_name ?? "Vendor"}</td>
                    <td className="p-3.5">
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                        {purchaseStatusLabels[req.status] ?? req.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-bold text-ink">
                      {formatCurrency(req.payable_amount)}
                    </td>
                    <td className="p-3.5 text-right">
                      <Link
                        href={`/pengajuan/${req.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                      >
                        Verifikasi <ExternalLink size={13} />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-sm text-muted">
                    Tidak ada pengajuan pembelian yang menunggu verifikasi Direktur saat ini.
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
