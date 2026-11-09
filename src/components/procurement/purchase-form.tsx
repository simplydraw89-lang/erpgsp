"use client"

import { formatAmount } from "@/lib/money"
import { MoneyInput } from "@/components/ui/money-input"
import { CoaCombobox } from "@/components/ui/coa-combobox"
import { DatePicker } from "@/components/ui/date-picker"

import { useState, useTransition, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import { savePurchase, reviewPurchase, requestVendorFromPurchase } from "@/app/(workspace)/pengajuan/actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { SubmitButton } from "./submit-button"
import { InvoiceImport, type ExtractedInvoice } from "./invoice-import"
import { type BusinessUnit, type ProcurementVendor, type ProcurementAccount, type PurchaseRequest, type PurchaseLine, procurementInput as input, procurementLabel as label, rupiah } from "@/lib/procurement-ui"

const blank = (): PurchaseLine => ({ description: "", account_id: "", amount: 0 })
const pphOptions = [
  ["none", "Tidak dipotong PPh"], ["pph23_service", "PPh 23  -  -  -  jasa (2%)"], ["pph23_rental", "PPh 23  -  -  -  sewa selain tanah/bangunan (2%)"],
  ["pph_final_rental", "PPh Final  -  -  -  sewa tanah/bangunan (10%)"], ["pph_final_construction", "PPh Final  -  -  -  jasa konstruksi (sesuai kualifikasi)"],
  ["pph21_nonemployee", "PPh 21  -  -  -  bukan pegawai (Pasal 17  -  -  -  50% bruto)"],
]
function nonemployeeTax(base: number) {
  let rest = base / 2, result = 0
  for (const [width, rate] of [[60000000, .05], [190000000, .15], [250000000, .25], [4500000000, .30], [Infinity, .35]]) {
    const part = Math.min(rest, width); result += part * rate; rest -= part; if (rest <= 0) break
  }
  return Math.round(result * 100) / 100
}

function cleanOrgName(str: string) {
  if (!str) return ""
  return str
    .toLowerCase()
    .replace(/\b(pt\.?|cv\.?|ud\.?|pd\.?|fa\.?|tbk\.?|inc\.?|llc\.?|invoice|tagihan|faktur|kuitansi)\b/gi, "")
    .replace(/[^a-z0-9]/gi, "")
    .trim()
}

export function PurchaseForm({ branches, vendors, accounts, projects, purchase, disabled = false, accountingReview }: { branches: BusinessUnit[]; vendors: ProcurementVendor[]; accounts: ProcurementAccount[]; projects?: Array<{ id: string; code: string; name: string; branch_id: string }>; purchase?: PurchaseRequest; disabled?: boolean; accountingReview?: React.ReactNode }) {
  const [projectId, setProjectId] = useState(purchase?.project_id ?? "")
  const [branch, setBranch] = useState(purchase?.branch_id ?? branches[0]?.id ?? "")
  const [lines, setLines] = useState<PurchaseLine[]>(purchase?.lines ?? [blank()])
  const [vat, setVat] = useState(purchase?.vat_mode ?? "none")
  const [pph, setPph] = useState(purchase?.withholding_code ?? "none")
  const [rate, setRate] = useState(Number(purchase?.withholding_rate ?? 0))
  const [base, setBase] = useState(purchase ? String(purchase.withholding_base) : "")
  const [creditable, setCreditable] = useState(purchase?.vat_creditable ?? true)
  const [timing, setTiming] = useState(purchase?.withholding_timing ?? "invoice")
  const [invoiceNumber, setInvoiceNumber] = useState(purchase?.invoice_number ?? "")
  const [invoiceDate, setInvoiceDate] = useState(purchase?.invoice_date ?? "")
  const [vendorName, setVendorName] = useState(purchase?.vendor_snapshot?.name ?? "")
  const [vendorAddress, setVendorAddress] = useState(purchase?.vendor_snapshot?.address ?? "")
  const [newVendorName, setNewVendorName] = useState(purchase?.vendor_snapshot?.name ?? "")
  const [newVendorAddress, setNewVendorAddress] = useState(purchase?.vendor_snapshot?.address ?? "")
  const [vendorNpwp, setVendorNpwp] = useState("")
  const [vendorBankOwner, setVendorBankOwner] = useState("")
  const [vendorBankAccount, setVendorBankAccount] = useState("")
  const [vendorPaymentMethod, setVendorPaymentMethod] = useState("bank_transfer")
  const [vendorId, setVendorId] = useState(purchase?.vendor_id ?? "")
  const [taxInvoiceNumber, setTaxInvoiceNumber] = useState(purchase?.tax_invoice_number ?? "")
  const [taxInvoiceDate, setTaxInvoiceDate] = useState(purchase?.tax_invoice_date ?? "")
  const [attachments, setAttachments] = useState<string[]>(purchase?.attachment_ids ?? [])
  const [uploading, setUploading] = useState(false)
  const [requestingVendor, startVendorRequest] = useTransition()
  const [vendorRequest, setVendorRequest] = useState<{ id?: string; name?: string; error?: string; message?: string; branchId?: string }>({})
  const [showProposeVendor, setShowProposeVendor] = useState(false)
  const router = useRouter()
  const isFastTrack = purchase?.return_to_stage === "director_review"
  const selectedVendor = vendors.find(v => v.id === vendorId)
  const subtotal = lines.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0)
  const vatAmount = Math.round(subtotal * (vat === "non_luxury" ? .11 : vat === "luxury" ? .12 : 0) * 100) / 100
  const taxBase = base === "" ? subtotal : Number(base)
  const taxRate = pph === "pph_final_rental" ? 10 : pph.startsWith("pph23") ? 2 : pph === "pph_final_construction" ? rate : 0
  const withholding = pph === "pph21_nonemployee" ? nonemployeeTax(taxBase) : Math.round(taxBase * taxRate) / 100
  function changeLine(index: number, patch: Partial<PurchaseLine>) { setLines(current => current.map((row, i) => i === index ? { ...row, ...patch } : row)) }
  function proposeVendor(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form
    if (!form || requestingVendor) return
    const data = new FormData(form)
    const requestBranch = branch
    startVendorRequest(async () => {
      try {
        const result = await requestVendorFromPurchase(data)
        setVendorRequest({ ...result, branchId: requestBranch })
        if (result.id) setVendorId(result.id)
      } catch {
        setVendorRequest({ error: "Pengajuan vendor belum dapat diproses. Isian invoice tetap tersedia; coba kembali." })
      }
    })
  }

  function handleExtracted(data: ExtractedInvoice) {
    if (data.invoice_number) setInvoiceNumber(data.invoice_number)
    if (data.invoice_date) setInvoiceDate(data.invoice_date)
    if (data.tax_invoice_number) setTaxInvoiceNumber(data.tax_invoice_number)
    if (data.tax_invoice_date) setTaxInvoiceDate(data.tax_invoice_date)
    if (data.vat_mode) setVat(data.vat_mode)
    if (data.withholding_code) {
      setPph(data.withholding_code)
      if (data.withholding_rate !== undefined) setRate(data.withholding_rate)
    }

    if (data.vendor_name) {
      setVendorName(data.vendor_name)
      setNewVendorName(data.vendor_name)
      // Auto-match vendor in current branch
      const extractedNorm = cleanOrgName(data.vendor_name)
      if (extractedNorm) {
        const match = vendors.find(v => {
          if (v.branch_id && v.branch_id !== branch && v.status !== "approved") return false
          const vNorm = cleanOrgName(v.name)
          return vNorm === extractedNorm || vNorm.includes(extractedNorm) || extractedNorm.includes(vNorm)
        })
        if (match) {
          setVendorId(match.id)
          setShowProposeVendor(false)
          if (!data.vendor_address && match.address) { setVendorAddress(match.address); setNewVendorAddress(match.address); }
        } else {
          setShowProposeVendor(true)
        }
      }
    }
    if (data.vendor_address) { setVendorAddress(data.vendor_address); setNewVendorAddress(data.vendor_address); }
    if (data.vendor_npwp) setVendorNpwp(data.vendor_npwp)
    if (data.bank_owner) setVendorBankOwner(data.bank_owner)
    if (data.bank_account) setVendorBankAccount(data.bank_account)
    if (data.lines?.length) setLines(data.lines.map(row => ({ ...row, account_id: "" })))
  }

  return <form action={accountingReview ? reviewPurchase : savePurchase} className="space-y-6">
    <fieldset disabled={disabled || uploading || requestingVendor} className="space-y-6">
      {isFastTrack && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950">
          <p className="font-semibold flex items-center gap-2">
            <span> -  -  -  Fast-Track Pengajuan Ulang ke Direktur Keuangan</span>
          </p>
          <p className="mt-1">
            Pengajuan ini sebelumnya diminta revisi oleh <strong>Direktur Keuangan</strong>. Pengiriman perbaikan akan <strong>langsung kembali ke antrean Direktur Keuangan</strong> tanpa perlu diverifikasi ulang oleh Manager Cabang.
          </p>
        </div>
      )}
      {purchase && <><input type="hidden" name="id" value={purchase.id} /><input type="hidden" name="version" value={purchase.version} /></>}
      {accountingReview && <><input type="hidden" name="accounting" value="yes" /><input type="hidden" name="decision" value="approve" /></>}
      <input type="hidden" name="lines" value={JSON.stringify(lines)} /><input type="hidden" name="attachment_ids" value={JSON.stringify(attachments)} />
      {!accountingReview && <InvoiceImport branchId={branch} existingAttachmentId={attachments.at(-1)} disabled={disabled || !branch} onBusyChange={setUploading} onAttachment={id => setAttachments(current => current.includes(id) ? current : [...current, id])} onExtracted={handleExtracted} />}
      <fieldset disabled={Boolean(accountingReview)} className="space-y-6"><Card className="space-y-5 p-5 md:p-6">
        <div><h2 className="font-semibold">1. Invoice & cabang</h2><p className="mt-1 text-sm text-muted">Data pengajuan mengikuti cabang dan akan diteruskan ke pusat sesuai tahap pemeriksaannya.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className={label}>Cabang<select name="branch_id" value={branch} onChange={e => { setBranch(e.target.value); setVendorId(""); setAttachments([]) }} required disabled={Boolean(purchase)} className={input}><option value="">Pilih cabang</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>{purchase && <input type="hidden" name="branch_id" value={branch} />}</label>
          <label className={label}>Hubungkan ke Proyek (Potong Pagu RAB)<select name="project_id" value={projectId} onChange={e => setProjectId(e.target.value)} className={input}><option value="">Bukan Biaya Proyek (Pengeluaran Umum Cabang)</option>{(projects ?? []).filter(p => !p.branch_id || p.branch_id === branch).map(p => <option key={p.id} value={p.id}>{p.code}  -  {p.name}</option>)}</select></label>
          <label className={label}>Nomor invoice<input name="invoice_number" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} required maxLength={160} className={input} /></label>
          <label className={label}>Tanggal invoice<DatePicker name="invoice_date" value={invoiceDate} onValueChange={setInvoiceDate} required className={input} /></label>
          <label className={label}>Nomor faktur pajak<input name="tax_invoice_number" value={taxInvoiceNumber} onChange={e => setTaxInvoiceNumber(e.target.value)} className={input} /></label>
          <label className={label}>Tanggal faktur pajak<DatePicker name="tax_invoice_date" value={taxInvoiceDate} onValueChange={setTaxInvoiceDate} className={input} /></label>
          <label className={label}>Rencana tanggal pembayaran<DatePicker name="requested_payment_date" defaultValue={purchase?.requested_payment_date ?? ""} className={input} /></label>
        </div>
      </Card>
      <Card className="space-y-5 p-5 md:p-6">
        <div><h2 className="font-semibold">2. Penagih & vendor</h2><p className="mt-1 text-sm text-muted">Vendor baru perlu disetujui Finance melalui menu Daftar vendor sebelum pengajuan dikirim.</p></div>
        <label className={label}>Vendor<select name="vendor_id" value={vendorId} onChange={e => {
            const vid = e.target.value
            setVendorId(vid)
            const picked = vendors.find(v => v.id === vid)
            if (vid) {
              setShowProposeVendor(false)
            }
            if (picked) {
              setVendorName(picked.name)
              setNewVendorName(picked.name)
              if (picked.address) { setVendorAddress(picked.address); setNewVendorAddress(picked.address); }
              if (picked.npwp) setVendorNpwp(picked.npwp)
              if (picked.bank_owner) setVendorBankOwner(picked.bank_owner)
              if (picked.bank_account) setVendorBankAccount(picked.bank_account)
              if (picked.payment_method) setVendorPaymentMethod(picked.payment_method)
            }
          }} className={input}><option value="">Belum dipilih  -  -  -  boleh simpan draft</option>{vendors.filter(v => (v.branch_id === branch || v.status === "approved" || v.id === vendorId)).map(v => <option value={v.id} key={v.id}>{v.name}  -  -  -  {v.status === "approved" ? `${v.bank_owner}  -  -  -  ${v.bank_account}` : "Menunggu persetujuan Finance"}</option>)}{vendorRequest.id && vendorRequest.branchId === branch && !vendors.some(v => v.id === vendorRequest.id) && <option value={vendorRequest.id}>{vendorRequest.name}  -  -  -  Menunggu persetujuan Finance</option>}</select></label>
        {selectedVendor && <dl className="grid gap-2 rounded-lg bg-canvas p-4 text-sm sm:grid-cols-2"><div><dt className="text-muted">Nama / NPWP</dt><dd className="mt-1 font-medium">{selectedVendor.name}  -  -  -  {selectedVendor.npwp || "Belum dicatat"}</dd></div><div><dt className="text-muted">Alamat</dt><dd className="mt-1">{selectedVendor.address}</dd></div><div><dt className="text-muted">Pemilik / nomor rekening</dt><dd className="mt-1">{selectedVendor.bank_owner}  -  -  -  {selectedVendor.bank_account}</dd></div><div><dt className="text-muted">Metode pembayaran</dt><dd className="mt-1">{selectedVendor.payment_method === "cash" ? "Tunai" : "Transfer bank"}</dd></div></dl>}
        <div className="grid gap-4 sm:grid-cols-2"><label className={label}>Nama penagih pada invoice<input name="vendor_name" value={vendorName} onChange={e => setVendorName(e.target.value)} className={input} /></label><label className={label}>Alamat penagih<input name="vendor_address" value={vendorAddress} onChange={e => setVendorAddress(e.target.value)} className={input} /></label></div>
        {!accountingReview && (
          <details
            className="rounded-lg border border-line p-4"
            open={showProposeVendor && !selectedVendor}
            onToggle={e => setShowProposeVendor((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer text-sm font-semibold text-brand hover:underline">
              {selectedVendor ? "Vendor sudah terdaftar (" + selectedVendor.name + ")  -  -  -  Klik jika ingin mengusulkan perubahan/vendor baru ke Finance" : "Vendor belum terdaftar? Ajukan ke Finance"}
            </summary>
          <p className="mt-3 text-sm leading-6 text-muted">Lengkapi identitas dan rekening vendor. Data dari OCR invoice otomatis disalin ke bawah ini. Klik Ajukan vendor ke Finance jika vendor belum pernah didaftarkan sebelumnya.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className={label}>Nama vendor<input name="new_vendor_name" value={newVendorName} onChange={e => setNewVendorName(e.target.value)} maxLength={200} className={input} /></label>
            <label className={label}>Alamat vendor<input name="new_vendor_address" value={newVendorAddress} onChange={e => setNewVendorAddress(e.target.value)} maxLength={1000} className={input} /></label>
            <label className={label}>NPWP / identitas perpajakan<input name="new_vendor_npwp" value={vendorNpwp} onChange={e => setVendorNpwp(e.target.value)} maxLength={200} className={input} /></label>
            <label className={label}>Nama pemilik rekening<input name="new_vendor_bank_owner" value={vendorBankOwner} onChange={e => setVendorBankOwner(e.target.value)} maxLength={200} className={input} /></label>
            <label className={label}>Nomor rekening<input name="new_vendor_bank_account" value={vendorBankAccount} onChange={e => setVendorBankAccount(e.target.value)} maxLength={200} className={input} /></label>
            <label className={label}>Metode pembayaran<select name="new_vendor_payment_method" value={vendorPaymentMethod} onChange={e => setVendorPaymentMethod(e.target.value)} className={input}><option value="bank_transfer">Transfer bank</option><option value="cash">Tunai</option></select></label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3"><Button type="button" onClick={proposeVendor} disabled={!branch || requestingVendor}>{requestingVendor ? "Mengajukan vendor -  -  - " : "Ajukan vendor ke Finance"}</Button><Button type="button" variant="secondary" onClick={() => router.refresh()}>Muat ulang status vendor</Button></div>
        </details>
        )}
        {vendorRequest.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{vendorRequest.error}</p>}
        {vendorRequest.message && vendorRequest.branchId === branch && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{vendorRequest.message}</p>}
      </Card></fieldset>
      <Card className="space-y-4 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">3. Rincian tagihan barang / jasa</h2><p className="mt-1 text-sm text-muted">Nominal sebelum PPN. Pilih akun beban/aset pada setiap rincian bila wewenang Anda mengizinkan.</p></div><Button type="button" variant="secondary" onClick={() => setLines(current => [...current, blank()])}>+ Tambah baris</Button></div>
        <div className="space-y-3">{lines.map((row, index) => <div key={index} className="grid gap-3 rounded-lg border border-line bg-canvas p-3 sm:grid-cols-12">
          <div className="sm:col-span-5"><label className="text-xs text-muted">Deskripsi barang / jasa</label><input value={row.description} onChange={e => changeLine(index, { description: e.target.value })} required maxLength={200} className={input} /></div>
          <div className="sm:col-span-3"><label className="text-xs text-muted">Nominal (Rp)</label><MoneyInput value={row.amount || ""} onValueChange={amount => changeLine(index, { amount: amount === "" ? 0 : Number(amount) })} required min="0" className={input} /></div>
          <div className="sm:col-span-3"><label className="text-xs text-muted">Bagan akun (COA)</label><CoaCombobox accounts={accounts} value={row.account_id} onChange={id => changeLine(index, { account_id: id })} disabled={!accounts.length} /></div>
          <div className="flex items-end sm:col-span-1">{lines.length > 1 && <Button type="button" variant="secondary" onClick={() => setLines(current => current.filter((_, i) => i !== index))} className="w-full"> -  -  - </Button>}</div>
        </div>)}</div>
        <div className="flex justify-end text-sm"><span className="text-muted">Subtotal:</span><span className="ml-3 font-semibold">{rupiah(subtotal)}</span></div>
      </Card>
      <Card className="space-y-4 p-5 md:p-6">
        <div><h2 className="font-semibold">4. Perlakuan pajak</h2><p className="mt-1 text-sm text-muted">PPN dan pemotongan PPh diverifikasi oleh Accounting & Tax sebelum posting utang dan pembayaran.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-line text-muted">{["No","Jenis pajak","Dasar pengenaan pajak (DPP)","Tarif","Saat pengakuan","Nominal"].map(t=><th key={t} className="p-3">{t}</th>)}</tr></thead><tbody>
          <tr className="border-b border-line"><td className="p-3">1</td><td className="p-3"><label className={label}>PPN<select name="vat_mode" value={vat} onChange={e => setVat(e.target.value)} className={input}><option value="none">Tanpa PPN</option><option value="non_luxury">Nonmewah  -  -  -  12%  -  -  -  DPP 11/12 (efektif 11%)</option><option value="luxury">Barang mewah  -  -  -  12% (DPP penuh)</option></select></label></td><td className="p-3">{rupiah(subtotal)}<p className="text-xs text-muted">{vat === "non_luxury" ? "DPP nilai lain 11/12 dari harga" : "Harga sebelum PPN"}</p></td><td className="p-3">{vat === "none" ? "0%" : vat === "non_luxury" ? "12%  -  -  -  11/12" : "12%"}</td><td className="p-3">PPN masukan; periksa hak pengkreditan di bawah</td><td className="p-3 text-right">{rupiah(vatAmount)}</td></tr>
          <tr><td className="p-3">2</td><td className="p-3"><label className={label}>Pemotongan PPh<select name="withholding_code" value={pph} onChange={e => setPph(e.target.value)} className={input}>{pphOptions.map(([v, text]) => <option value={v} key={v}>{text}</option>)}</select></label></td><td className="p-3"><label className={label}>Dasar pemotongan PPh (sebelum PPN)<MoneyInput name="withholding_base" min="0" max={subtotal} value={base} placeholder={formatAmount(subtotal)} onValueChange={setBase} className={input} /><input type="hidden" name="base_fallback" value={subtotal} /></label></td><td className="p-3">{pph === "pph_final_construction" ? <label className={label}>Tarif sesuai jenis & sertifikat vendor<select name="withholding_rate" value={rate} onChange={e => setRate(Number(e.target.value))} required className={input}><option value="0">Pilih tarif</option>{[1.75, 2.65, 3.5, 4, 6].map(r => <option value={r} key={r}>{String(r).replace(".",",")}%</option>)}</select></label> : <input type="hidden" name="withholding_rate" value={taxRate} />}
{pph === "pph21_nonemployee" ? "Pasal 17  -  -  -  50% bruto" : pph !== "pph_final_construction" ? taxRate + "%" : ""}</td><td className="p-3"><label className={label}>Saat pengakuan utang PPh<select name="withholding_timing" value={timing} onChange={e => setTiming(e.target.value as "invoice" | "payment")} className={input}><option value="invoice">Saat pencatatan invoice / utang</option><option value="payment">Saat pembayaran, jika sesuai ketentuan objek pajak</option></select><span className="mt-1 block text-xs font-normal text-muted">Accounting & Tax wajib memeriksa saat terutang menurut objek pajak, termasuk ketentuan saat dibayar, disediakan untuk dibayar, atau jatuh tempo.</span></label></td><td className="p-3 text-right">{rupiah(withholding)}</td></tr>
        </tbody></table></div>
        {pph === "pph21_nonemployee" && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Perhitungan ini untuk penerima penghasilan bukan pegawai: tarif progresif Pasal 17 atas 50% penghasilan bruto. TER pegawai tidak digunakan. Accounting wajib memastikan klasifikasi penerima dan dasar pemotongannya.</p>}
        <label className="flex items-center gap-2 text-sm"><input name="vat_creditable" type="checkbox" checked={creditable} onChange={e => setCreditable(e.target.checked)} />PPN masukan dapat dikreditkan (diverifikasi Accounting & Tax)</label>
      </Card>
      <Card className="space-y-4 p-5 md:p-6"><h2 className="font-semibold">5. Pratinjau jurnal utang</h2><p className="text-sm text-muted">Pratinjau. Nilai final dihitung ulang di database dan baru diposting setelah pemeriksaan Accounting & Tax.</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-line text-muted"><th className="py-2">Akun</th><th className="py-2 text-right">Debet</th><th className="py-2 text-right">Kredit</th></tr></thead><tbody>
          {lines.map((row, i) => <tr key={i} className="border-b border-line"><td className="py-2">{accounts.find(a => a.id === row.account_id)?.name ?? `COA rincian ${i + 1}`}</td><td className="text-right">{rupiah(row.amount + (!creditable && subtotal ? vatAmount * row.amount / subtotal : 0))}</td><td className="text-right">-</td></tr>)}
          {vatAmount > 0 && creditable && <tr className="border-b border-line"><td className="py-2">PPN masukan</td><td className="text-right">{rupiah(vatAmount)}</td><td className="text-right">-</td></tr>}
          {withholding > 0 && timing === "invoice" && <tr className="border-b border-line"><td className="py-2">Utang {pphOptions.find(([v]) => v === pph)?.[1]}</td><td className="text-right">-</td><td className="text-right">{rupiah(withholding)}</td></tr>}
          <tr className="border-b border-line"><td className="py-2">Utang usaha kepada vendor</td><td className="text-right">-</td><td className="text-right">{rupiah(subtotal + vatAmount - (timing === "invoice" ? withholding : 0))}</td></tr>
        </tbody></table></div>
      </Card>
      {accountingReview}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton name="action_type" value="draft">Simpan draft</SubmitButton>
        <SubmitButton name="action_type" value="submit" secondary disabled={!lines.some(l => l.amount > 0) || !vendorId}>
          {isFastTrack ? "Kirim Perbaikan Langsung ke Direktur Keuangan" : "Kirim pengajuan"}
        </SubmitButton>
      </div>
    </fieldset>
  </form>
}
