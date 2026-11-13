"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { formatCurrency } from "@/lib/money"
import {
  buildFinancialStatements,
  type CoaMetaRow,
  type ReportLine,
  type TrialBalanceRow,
} from "@/lib/accounting/financial-reports"

type EntityOption = { id: string; entity_code: string; legal_name: string }
type PeriodOption = { id: string; entity_id: string; period_code: string }

function LineTable({
  title,
  lines,
  totalLabel,
  totalAmount,
}: {
  title: string
  lines: ReportLine[]
  totalLabel: string
  totalAmount: number
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Kode</th>
              <th className="px-3 py-2">Nama Akun</th>
              <th className="px-3 py-2 text-right">Saldo (IDR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-3 text-center text-xs text-muted">
                  Belum ada mutasi akun pada kelompok ini.
                </td>
              </tr>
            ) : (
              lines.map((line) => (
                <tr key={line.accountCode}>
                  <td className="px-3 py-2 font-mono text-xs">{line.accountCode}</td>
                  <td className="px-3 py-2">{line.accountName}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {formatCurrency(line.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold">
            <tr>
              <td colSpan={2} className="px-3 py-2">
                {totalLabel}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatCurrency(totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export function FinancialReportsView({
  entities,
  periods,
  accounts,
  trialBalance,
}: {
  entities: EntityOption[]
  periods: PeriodOption[]
  accounts: CoaMetaRow[]
  trialBalance: TrialBalanceRow[]
}) {
  const [selectedEntity, setSelectedEntity] = useState<string>("")
  const [selectedPeriod, setSelectedPeriod] = useState<string>("")
  const [activeTab, setActiveTab] = useState<"pnl" | "balance">("pnl")

  const filteredPeriods = useMemo(
    () =>
      selectedEntity
        ? periods.filter((period) => period.entity_id === selectedEntity)
        : periods,
    [periods, selectedEntity],
  )

  const summary = useMemo(
    () =>
      buildFinancialStatements(trialBalance, accounts, {
        entityId: selectedEntity || null,
        periodId: selectedPeriod || null,
      }),
    [trialBalance, accounts, selectedEntity, selectedPeriod],
  )

  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Laporan Keuangan (Laba Rugi & Neraca)</h2>
          <p className="text-sm text-muted">
            Dihitung langsung dari buku besar yang telah diposting, mendukung konsolidasi maupun per cabang.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedEntity}
            onChange={(e) => {
              setSelectedEntity(e.target.value)
              setSelectedPeriod("")
            }}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
            aria-label="Filter entitas laporan"
          >
            <option value="">Konsolidasi Semua Entitas</option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.entity_code} · {entity.legal_name}
              </option>
            ))}
          </select>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
            aria-label="Filter periode laporan"
          >
            <option value="">Semua Periode</option>
            {filteredPeriods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.period_code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("pnl")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            activeTab === "pnl"
              ? "bg-brand text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Laporan Laba Rugi
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("balance")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            activeTab === "balance"
              ? "bg-brand text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Neraca (Posisi Keuangan)
        </button>
      </div>

      {activeTab === "pnl" ? (
        <div className="space-y-5">
          <LineTable
            title="Pendapatan Usaha"
            lines={summary.incomeStatement.revenues}
            totalLabel="Total Pendapatan"
            totalAmount={summary.incomeStatement.totalRevenue}
          />
          <LineTable
            title="Beban & Pengeluaran"
            lines={summary.incomeStatement.expenses}
            totalLabel="Total Beban"
            totalAmount={summary.incomeStatement.totalExpense}
          />
          <div className="flex items-center justify-between rounded-lg border border-border bg-slate-50 px-4 py-3">
            <span className="font-semibold">Laba / (Rugi) Bersih</span>
            <span
              className={`text-lg font-bold tabular-nums ${
                summary.incomeStatement.netIncome >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {formatCurrency(summary.incomeStatement.netIncome)}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <LineTable
            title="Aset"
            lines={summary.balanceSheet.assets}
            totalLabel="Total Aset"
            totalAmount={summary.balanceSheet.totalAssets}
          />
          <LineTable
            title="Liabilitas (Kewajiban)"
            lines={summary.balanceSheet.liabilities}
            totalLabel="Total Liabilitas"
            totalAmount={summary.balanceSheet.totalLiabilities}
          />
          <LineTable
            title="Ekuitas"
            lines={summary.balanceSheet.equities}
            totalLabel="Total Ekuitas Awal / Modal"
            totalAmount={summary.balanceSheet.totalEquityBase}
          />
          <div className="grid gap-3 rounded-lg border border-border bg-slate-50 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted">Laba / (Rugi) Berjalan</p>
              <p className="mt-1 font-semibold tabular-nums">
                {formatCurrency(summary.balanceSheet.currentEarnings)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Total Liabilitas + Ekuitas</p>
              <p className="mt-1 font-semibold tabular-nums">
                {formatCurrency(summary.balanceSheet.totalLiabilitiesAndEquity)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Status Keseimbangan Neraca</p>
              <p
                className={`mt-1 font-semibold ${
                  summary.balanceSheet.isBalanced ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {summary.balanceSheet.isBalanced ? "Seimbang (Balanced)" : "Selisih Pembulatan / Belum Seimbang"}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
