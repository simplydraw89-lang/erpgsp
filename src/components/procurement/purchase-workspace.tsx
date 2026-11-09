import { TableFilterBar } from "@/components/ui/table-filter-bar"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { requireWorkspace } from "@/lib/auth/context"
import { ProcurementMessage, ProcurementUnavailable } from "@/components/procurement/section-nav"
import { SubmitButton } from "@/components/procurement/submit-button"
import { AutoRefreshOnFocus } from "@/components/ui/auto-refresh-on-focus"
import { requestVendor, reviewVendor } from "@/app/(workspace)/pengajuan/actions"
import { PurchaseRequestList } from "./purchase-request-list"
import { PurchaseKpiCards } from "./purchase-kpi-cards"
import { type BusinessUnit, type ProcurementVendor, type PurchaseRequest, type WorkAssignment, procurementInput as input, procurementLabel as label, isProcurementMissing, purchaseStatusLabels, rupiah, formatDateID } from "@/lib/procurement-ui"

export async function PurchaseWorkspace({ view, query }: { view: "pembelian" | "vendor"; query: { error?: string; notice?: string; q?: string; branch_id?: string; status?: string; invoice_date?: string } }) {
  const { supabase, organizationId, user, actorRole, isReadOnlyPreview } = await requireWorkspace()
  const [units, assignments, purchases, vendors] = await Promise.all([
    supabase.from("business_units").select("id,code,name,kind").eq("organization_id", organizationId).order("code"),
    supabase.from("work_assignments").select("user_id,branch_id,job_role").eq("organization_id", organizationId).eq("user_id", user.id),
    supabase.from("purchase_requests").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
    supabase.from("procurement_vendors").select("*").eq("organization_id", organizationId).order("name").limit(200),
  ])
  const errors = [units.error, assignments.error, purchases.error, vendors.error]
  const missing = errors.some(isProcurementMissing)
  if (!missing && errors.some(Boolean)) throw new Error("Data pengajuan gagal dimuat. Periksa koneksi dan izin akses database.")
  const branches = (units.data ?? []).filter(b => b.kind === "branch" || b.kind === "center") as BusinessUnit[]
  const jobs = (assignments.data ?? []) as WorkAssignment[]
  const owner = actorRole === "owner"
  const canReviewVendors = owner || jobs.some(j => !j.branch_id && ["finance", "accounting_tax"].includes(j.job_role))
  const isCentralUser = owner || jobs.some(j => !j.branch_id && ["president", "finance_director", "technical_director", "accounting_tax", "finance"].includes(j.job_role));
  const writableBranches = isCentralUser ? branches : branches.filter(b => jobs.some(j => j.branch_id === b.id))
    const allPurchases = (purchases.data ?? []) as PurchaseRequest[]
  const vendorRows = (vendors.data ?? []) as ProcurementVendor[]

  const rows = allPurchases.filter(r => {
    if (query.branch_id && r.branch_id !== query.branch_id) return false;
    if (query.status && r.status !== query.status) return false;
    if (query.invoice_date && r.invoice_date !== query.invoice_date) return false;
    if (query.q) {
      const q = query.q.toLowerCase();
      const vName = (vendorRows.find(v => v.id === r.vendor_id)?.name ?? r.vendor_snapshot?.name ?? "").toLowerCase();
      const inv = (r.invoice_number ?? "").toLowerCase();
      const reqNum = (r.request_number ?? "").toLowerCase();
      if (!vName.includes(q) && !inv.includes(q) && !reqNum.includes(q)) return false;
    }
    return true;
  });

    const userBranchId = jobs.find(j => j.branch_id)?.branch_id ?? null;
  const pending = rows.filter(r => ["branch_review", "director_review", "accounting_review", "payment_ready"].includes(r.status))
  const pendingValue = rows.filter(r => !["draft", "rejected", "paid"].includes(r.status)).reduce((sum, r) => sum + Number(r.payable_amount), 0)

  // Prioritas Posisi: Pengajuan yang urgent/sedang butuh persetujuan & verifikasi selalu berada di paling atas
  const purchasePriority = (status: string) => {
    switch (status) {
      case "director_review": return 1;   // Persetujuan Direktur Keuangan (Prioritas 1)
      case "branch_review": return 2;     // Verifikasi Manager Cabang (Prioritas 2)
      case "accounting_review": return 3; // Verifikasi Accounting & Tax (Prioritas 3)
      case "payment_ready": return 4;     // Siap Dibayar Finance (Prioritas 4)
      case "rejected": return 5;          // Perlu Revisi
      case "draft": return 6;             // Draft
      case "paid": return 7;              // Selesai / Lunas
      default: return 8;
    }
  };
  const sortedRows = [...rows].sort((a, b) => {
    const pDiff = purchasePriority(a.status) - purchasePriority(b.status);
    if (pDiff !== 0) return pDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return <div className="space-y-6">
    <AutoRefreshOnFocus />
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-brand">Operasional perusahaan</p><h1 className="mt-2 text-3xl font-bold">{view === "vendor" ? "Vendor" : "Pembelian"}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{view === "vendor" ? "Satu daftar vendor untuk kebutuhan proyek dan nonproyek, termasuk lab dan subkon. Daftar mengikuti cakupan akses cabang Anda." : "Pengadaan barang dan jasa, pemeriksaan dan pembayaran per cabang."}</p></div>{view === "pembelian" && !missing && !isReadOnlyPreview && writableBranches.length > 0 && <Button asChild><Link href="/pengajuan/pembelian/baru">+ Pengajuan pembelian</Link></Button>}</header>
    <ProcurementMessage error={query.error} notice={query.notice} />
    {isReadOnlyPreview && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Mode lihat sebagai aktif. Semua tindakan perubahan dinonaktifkan.</p>}
    {missing ? <ProcurementUnavailable /> : <>
      {view === "pembelian" && <>
        <PurchaseKpiCards
          rows={rows}
          pending={pending}
          pendingValue={pendingValue}
          branches={branches}
          vendorRows={vendorRows}
        />
        <p className="text-sm leading-6 text-muted">Daftar diurutkan berdasarkan prioritas status: Pengajuan yang memerlukan tindakan segera (persetujuan Direktur, verifikasi Manager, atau pembayaran) selalu berada di atas.</p>
        <TableFilterBar
          branches={branches}
          isCentralUser={isCentralUser}
          userBranchId={userBranchId}
          fields={[
            { key: "q", label: "Nomor Invoice / Vendor", placeholder: "Ketik nomor invoice atau vendor..." },
            { key: "invoice_date", label: "Tanggal Invoice", type: "date" },
            {
              key: "status",
              label: "Status Dokumen",
              type: "select",
              options: Object.entries(purchaseStatusLabels).map(([val, lbl]) => ({ value: val, label: lbl }))
            }
          ]}
        />
        <PurchaseRequestList purchases={sortedRows} branches={branches} vendorRows={vendorRows} />
      </>}
      {view === "vendor" && <>
        <Card className="p-5"><h2 className="font-semibold">Usulkan vendor baru</h2><p className="mt-1 text-sm text-muted">Pendaftaran vendor tidak membuat akun login. Finance memverifikasi identitas, NPWP dan rekening sebelum vendor dipakai untuk pembayaran.</p><form action={requestVendor} className="mt-5"><fieldset disabled={isReadOnlyPreview || !writableBranches.length} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className={label}>Cabang<select name="branch_id" required className={input}><option value="">Pilih cabang</option>{writableBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          {[["name", "Nama vendor"], ["address", "Alamat"], ["npwp", "NPWP"], ["bank_owner", "Pemilik rekening"], ["bank_account", "Nomor rekening"]].map(([name, title]) => <label key={name} className={label}>{title}<input name={name} required className={input} maxLength={name === "address" ? 1000 : 200} /></label>)}
          <label className={label}>Metode pembayaran<select name="payment_method" className={input}><option value="bank_transfer">Transfer bank</option><option value="cash">Tunai</option></select></label><div className="flex items-end"><SubmitButton>Ajukan ke Finance</SubmitButton></div>
        </fieldset></form></Card>
        <div className="space-y-4">
          <TableFilterBar
            branches={branches}
            isCentralUser={isCentralUser}
            userBranchId={userBranchId}
            fields={[
              { key: "q", label: "Nama / Alamat Vendor", placeholder: "Cari nama vendor..." }
            ]}
          />
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-canvas text-muted">
                  <tr>
                    {["No.", "Nama Vendor", "Cabang", "NPWP & Rekening", "Lampiran", "Status", "Aksi / Verifikasi"].map(t => (
                      <th key={t} className="px-4 py-3 font-medium">{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vendorRows.filter(v => {
                    if (query.branch_id && v.branch_id !== query.branch_id) return false;
                    if (query.q) {
                      const q = query.q.toLowerCase();
                      return v.name.toLowerCase().includes(q) || (v.address && v.address.toLowerCase().includes(q)) || (v.npwp && v.npwp.toLowerCase().includes(q));
                    }
                    return true;
                  }).map((v, idx) => {
                    const relatedPurchase = allPurchases.find(p => p.vendor_id === v.id || (p.vendor_snapshot && (p.vendor_snapshot.name === v.name || p.vendor_snapshot.id === v.id)));
                    const attachments = relatedPurchase?.attachment_ids ?? [];
                    return (
                      <tr key={v.id} className="border-t border-line align-top">
                        <td className="px-4 py-4 text-xs font-semibold text-muted">{idx + 1}</td>
                        <td className="px-4 py-4">
                          <div className="font-semibold">{v.name}</div>
                          <div className="mt-1 text-xs text-muted">{v.address}</div>
                        </td>
                        <td className="px-4 py-4 text-xs">
                          {branches.find(b => b.id === v.branch_id)?.name ?? "Cabang"}
                        </td>
                        <td className="px-4 py-4 text-xs space-y-1">
                          <div><span className="text-muted">NPWP:</span> {v.npwp || "—"}</div>
                          <div><span className="text-muted">Rek:</span> {v.bank_owner} ({v.bank_account})</div>
                          <div><span className="text-muted">Metode:</span> {v.payment_method === "cash" ? "Tunai" : "Transfer Bank"}</div>
                        </td>
                        <td className="px-4 py-4 text-xs">
                          {attachments.length > 0 ? (
                            <div className="space-y-1">
                              {attachments.map((att, attIdx) => (
                                <a
                                  key={att}
                                  href={`/api/invoice-documents/${att}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block font-medium text-brand hover:underline"
                                >
                                  Lampiran {attIdx + 1} ↗
                                </a>
                              ))}
                              {relatedPurchase && (
                                <Link
                                  href={`/pengajuan/${relatedPurchase.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 inline-block text-[11px] text-muted hover:text-brand"
                                >
                                  (Invoice: {relatedPurchase.invoice_number})
                                </Link>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted italic">Tidak ada</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            v.status === "approved" ? "bg-emerald-50 text-emerald-700" :
                            v.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                          }`}>
                            {v.status === "approved" ? "Terverifikasi" : v.status === "pending" ? "Menunggu Finance" : "Ditolak"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {v.status === "pending" && canReviewVendors ? (
                            <form action={reviewVendor} className="space-y-2 min-w-[200px]">
                              <input type="hidden" name="vendor_id" value={v.id} />
                              <input
                                name="note"
                                placeholder="Catatan verifikasi..."
                                required
                                className="w-full rounded-md border border-line px-2.5 py-1 text-xs"
                              />
                              <div className="flex gap-1.5">
                                <SubmitButton disabled={isReadOnlyPreview} name="decision" value="approve">Setujui</SubmitButton>
                                <SubmitButton disabled={isReadOnlyPreview} name="decision" value="reject" secondary>Tolak</SubmitButton>
                              </div>
                            </form>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!vendorRows.length && (
              <p className="p-6 text-center text-sm text-muted">Belum ada vendor dalam cakupan cabang Anda.</p>
            )}
          </Card>
        </div>
      </>}
    </>}
  </div>
}

