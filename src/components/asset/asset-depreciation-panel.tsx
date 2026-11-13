import { Card } from "@/components/ui/card"
import { formatCurrency } from "@/lib/money"

export type AssetDepreciationRow = {
  id: string
  code: string
  name: string
  category: string
  acquired_on: string | null
  purchase_cost: number | string
  useful_life_months?: number | null
  residual_value?: number | string | null
  depreciation_method?: string | null
  status: string
}

function monthsElapsed(acquiredOn: string | null): number {
  if (!acquiredOn) return 0
  const start = new Date(`${acquiredOn}T00:00:00Z`)
  if (!Number.isFinite(start.getTime())) return 0
  const now = new Date()
  const months =
    (now.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - start.getUTCMonth())
  return Math.max(0, months)
}

export function AssetDepreciationPanel({ assets }: { assets: AssetDepreciationRow[] }) {
  const rows = assets.map((asset) => {
    const cost = Number(asset.purchase_cost ?? 0)
    const residual = Number(asset.residual_value ?? 0)
    const life = Math.max(1, Number(asset.useful_life_months ?? 48))
    const method = asset.depreciation_method ?? "straight_line"
    const monthly = method === "none" ? 0 : Math.max(0, (cost - residual) / life)
    const elapsed = Math.min(life, monthsElapsed(asset.acquired_on))
    const accumulated = monthly * elapsed
    const bookValue = Math.max(residual, cost - accumulated)
    return {
      ...asset,
      cost,
      monthly,
      accumulated,
      bookValue,
    }
  })

  const totalCost = rows.reduce((s, r) => s + r.cost, 0)
  const totalBook = rows.reduce((s, r) => s + r.bookValue, 0)

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Kalkulasi Penyusutan & Nilai Buku Aset</h2>
          <p className="text-sm text-muted">
            Estimasi penyusutan garis lurus bulanan berdasarkan tanggal perolehan dan masa manfaat aset.
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-xs text-muted">Total Nilai Buku Saat Ini</p>
          <p className="font-bold tabular-nums text-emerald-700">{formatCurrency(totalBook)}</p>
          <p className="text-xs text-muted">dari perolehan {formatCurrency(totalCost)}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Kode / Nama Aset</th>
              <th className="px-3 py-2">Tgl Perolehan</th>
              <th className="px-3 py-2 text-right">Nilai Perolehan</th>
              <th className="px-3 py-2 text-right">Beban / Bulan</th>
              <th className="px-3 py-2 text-right">Akumulasi Susut</th>
              <th className="px-3 py-2 text-right">Nilai Buku</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-xs text-muted">
                  Belum ada data aset untuk dihitung penyusutannya.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs">{r.code}</span> · {r.name}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.acquired_on ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.cost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.monthly)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                    {formatCurrency(r.accumulated)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-700">
                    {formatCurrency(r.bookValue)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
