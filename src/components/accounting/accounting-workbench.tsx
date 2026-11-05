import { formatCurrency as money } from "@/lib/money"
import { MoneyInput } from "@/components/ui/money-input"
import { Card } from "@/components/ui/card"
import {
  closeAccountingPeriod,
  createAccountingJournal,
  createAccountingPeriod,
  createCompanyEntity,
  postAccountingJournal,
  reconcileBankBalance,
  reverseAccountingJournal,
  setEntityMembership,
  voidAccountingJournal,
} from "@/app/(workspace)/modul/accounting-actions"
import type { OrganizationRole } from "@/lib/auth/context"

type Entity = {
  id: string
  entity_code: string
  legal_name: string
  entity_type: string
  parent_entity_id: string | null
  functional_currency: string
  is_active: boolean
}

type Period = {
  id: string
  entity_id: string
  period_code: string
  starts_on: string
  ends_on: string
  period_status: string
}

type Account = {
  id: string
  code: string
  name: string
  account_type: string
  is_active: boolean
  is_postable: boolean
}

type Journal = {
  id: string
  entity_id: string
  period_id: string
  journal_number: string
  journal_date: string
  description: string
  status: string
  reversal_of: string | null
}

type JournalLine = {
  journal_id: string
  line_number: number
  account_code: string
  account_name: string
  debit: number | string
  credit: number | string
}

type Reconciliation = {
  id: string
  account_id: string
  statement_date: string
  statement_balance: number | string
  book_balance: number | string
  difference: number | string
  status: string
  note: string | null
}

type Member = { user_id: string; role: OrganizationRole }



function entityLabel(entity: Entity) {
  return `${entity.entity_code} · ${entity.legal_name}`
}

