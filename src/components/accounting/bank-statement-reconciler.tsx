import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MoneyInput } from "@/components/ui/money-input"
import { formatCurrency } from "@/lib/money"
import {
  addBankStatementLine,
  matchBankStatementLine,
} from "@/app/(workspace)/modul/accounting-actions"

export type BankStatementLineRow = {
  id: string
  entity_id: string
  account_id: string
  statement_date: string
  reference_no: string | null
  description: string
  debit: number | string
  credit: number | string
  match_status: string
  matched_journal_id: string | null
}

type EntityRef = { id: string; entity_code: string; legal_name: string }
type AccountRef = { id: string; code: string; name: string; account_type: string; is_active: boolean; is_postable: boolean }
type JournalRef = { id: string; journal_number: string; journal_date: string; description: string; status: string }

export function BankStatementReconciler({
  entities,
  accounts,
  journals,
  lines,
  canEdit,
}: {
  entities: EntityRef[]
  accounts: AccountRef[]
  journals: JournalRef[]
  lines: BankStatementLineRow[]
  canEdit: boolean
}) {
  const bankAccounts = accounts.filter(
    (acc) => acc.is_active && acc.is_postable && acc.account_type === "asset" && acc.code.startsWith("1"),
  )
  const postedJournals = journals.filter((j) => j.status === "posted")
  const accountMap = new Map(accounts.map((a) => [a.id, a]))
  const journalMap = new Map(journals.map((j) => [j.id, j]))

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">Rekonsiliasi Mutasi Bank (Per Baris)</h2>
        <p className="text-sm text-muted">
          Catat baris mutasi rekening koran dan cocokkan satu per satu dengan jurnal yang sudah diposting.
        </p>
      </div>

      {canEdit && (
        <form action={addBankStatementLine} className="grid gap-3 rounded-lg border border-border bg-slate-50 p-4 md:grid-cols-6">
          <select name="entity_id" required className="h-9 rounded-md border border-border bg-white px-2 text-sm">
            <option value="">Pilih entitas</option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.entity_code}
              </option>
            ))}
          </select>
          <select name="account_id" required className="h-9 rounded-md border border-border bg-white px-2 text-sm">
            <option value="">Akun Kas/Bank</option>
            {bankAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} · {acc.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            name="statement_date"
            required
            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
          />
          <select name="direction" required className="h-9 rounded-md border border-border bg-white px-2 text-sm">
            <option value="debit">Masuk (Debit)</option>
            <option value="credit">Keluar (Kredit)</option>
          </select>
          <MoneyInput name="amount" placeholder="Nominal" required />
          <input
            type="text"
            name="reference_no"
            placeholder="No. Ref (opsional)"
            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
          />
          <input
            type="text"
            name="description"
            placeholder="Keterangan mutasi rekening koran"
            required
            className="h-9 rounded-md border border-border bg-white px-2 text-sm md:col-span-5"
          />
          <Button type="submit" className="h-9">
            Tambah Mutasi
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Tanggal</th>
              <th className="px-3 py-2">Akun Bank</th>
              <th className="px-3 py-2">Keterangan / Ref</th>
              <th className="px-3 py-2 text-right">Masuk</th>
              <th className="px-3 py-2 text-right">Keluar</th>
              <th className="px-3 py-2">Status & Pencocokan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-xs text-muted">
                  Belum ada baris mutasi rekening koran yang dicatat.
                </td>
              </tr>
            ) : (
              lines.map((line) => {
                const acc = accountMap.get(line.account_id)
                const matchedJournal = line.matched_journal_id
                  ? journalMap.get(line.matched_journal_id)
                  : null
                return (
                  <tr key={line.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{line.statement_date}</td>
                    <td className="px-3 py-2 text-xs">
                      {acc ? `${acc.code} · ${acc.name}` : line.account_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium">{line.description}</p>
                      {line.reference_no && (
                        <p className="text-xs text-muted">Ref: {line.reference_no}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                      {Number(line.debit) > 0 ? formatCurrency(line.debit) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-700">
                      {Number(line.credit) > 0 ? formatCurrency(line.credit) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {line.match_status === "matched" && matchedJournal ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            Cocok: {matchedJournal.journal_number}
                          </span>
                          {canEdit && (
                            <form action={matchBankStatementLine}>
                              <input type="hidden" name="line_id" value={line.id} />
                              <input type="hidden" name="match_status" value="unmatched" />
                              <button type="submit" className="text-xs text-muted underline hover:text-foreground">
                                Lepas
                              </button>
                            </form>
                          )}
                        </div>
                      ) : canEdit ? (
                        <form action={matchBankStatementLine} className="flex flex-wrap items-center gap-1.5">
                          <input type="hidden" name="line_id" value={line.id} />
                          <input type="hidden" name="match_status" value="matched" />
                          <select
                            name="matched_journal_id"
                            className="h-8 max-w-[200px] rounded border border-border bg-white px-2 text-xs"
                          >
                            <option value="">Pilih jurnal...</option>
                            {postedJournals.map((j) => (
                              <option key={j.id} value={j.id}>
                                {j.journal_number} · {j.journal_date}
                              </option>
                            ))}
                          </select>
                          <Button type="submit" variant="secondary" className="h-8 px-2 text-xs">
                            Cocokkan
                          </Button>
                        </form>
                      ) : (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          {line.match_status}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
