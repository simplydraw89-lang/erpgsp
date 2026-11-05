import Link from "next/link"
import { Card } from "@/components/ui/card"
import { SubmitButton } from "@/components/procurement/submit-button"
import { saveCoa, installCoa } from "@/app/(workspace)/modul/coa-actions"
import { flattenCoa, sectionLabels, categoryLabels, type CoaAccount } from "@/lib/accounting/coa"
import { procurementInput as input, procurementLabel as label } from "@/lib/procurement-ui"

export function ChartOfAccounts({ accounts, editable, editId }: { accounts: CoaAccount[]; editable: boolean; editId?: string }) {
  const selected = accounts.find(a => a.id === editId)
  return <div className="space-y-6">
    <header><h1 className="text-3xl font-bold">Bagan akun (COA)</h1><p className="mt-2 text-sm text-muted">Satu bagan akun perusahaan untuk tiga cabang. Kelompok merangkum akun anak; hanya akun detail aktif dapat digunakan dalam jurnal.</p><div className="mt-3 flex gap-5 text-sm text-brand"><Link href="/pengajuan/pembelian/baru">Buat pengajuan pembelian</Link><Link href="/modul/akuntansi">Jurnal dan buku besar</Link></div></header>
    <Card className="p-5 text-sm leading-6">Nomor akun merupakan rekomendasi perusahaan, bukan penomoran wajib PSAK. Penghasilan komprehensif lain dipisahkan dari laba rugi. Accounting &amp; Finance perlu menyetujui penggunaan akun sesuai transaksi dan kebijakan perusahaan. Tidak ada saldo awal yang dibuat otomatis.</Card>
    {editable && <Card className="space-y-4 p-5"><h2 className="font-semibold">{selected ? `Ubah ${selected.code}` : "Tambah kelompok / akun"}</h2>
      <form key={selected?.id ?? "new"} action={saveCoa} className="grid gap-4 md:grid-cols-3">
        <input type="hidden" name="id" value={selected?.id ?? ""} /><input type="hidden" name="version" value={selected?.row_version ?? ""} />
        <label className={label}>Kode<input name="code" required maxLength={32} defaultValue={selected?.code} className={input} /></label>
        <label className={label}>Nama<input name="name" required maxLength={200} defaultValue={selected?.name} className={input} /></label>
        <label className={label}>Jenis<select name="account_type" defaultValue={selected?.account_type ?? "expense"} className={input}>{Object.entries({asset:"Aset",liability:"Liabilitas",equity:"Ekuitas",revenue:"Penghasilan",expense:"Beban"}).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
        <label className={label}>Kelompok laporan<select name="report_section" defaultValue={selected?.report_section ?? "expense"} className={input}>{Object.entries(sectionLabels).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
        <label className={label}>Induk<select name="parent_account_id" defaultValue={selected?.parent_account_id ?? ""} className={input}><option value="">Tanpa induk (kelompok utama)</option>{flattenCoa(accounts).filter(({account:a})=>!a.is_postable && a.id!==selected?.id).map(({account:a,depth})=><option key={a.id} value={a.id}>{"— ".repeat(depth)}{a.code} · {a.name}</option>)}</select></label>
        <label className={label}>Penggunaan<select name="is_postable" defaultValue={String(selected?.is_postable ?? true)} className={input}><option value="true">Akun detail — dapat dijurnal</option><option value="false">Kelompok — ringkasan akun anak</option></select></label>
        <label className={label}>Saldo normal<select name="normal_balance" defaultValue={selected?.normal_balance ?? "debit"} className={input}><option value="debit">Debit</option><option value="credit">Kredit</option></select></label>
        <label className={label}>Fungsi akun<select name="posting_category" defaultValue={selected?.posting_category ?? "expense"} className={input}>{Object.entries(categoryLabels).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={selected?.is_active ?? true} />Aktif</label>
        <p className="text-xs text-muted md:col-span-3">Induk harus memiliki jenis dan kelompok laporan yang sama. Akun yang telah dipakai jurnal dikunci klasifikasinya; nama dan status aktif tetap dapat dikelola.</p>
        <div className="flex items-center gap-4"><SubmitButton>Simpan COA</SubmitButton>{selected && <Link href="/modul/keuangan" className="text-sm text-brand">Batal</Link>}</div>
      </form>
      {!accounts.length && <form action={installCoa}><SubmitButton>Gunakan rekomendasi 98 kelompok dan akun</SubmitButton></form>}
    </Card>}
    <Card className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-canvas"><tr>{["Kode / nama akun","Kelompok laporan","Saldo normal","Penggunaan","Status",...(editable?["Tindakan"]:[])].map(t=><th className="p-3" key={t}>{t}</th>)}</tr></thead><tbody>{flattenCoa(accounts).map(({account:a,depth})=><tr key={a.id} className="border-t border-line"><td className={`py-3 pr-3 ${a.is_postable?"":"font-semibold bg-canvas/50"}`} style={{paddingLeft:12+depth*20}}>{a.code} · {a.name}</td><td className="p-3">{sectionLabels[a.report_section]}</td><td className="p-3">{a.normal_balance==="debit"?"Debit":"Kredit"}</td><td className="p-3">{a.is_postable?categoryLabels[a.posting_category]:"Kelompok"}</td><td className="p-3">{a.is_active?"Aktif":"Nonaktif"}</td>{editable && <td className="p-3"><Link href={`/modul/keuangan?edit=${a.id}`} className="text-brand">Ubah</Link></td>}</tr>)}</tbody></table>{!accounts.length && <p className="p-5 text-sm text-muted">Belum ada COA.</p>}</Card>
  </div>
}