export function AccountingWorkbench({
  role,
  entities,
  periods,
  accounts,
  journals,
  journalLines,
  reconciliations,
  members,
}: {
  role: OrganizationRole
  entities: Entity[]
  periods: Period[]
  accounts: Account[]
  journals: Journal[]
  journalLines: JournalLine[]
  reconciliations: Reconciliation[]
  members: Member[]
}) {
  const canAdminEntities = ["owner", "director", "finance"].includes(role)
  const canAccount = ["owner", "finance"].includes(role)
  const activeEntities = entities.filter((entity) => entity.is_active)
  const activeAccounts = accounts.filter((account) => account.is_active && account.is_postable)
  const lineGroups = new Map<string, JournalLine[]>()
  for (const line of journalLines) {
    const list = lineGroups.get(line.journal_id) ?? []
    list.push(line)
    lineGroups.set(line.journal_id, list)
  }
  const entityById = new Map(entities.map((entity) => [entity.id, entity]))
  const accountById = new Map(accounts.map((account) => [account.id, account]))

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="text-lg font-semibold">Administrasi entitas</h2>
        <p className="mt-1 text-sm text-muted">
          Hak akses ini berlaku pada organisasi. Keanggotaan entitas membatasi
          laporan yang tidak memerlukan wewenang organisasi.
        </p>
        {canAdminEntities ? (
          <div className="mt-4 grid gap-5 xl:grid-cols-2">
            <form action={createCompanyEntity} className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">Kode entitas
                <input required name="entity_code" maxLength={32} className="mt-1 w-full rounded border border-line p-2" />
              </label>
              <label className="text-sm">Nama legal
                <input required name="legal_name" maxLength={200} className="mt-1 w-full rounded border border-line p-2" />
              </label>
              <label className="text-sm">Jenis
                <select required name="entity_type" className="mt-1 w-full rounded border border-line p-2">
                  <option value="parent">Induk</option>
                  <option value="subsidiary">Anak perusahaan</option>
                  <option value="branch">Cabang</option>
                </select>
              </label>
              <label className="text-sm">Entitas induk (untuk anak/cabang)
                <select name="parent_entity_id" className="mt-1 w-full rounded border border-line p-2">
                  <option value="">Pilih induk</option>
                  {activeEntities.map((entity) => (
                    <option key={entity.id} value={entity.id}>{entityLabel(entity)}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">Mata uang fungsional
                <input required name="functional_currency" defaultValue="IDR" minLength={3} maxLength={3} pattern="[A-Z]{3}" className="mt-1 w-full rounded border border-line p-2" />
              </label>
              <label className="text-sm">NPWP / identitas pajak
                <input name="tax_id" maxLength={80} className="mt-1 w-full rounded border border-line p-2" />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" name="is_reporting_parent" /> Induk pelaporan
              </label>
              <button className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white sm:col-span-2">Buat entitas</button>
            </form>
            <form action={setEntityMembership} className="grid content-start gap-3 sm:grid-cols-2">
              <h3 className="font-medium sm:col-span-2">Keanggotaan entitas</h3>
              <label className="text-sm">Entitas
                <select required name="entity_id" className="mt-1 w-full rounded border border-line p-2">
                  <option value="">Pilih entitas</option>
                  {activeEntities.map((entity) => (
                    <option key={entity.id} value={entity.id}>{entityLabel(entity)}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">Anggota
                <select required name="user_id" className="mt-1 w-full rounded border border-line p-2">
                  <option value="">Pilih anggota</option>
                  {members.filter((member) => member.role !== "owner").map((member) => (
                    <option key={member.user_id} value={member.user_id}>{member.role} · {member.user_id.slice(0, 8)}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_default" /> Entitas default
              </label>
              <button className="rounded border border-line bg-white px-4 py-2 text-sm font-semibold">Simpan akses entitas</button>
            </form>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">Pengelolaan entitas dibatasi untuk Superuser, Direksi, dan Finance.</p>
        )}
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {entities.map((entity) => (
            <div key={entity.id} className="rounded border border-line p-3 text-sm">
              <strong>{entityLabel(entity)}</strong>
              <p className="mt-1 text-muted">{entity.entity_type} · {entity.functional_currency} · {entity.is_active ? "Aktif" : "Nonaktif"}</p>
            </div>
          ))}
          {!entities.length && <p className="text-sm text-muted">Buat entitas induk terlebih dahulu.</p>}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Periode akuntansi</h2>
        {canAccount && (
          <form action={createAccountingPeriod} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <select required name="entity_id" aria-label="Entitas periode" className="rounded border border-line p-2">
              <option value="">Pilih entitas</option>
              {activeEntities.map((entity) => <option key={entity.id} value={entity.id}>{entityLabel(entity)}</option>)}
            </select>
            <input required name="period_code" placeholder="Kode, mis. 2026-11" maxLength={32} className="rounded border border-line p-2" />
            <input required type="date" name="starts_on" aria-label="Awal periode" className="rounded border border-line p-2" />
            <input required type="date" name="ends_on" aria-label="Akhir periode" className="rounded border border-line p-2" />
            <button className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white">Buat periode</button>
          </form>
        )}
        <div className="mt-4 divide-y divide-line">
          {periods.map((period) => (
            <div key={period.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span>{entityById.get(period.entity_id)?.entity_code ?? "Entitas"} · {period.period_code} · {period.starts_on}–{period.ends_on}</span>
              <span className="flex items-center gap-3">
                <span>{period.period_status === "open" ? "Terbuka" : "Ditutup"}</span>
                {canAccount && period.period_status === "open" && (
                  <form action={closeAccountingPeriod}>
                    <input type="hidden" name="period_id" value={period.id} />
                    <button className="rounded border border-line px-3 py-1">Tutup periode</button>
                  </form>
                )}
              </span>
            </div>
          ))}
          {!periods.length && <p className="py-3 text-sm text-muted">Belum ada periode.</p>}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Jurnal umum</h2>
        <p className="mt-1 text-sm text-muted">Draft harus seimbang (debit = kredit) sebelum dapat diposting. Jurnal posted dikunci; koreksi dibuat sebagai jurnal pembalik.</p>
        {canAccount && activeAccounts.length > 0 && activeEntities.length > 0 && periods.some((period) => period.period_status === "open") ? (
          <form action={createAccountingJournal} className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <select required name="entity_id" aria-label="Entitas jurnal" className="rounded border border-line p-2">
                <option value="">Pilih entitas</option>
                {activeEntities.map((entity) => <option key={entity.id} value={entity.id}>{entityLabel(entity)}</option>)}
              </select>
              <select required name="period_id" aria-label="Periode jurnal" className="rounded border border-line p-2">
                <option value="">Pilih periode terbuka</option>
                {periods.filter((period) => period.period_status === "open").map((period) => (
                  <option key={period.id} value={period.id}>{entityById.get(period.entity_id)?.entity_code} · {period.period_code}</option>
                ))}
              </select>
              <input required type="date" name="journal_date" aria-label="Tanggal jurnal" className="rounded border border-line p-2" />
              <input required name="description" placeholder="Keterangan jurnal" maxLength={2000} className="rounded border border-line p-2" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 6 }, (_, index) => {
                const line = index + 1
                return (
                  <div key={line} className="grid gap-2 rounded border border-line p-3 sm:grid-cols-2 xl:grid-cols-5">
                    <label className="sr-only" htmlFor={`account-${line}`}>Akun baris {line}</label>
                    <select id={`account-${line}`} name={`account_id_${line}`} className="rounded border border-line p-2">
                      <option value="">Akun baris {line} (opsional)</option>
                      {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
                    </select>
                    <input name={`line_description_${line}`} placeholder="Keterangan baris" maxLength={500} className="rounded border border-line p-2" />
                    <MoneyInput name={`debit_${line}`}  min="0"  placeholder="Debit" className="rounded border border-line p-2"  />
                    <MoneyInput name={`credit_${line}`}  min="0"  placeholder="Kredit" className="rounded border border-line p-2"  />
                    <span className="self-center text-xs text-muted">Baris {line}</span>
                  </div>
                )
              })}
            </div>
            <button className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white">Simpan draft jurnal</button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted">Buat entitas, periode terbuka, dan akun aktif terlebih dahulu. Pembuatan jurnal hanya untuk Finance dan Superuser.</p>
        )}
        <div className="mt-5 divide-y divide-line">
          {journals.map((journal) => (
            <article key={journal.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{journal.journal_number} · {journal.description}</p>
                  <p className="mt-1 text-xs text-muted">{entityById.get(journal.entity_id)?.entity_code} · {journal.journal_date} · {journal.status}</p>
                </div>
                {canAccount && journal.status === "draft" && (
                  <div className="flex gap-2">
                    <form action={postAccountingJournal}>
                      <input type="hidden" name="journal_id" value={journal.id} />
                      <button className="rounded bg-brand px-3 py-2 text-sm text-white">Posting</button>
                    </form>
                    <form action={voidAccountingJournal}>
                      <input type="hidden" name="journal_id" value={journal.id} />
                      <button className="rounded border border-line px-3 py-2 text-sm">Batalkan draft</button>
                    </form>
                  </div>
                )}
                {canAccount && journal.status === "posted" && !journal.reversal_of && (
                  <form action={reverseAccountingJournal} className="flex flex-wrap gap-2">
                    <input type="hidden" name="journal_id" value={journal.id} />
                    <input required type="date" name="reversal_date" aria-label="Tanggal reversal" className="rounded border border-line p-2 text-sm" />
                    <input required name="description" placeholder="Alasan reversal" maxLength={500} className="rounded border border-line p-2 text-sm" />
                    <button className="rounded border border-line px-3 py-2 text-sm">Buat pembalik</button>
                  </form>
                )}
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead><tr className="text-muted"><th className="py-1">Akun</th><th className="py-1 text-right">Debit</th><th className="py-1 text-right">Kredit</th></tr></thead>
                  <tbody>{(lineGroups.get(journal.id) ?? []).map((line) => (
                    <tr key={`${journal.id}-${line.line_number}`} className="border-t border-line">
                      <td className="py-1">{line.account_code} · {line.account_name}</td>
                      <td className="py-1 text-right">{money(line.debit)}</td>
                      <td className="py-1 text-right">{money(line.credit)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </article>
          ))}
          {!journals.length && <p className="py-4 text-sm text-muted">Belum ada jurnal.</p>}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Rekonsiliasi saldo kas/bank</h2>
        <p className="mt-1 text-sm text-muted">Membandingkan saldo rekening koran yang diinput dengan buku besar pada tanggal tersebut. Selisih dicatat untuk ditindaklanjuti; ini belum mencocokkan mutasi rekening satu per satu.</p>
        {canAccount && activeAccounts.some((account) => account.account_type === "asset") && (
          <form action={reconcileBankBalance} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <select required name="entity_id" aria-label="Entitas rekonsiliasi" className="rounded border border-line p-2">
              <option value="">Pilih entitas</option>
              {activeEntities.map((entity) => <option key={entity.id} value={entity.id}>{entityLabel(entity)}</option>)}
            </select>
            <select required name="period_id" aria-label="Periode rekonsiliasi" className="rounded border border-line p-2">
              <option value="">Pilih periode</option>
              {periods.map((period) => <option key={period.id} value={period.id}>{entityById.get(period.entity_id)?.entity_code} · {period.period_code}</option>)}
            </select>
            <select required name="account_id" aria-label="Akun kas bank" className="rounded border border-line p-2">
              <option value="">Pilih akun kas/bank</option>
              {activeAccounts.filter((account) => account.account_type === "asset").map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
            </select>
            <input required type="date" name="statement_date" aria-label="Tanggal saldo rekening koran" className="rounded border border-line p-2" />
            <MoneyInput allowNegative required name="statement_balance" placeholder="Saldo rekening koran" className="rounded border border-line p-2"  />
            <input name="note" maxLength={1000} placeholder="Catatan / referensi rekening koran" className="rounded border border-line p-2 sm:col-span-2 xl:col-span-4" />
            <button className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white">Catat rekonsiliasi</button>
          </form>
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs text-muted"><th className="py-2">Tanggal</th><th>Akun</th><th className="text-right">Rekening koran</th><th className="text-right">Buku besar</th><th className="text-right">Selisih</th><th>Status</th></tr></thead>
            <tbody>{reconciliations.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="py-2">{row.statement_date}</td>
                <td>{accountById.get(row.account_id)?.name ?? "Akun"}</td>
                <td className="text-right">{money(row.statement_balance)}</td>
                <td className="text-right">{money(row.book_balance)}</td>
                <td className="text-right">{money(row.difference)}</td>
                <td>{row.status === "matched" ? "Cocok" : "Selisih"}</td>
              </tr>
            ))}</tbody>
          </table>
          {!reconciliations.length && <p className="py-3 text-sm text-muted">Belum ada hasil rekonsiliasi.</p>}
        </div>
      </Card>
    </div>
  )
}
