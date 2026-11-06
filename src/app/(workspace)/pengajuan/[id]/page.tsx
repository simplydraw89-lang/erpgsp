import Link from "next/link"
import { notFound } from "next/navigation"
import { Card } from "@/components/ui/card"
import { requireWorkspace } from "@/lib/auth/context"
import { PurchaseForm } from "@/components/procurement/purchase-form"
import { SubmitButton } from "@/components/procurement/submit-button"
import { ProcurementMessage, ProcurementUnavailable } from "@/components/procurement/section-nav"
import { payPurchase, reviewPurchase, submitPurchase } from "../actions"
import { type BusinessUnit, type ProcurementAccount, type ProcurementVendor, type PurchaseRequest, type WorkAssignment, procurementInput as input, procurementLabel as label, isProcurementMissing, purchaseStatusLabels, rupiah } from "@/lib/procurement-ui"

export default async function PurchaseDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const q = await searchParams
  const { supabase, organizationId, user, actorRole, isReadOnlyPreview } = await requireWorkspace()
  const request = await supabase.from("purchase_requests").select("*").eq("organization_id", organizationId).eq("id", id).maybeSingle()
  if (isProcurementMissing(request.error)) return <ProcurementUnavailable />
  if (request.error) throw new Error("Pengajuan tidak dapat dimuat.")
  if (!request.data) notFound()
  const purchase = request.data as PurchaseRequest
  const [units, vendors, accounts, jobs, periods, events] = await Promise.all([
    supabase.from("business_units").select("id,code,name,kind,entity_id").eq("organization_id", organizationId),
    supabase.from("procurement_vendors").select("*").eq("organization_id", organizationId),
    supabase.from("finance_accounts").select("id,code,name,account_type,posting_category,is_postable").eq("organization_id", organizationId).eq("is_active", true).eq("is_postable", true).order("code"),
    supabase.from("work_assignments").select("user_id,branch_id,job_role").eq("organization_id", organizationId).eq("user_id", user.id),
    supabase.from("accounting_periods").select("id,entity_id,period_code,starts_on,ends_on,period_status").eq("organization_id", organizationId).eq("period_status", "open"),
    supabase.from("procurement_events").select("id,action,actor_id,note,created_at").eq("organization_id", organizationId).eq("entity_id", id).order("created_at", { ascending: false }).limit(50),
  ])
  if ([units.error, vendors.error, accounts.error, jobs.error, periods.error, events.error].some(Boolean)) throw new Error("Kelengkapan pengajuan gagal dimuat.")
  const branches = (units.data ?? []).filter(u => u.kind === "branch") as BusinessUnit[]
  const branch = units.data?.find(b => b.id === purchase.branch_id)
  const liveVendor = (vendors.data as ProcurementVendor[] | null)?.find(v => v.id === purchase.vendor_id)
  const vendor = ["draft", "rejected"].includes(purchase.status) ? liveVendor : Object.keys(purchase.vendor_snapshot ?? {}).length ? purchase.vendor_snapshot : liveVendor
  const jobRows = (jobs.data ?? []) as WorkAssignment[]
  const owner = actorRole === "owner"
  const isDraft = ["draft", "rejected"].includes(purchase.status)
  const formVendors = ((vendors.data ?? []) as ProcurementVendor[]).map(v => !isDraft && v.id === purchase.vendor_id ? { ...v, ...purchase.vendor_snapshot } : v)
  const canEdit = !isReadOnlyPreview && isDraft && (owner || purchase.created_by === user.id)
  const canReview = !isReadOnlyPreview && (
    owner || 
    jobRows.some(j => {
      if (purchase.status === "branch_review") {
        return (j.branch_id === purchase.branch_id || !j.branch_id) && ["branch_manager", "admin"].includes(j.job_role) && (purchase.created_by !== user.id || owner)
      }
      if (purchase.status === "director_review") {
        return (!j.branch_id || j.branch_id === purchase.branch_id) && ["finance_director", "president"].includes(j.job_role)
      }
      if (purchase.status === "accounting_review") {
        return (!j.branch_id || j.branch_id === purchase.branch_id) && ["accounting_tax", "finance"].includes(j.job_role)
      }
      return false
    })
  )
  const canPay = !isReadOnlyPreview && purchase.status === "payment_ready" && (owner || jobRows.some(j => !j.branch_id && j.job_role === "finance"))
  const accountRows = (accounts.data ?? []) as ProcurementAccount[]
  const branchPeriods = (periods.data ?? []).filter(p => p.entity_id === branch?.entity_id)
  const fields = <><input type="hidden" name="id" value={id} /><input type="hidden" name="version" value={purchase.version} /></>
  const accountSelect = (name: string, title: string, type: string, required = true) => {
    const category: Record<string,string> = {bank_account_id:"cash_bank",payable_account_id:"trade_payable",vat_account_id:"input_vat",withholding_account_id:"withholding_tax"}
    return <label className={label}>{title}<select name={name} required={required} className={input}><option value="">Pilih akun</option>{accountRows.filter(a => a.account_type === type && a.posting_category === category[name]).map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>
  }
  return <div className="space-y-6"><Link href="/pengajuan" className="text-sm text-brand">← Daftar pengajuan</Link><header><p className="text-sm font-medium text-brand">{branch?.name} · pembelian barang / jasa</p><h1 className="mt-2 break-words text-3xl font-bold">Invoice {purchase.invoice_number}</h1><p className="mt-3 inline-block rounded-full bg-brand-light px-4 py-1.5 text-sm font-medium text-brand">{purchaseStatusLabels[purchase.status] ?? purchase.status}</p></header><ProcurementMessage error={q.error} notice={q.notice} />
    <div className="grid gap-4 sm:grid-cols-3">{[["Nilai tagihan", purchase.total], ["Pemotongan PPh", purchase.withholding_amount], ["Dibayar kepada vendor", purchase.payable_amount]].map(([title, amount]) => <Card key={String(title)} className="p-5"><p className="text-sm text-muted">{title}</p><p className="mt-2 text-xl font-semibold">{rupiah(amount)}</p></Card>)}</div>
    {purchase.review_note && <Card className="p-5"><p className="font-medium">Catatan pemeriksa</p><p className="mt-2 whitespace-pre-wrap text-sm text-muted">{purchase.review_note}</p></Card>}
    {purchase.attachment_ids?.length > 0 && <Card className="p-5"><h2 className="font-semibold">Lampiran invoice</h2><ul className="mt-3 space-y-2">{purchase.attachment_ids.map((attachment, index) => <li key={attachment}><a href={`/api/invoice-documents/${attachment}`} target="_blank" rel="noopener noreferrer" className="text-sm text-brand">Buka dokumen {index + 1} ↗</a></li>)}</ul><p className="mt-3 text-xs text-muted">Dokumen ditampilkan langsung di tab baru sesuai akses cabang dan sesi Anda.</p></Card>}
    {!isDraft && <Card className="grid gap-4 p-5 text-sm sm:grid-cols-2"><div><p className="text-muted">Vendor / NPWP</p><p className="mt-1 font-medium">{vendor?.name ?? purchase.vendor_snapshot?.name ?? "Belum dipilih"}</p><p className="mt-1 text-muted">{vendor?.address ?? purchase.vendor_snapshot?.address}</p><p className="mt-1">{vendor?.npwp}</p></div><div><p className="text-muted">Rekening vendor</p><p className="mt-1 font-medium">{vendor ? `${vendor.bank_owner} · ${vendor.bank_account}` : "Pilih vendor terverifikasi sebelum mengajukan"}</p><p className="mt-1">{vendor?.payment_method === "cash" ? "Tunai" : "Transfer bank"}</p><p className="mt-2 text-muted">Rencana bayar: {purchase.requested_payment_date ?? "Belum ditentukan"}</p></div></Card>}
    {!isDraft && <Card className="overflow-hidden"><div className="border-b border-line p-5"><h2 className="font-semibold">Rincian tagihan tersimpan</h2><p className="mt-1 text-sm text-muted">Invoice {purchase.invoice_date} · PPN {rupiah(purchase.vat_amount)} · {purchase.withholding_code}</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-canvas text-muted"><tr><th className="px-4 py-3">No.</th><th className="px-4 py-3">Keterangan</th><th className="px-4 py-3">COA</th><th className="px-4 py-3 text-right">Nominal</th></tr></thead><tbody>{purchase.lines.map((l, i) => <tr key={i} className="border-t border-line"><td className="px-4 py-3">{i + 1}</td><td className="px-4 py-3">{l.description}</td><td className="px-4 py-3">{accountRows.find(a => a.id === l.account_id)?.name ?? "Akun tidak tersedia"}</td><td className="px-4 py-3 text-right">{rupiah(l.amount)}</td></tr>)}</tbody></table></div></Card>}
    {isDraft && <PurchaseForm branches={branches} vendors={formVendors} accounts={accountRows} purchase={purchase} disabled={!canEdit} />}
    
    {canReview && ["branch_review", "director_review"].includes(purchase.status) && <Card className="space-y-4 p-5"><h2 className="font-semibold">{purchaseStatusLabels[purchase.status]}</h2><form action={reviewPurchase} className="space-y-4">{fields}<label className={label}>Catatan keputusan<textarea name="note" required rows={3} className={input} /></label><div className="flex flex-wrap gap-2"><SubmitButton name="decision" value="approve">Setujui & teruskan</SubmitButton><SubmitButton name="decision" value="reject" secondary>Tolak / minta revisi</SubmitButton></div></form></Card>}
    {canReview && purchase.status === "accounting_review" && <section className="space-y-5"><header><h2 className="text-xl font-semibold">Pemeriksaan Accounting & Tax</h2><p className="mt-2 text-sm text-muted">Periksa dan koreksi COA serta perlakuan pajak. Rincian dan nominal yang telah disetujui terkunci; perubahan belanja memerlukan revisi pengajuan. Persetujuan membentuk jurnal utang berimbang pada periode dan cabang yang dipilih.</p></header>{!branch?.entity_id && <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm">Cabang belum dihubungkan dengan unit pembukuan. Super Admin perlu mengaturnya melalui Struktur & akses sebelum jurnal dapat diposting.</p>}<PurchaseForm branches={branches} vendors={formVendors} accounts={accountRows} purchase={purchase} disabled={!branch?.entity_id || !branchPeriods.length} accountingReview={<Card className="space-y-4 p-5"><h3 className="font-semibold">Pemetaan jurnal utang</h3><input type="hidden" name="entity_id" value={branch?.entity_id ?? ""} /><div className="grid gap-4 sm:grid-cols-2"><label className={label}>Periode pembukuan<select name="period_id" required className={input}><option value="">Pilih periode terbuka</option>{branchPeriods.map(p => <option key={p.id} value={p.id}>{p.period_code} · {p.starts_on} – {p.ends_on}</option>)}</select></label>{accountSelect("payable_account_id", "Akun utang usaha", "liability")}{accountSelect("vat_account_id", "Akun PPN masukan (jika dikreditkan)", "asset", false)}{accountSelect("withholding_account_id", "Akun utang PPh (jika dipotong)", "liability", false)}</div><label className="flex items-start gap-2 text-sm"><input name="coa_confirmed" type="checkbox" required className="mt-1" />Saya memastikan COA, klasifikasi pajak, dasar pemotongan, periode dan rekening vendor telah diperiksa.</label></Card>} /><Card className="p-5"><form action={reviewPurchase} className="space-y-3">{fields}<label className={label}>Alasan penolakan / revisi<textarea name="note" required rows={2} className={input} /></label><SubmitButton name="decision" value="reject" secondary>Kembalikan untuk revisi</SubmitButton></form></Card></section>}
    {canPay && <Card className="space-y-4 p-5"><h2 className="font-semibold">Finance · catat pembayaran</h2><p className="text-sm leading-6 text-muted">Lakukan transfer melalui bank sesuai prosedur perusahaan, kemudian catat bukti pembayarannya di sini. Pencatatan ini membentuk jurnal pelunasan utang; aplikasi tidak mengirim transfer bank.</p><form action={payPurchase} className="space-y-4">{fields}<fieldset disabled={isReadOnlyPreview} className="grid gap-4 sm:grid-cols-2"><label className={label}>Tanggal pembayaran<input type="date" name="payment_date" required className={input} /></label><label className={label}>Nomor / referensi bukti bayar<input name="payment_reference" required className={input} /></label>{accountSelect("bank_account_id", "Akun kas / bank pembayaran", "asset")}<label className={label}>Periode pembayaran<select name="period_id" required className={input}><option value="">Pilih periode terbuka</option>{branchPeriods.map(p => <option key={p.id} value={p.id}>{p.period_code}</option>)}</select></label><div className="sm:col-span-2"><SubmitButton disabled={!branchPeriods.length}>Catat pembayaran & jurnal pelunasan</SubmitButton></div></fieldset></form></Card>}
    {(purchase.journal_id || purchase.payment_journal_id) && <Card className="space-y-2 p-5 text-sm"><h2 className="font-semibold">Jurnal terkait</h2>{purchase.journal_id && <p>Jurnal utang: <span className="break-all font-mono text-xs">{purchase.journal_id}</span></p>}{purchase.payment_journal_id && <p>Jurnal pelunasan: <span className="break-all font-mono text-xs">{purchase.payment_journal_id}</span></p>}{purchase.paid_on && <p>Dibayar {purchase.paid_on} · {purchase.payment_reference}</p>}<Link href="/modul/akuntansi" className="inline-block text-brand">Buka buku besar →</Link></Card>}
    <Card className="p-5"><h2 className="font-semibold">Riwayat pengajuan</h2><ol className="mt-4 space-y-4">{(events.data ?? []).map(e => <li key={e.id} className="border-l-2 border-line pl-4"><p className="text-sm font-medium">{e.action}</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted">{e.note}</p><p className="mt-1 text-xs text-muted">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(e.created_at))} · {e.actor_id}</p></li>)}</ol></Card>
  </div>
}
