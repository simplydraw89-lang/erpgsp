import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { requireWorkspace } from "@/lib/auth/context"
import { ProcurementMessage, ProcurementUnavailable } from "@/components/procurement/section-nav"
import { SubmitButton } from "@/components/procurement/submit-button"
import { requestVendor, reviewVendor } from "@/app/(workspace)/pengajuan/actions"
import { type BusinessUnit, type ProcurementVendor, type PurchaseRequest, type WorkAssignment, procurementInput as input, procurementLabel as label, isProcurementMissing, purchaseStatusLabels, rupiah } from "@/lib/procurement-ui"

export async function PurchaseWorkspace({ view, query }: { view: "pembelian" | "vendor"; query: { error?: string; notice?: string } }) {
  const { supabase, organizationId, user, actorRole, isReadOnlyPreview } = await requireWorkspace()
  const [units, assignments, purchases, vendors] = await Promise.all([
    supabase.from("business_units").select("id,code,name,kind").eq("organization_id", organizationId).order("code"),
    supabase.from("work_assignments").select("user_id,branch_id,job_role").eq("organization_id", organizationId).eq("user_id", user.id),
    view === "vendor" ? Promise.resolve({ data: [], error: null }) : supabase.from("purchase_requests").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
    supabase.from("procurement_vendors").select("*").eq("organization_id", organizationId).order("name").limit(200),
  ])
  const errors = [units.error, assignments.error, purchases.error, vendors.error]
  const missing = errors.some(isProcurementMissing)
  if (!missing && errors.some(Boolean)) throw new Error("Data pengajuan gagal dimuat. Periksa koneksi dan izin akses database.")
  const branches = (units.data ?? []).filter(b => b.kind === "branch") as BusinessUnit[]
  const jobs = (assignments.data ?? []) as WorkAssignment[]
  const owner = actorRole === "owner"
  const canReviewVendors = owner || jobs.some(j => !j.branch_id && ["finance", "accounting_tax"].includes(j.job_role))
  const writableBranches = owner ? branches : branches.filter(b => jobs.some(j => j.branch_id === b.id))
  const rows = (purchases.data ?? []) as PurchaseRequest[]
  const vendorRows = (vendors.data ?? []) as ProcurementVendor[]
  const pending = rows.filter(r => ["branch_review", "director_review", "accounting_review", "payment_ready"].includes(r.status))
  const pendingValue = rows.filter(r => !["draft", "rejected", "paid"].includes(r.status)).reduce((sum, r) => sum + Number(r.payable_amount), 0)
  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-brand">Operasional perusahaan</p><h1 className="mt-2 text-3xl font-bold">{view === "vendor" ? "Vendor" : "Pembelian"}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{view === "vendor" ? "Satu daftar vendor untuk kebutuhan proyek dan nonproyek, termasuk lab dan subkon. Daftar mengikuti cakupan akses cabang Anda." : "Pengadaan barang dan jasa, pemeriksaan dan pembayaran per cabang."}</p></div>{view === "pembelian" && !missing && !isReadOnlyPreview && writableBranches.length > 0 && <Button asChild><Link href="/pengajuan/pembelian/baru">+ Pengajuan pembelian</Link></Button>}</header>
    <ProcurementMessage error={query.error} notice={query.notice} />
    {isReadOnlyPreview && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Mode lihat sebagai aktif. Semua tindakan perubahan dinonaktifkan.</p>}
    {missing ? <ProcurementUnavailable /> : <>
      {view === "pembelian" && <>
        <div className="grid gap-4 sm:grid-cols-3">{[["Pengajuan terlihat", String(rows.length)], ["Dalam pemeriksaan / pembayaran", String(pending.length)], ["Rencana bayar belum lunas", rupiah(pendingValue)]].map(([title, val]) => <Card key={title} className="p-5"><p className="text-sm text-muted">{title}</p><p className="mt-2 text-2xl font-semibold">{val}</p></Card>)}</div>
        <p className="text-sm leading-6 text-muted">Pengaju → Manager Cabang → Direktur Keuangan → Accounting & Tax → Finance bayar. Pengajuan Manager Cabang / Project Manager langsung ke Direktur Keuangan. Ringkasan mengikuti data yang diizinkan database untuk akun Anda.</p>
        <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-canvas text-muted"><tr>{["Invoice", "Cabang", "Vendor", "Status", "Dibayar ke vendor", ""].map(t => <th key={t} className="px-4 py-3 font-medium">{t}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-t border-line"><td className="px-4 py-4 font-medium">{r.invoice_number}<span className="mt-1 block text-xs text-muted">{r.invoice_date}</span></td><td className="px-4 py-4">{branches.find(b => b.id === r.branch_id)?.name ?? "Cabang"}</td><td className="px-4 py-4">{vendorRows.find(v => v.id === r.vendor_id)?.name ?? r.vendor_snapshot?.name ?? "Belum dipilih"}</td><td className="px-4 py-4"><span className="rounded-full bg-canvas px-3 py-1 text-xs">{purchaseStatusLabels[r.status] ?? r.status}</span></td><td className="px-4 py-4">{rupiah(r.payable_amount)}</td><td className="px-4 py-4"><Link href={`/pengajuan/${r.id}`} className="font-medium text-brand">Buka →</Link></td></tr>)}</tbody></table></div>{!rows.length && <p className="p-8 text-center text-sm text-muted">Belum ada pengajuan pembelian dalam cakupan akses Anda.</p>}</Card>
      </>}
      {view === "vendor" && <>
        <Card className="p-5"><h2 className="font-semibold">Usulkan vendor baru</h2><p className="mt-1 text-sm text-muted">Pendaftaran vendor tidak membuat akun login. Finance memverifikasi identitas, NPWP dan rekening sebelum vendor dipakai untuk pembayaran.</p><form action={requestVendor} className="mt-5"><fieldset disabled={isReadOnlyPreview || !writableBranches.length} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className={label}>Cabang<select name="branch_id" required className={input}><option value="">Pilih cabang</option>{writableBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          {[["name", "Nama vendor"], ["address", "Alamat"], ["npwp", "NPWP"], ["bank_owner", "Pemilik rekening"], ["bank_account", "Nomor rekening"]].map(([name, title]) => <label key={name} className={label}>{title}<input name={name} required className={input} maxLength={name === "address" ? 1000 : 200} /></label>)}
          <label className={label}>Metode pembayaran<select name="payment_method" className={input}><option value="bank_transfer">Transfer bank</option><option value="cash">Tunai</option></select></label><div className="flex items-end"><SubmitButton>Ajukan ke Finance</SubmitButton></div>
        </fieldset></form></Card>
        <div className="grid gap-4 lg:grid-cols-2">{vendorRows.map(v => <Card key={v.id} className="space-y-3 p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{v.name}</h3><span className="rounded-full bg-canvas px-3 py-1 text-xs">{v.status === "approved" ? "Terverifikasi" : v.status === "pending" ? "Menunggu Finance" : "Ditolak"}</span></div><p className="text-sm text-muted">{branches.find(b => b.id === v.branch_id)?.name} · {v.address}</p><dl className="grid gap-2 text-sm"><div>NPWP: {v.npwp}</div><div>Rekening: {v.bank_owner} · {v.bank_account}</div><div>Metode: {v.payment_method === "cash" ? "Tunai" : "Transfer bank"}</div></dl>{v.status === "pending" && canReviewVendors && <form action={reviewVendor} className="space-y-3 border-t border-line pt-3"><input type="hidden" name="vendor_id" value={v.id} /><label className={label}>Catatan pemeriksaan<input name="note" required className={input} /></label><div className="flex gap-2"><SubmitButton disabled={isReadOnlyPreview} name="decision" value="approve">Setujui vendor</SubmitButton><SubmitButton disabled={isReadOnlyPreview} name="decision" value="reject" secondary>Tolak</SubmitButton></div></form>}</Card>)}</div>{!vendorRows.length && <p className="p-6 text-center text-sm text-muted">Belum ada vendor dalam cakupan cabang Anda.</p>}
      </>}
    </>}
  </div>
}
