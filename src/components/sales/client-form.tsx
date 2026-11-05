import { Card } from "@/components/ui/card"
import { SubmitButton } from "@/components/procurement/submit-button"
import { saveSalesClient } from "@/app/(workspace)/pengajuan/penjualan/actions"
import { salesIndustries } from "@/lib/sales"
import { procurementInput as input, procurementLabel as label } from "@/lib/procurement-ui"

export function ClientForm({ disabled }: { disabled: boolean }) {
  return <Card className="p-5">
    <h2 className="font-semibold">Daftarkan calon mitra / klien</h2>
    <p className="mt-2 text-sm text-muted">Master klien digunakan bersama seluruh cabang. Klien valid langsung tersimpan tanpa persetujuan; akses melihat daftar mengikuti role pemasaran.</p>
    <form action={saveSalesClient} className="mt-5"><fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
      <label className={label}>Nama<input name="name" required maxLength={300} className={input} autoComplete="organization" /></label>
      <label className={label}>Alamat<input name="address" required maxLength={1000} className={input} autoComplete="street-address" /></label>
      <label className={label}>NPWP<input name="npwp" required maxLength={30} className={input} placeholder="15 atau 16 digit" /><span className="mt-1 block text-xs font-normal text-muted">Validasi format, bukan verifikasi NPWP secara online.</span></label>
      <label className={label}>Nomor kontak<input name="phone" type="tel" required maxLength={60} className={input} autoComplete="tel" /></label>
      <label className={label}>Email<input name="email" type="email" required maxLength={254} className={input} autoComplete="email" /></label>
      <label className={label}>Jenis usaha<select name="industry" required className={input}><option value="">Pilih jenis usaha</option>{salesIndustries.map(industry => <option key={industry}>{industry}</option>)}</select></label>
      <label className={`${label} sm:col-span-2`}>Informasi lainnya (opsional)<textarea name="additional_information" rows={3} maxLength={5000} className={input} /></label>
      <div className="sm:col-span-2"><SubmitButton>Simpan klien</SubmitButton></div>
    </fieldset></form>
  </Card>
}
