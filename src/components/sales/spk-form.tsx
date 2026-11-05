"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { SubmitButton } from "@/components/procurement/submit-button"
import { saveSalesDocument } from "@/app/(workspace)/pengajuan/penjualan/actions"
import { ClientPicker } from "./client-picker"
import { DocumentUpload } from "./document-upload"
import { type BusinessUnit, type SalesClient, type SalesDocument, procurementInput as input, procurementLabel as label } from "@/lib/procurement-ui"

export function SpkForm({ branches, documents, disabled }: { branches: BusinessUnit[]; documents: SalesDocument[]; disabled: boolean }) {
  const [branch, setBranch] = useState(branches[0]?.id ?? "")
  const [client, setClient] = useState<SalesClient | null>(null)
  const [attachments, setAttachments] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const accepted = documents.filter(document => document.kind === "sph" && document.status === "accepted" && document.branch_id === branch && document.client_id === client?.id)
  return <Card className="p-5"><h2 className="font-semibold">Buat draft SPK</h2><p className="mt-2 text-sm text-muted">SPK merujuk SPH yang telah disetujui internal dan disepakati kedua pihak. Klien dipilih dari master perusahaan yang sama.</p>
    <form action={saveSalesDocument} className="mt-5"><fieldset disabled={disabled || uploading || !branches.length} className="space-y-4">
      <input type="hidden" name="kind" value="spk" />
      <label className={label}>Cabang<select name="branch_id" required value={branch} onChange={event => { setBranch(event.target.value); setAttachments([]) }} className={input}><option value="">Pilih cabang</option>{branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className={label}>Pilih Klien<ClientPicker value={client} onChange={setClient} disabled={disabled || uploading} /></div>
      <label className={label}>SPH yang disepakati kedua pihak<select key={`${branch}-${client?.id}`} name="accepted_sph_id" required className={input}><option value="">Pilih SPH</option>{accepted.map(item => <option key={item.id} value={item.id}>SPH No. {item.sph_number} · {item.title}</option>)}</select></label>
      {!accepted.length && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Belum ada SPH yang disepakati untuk klien dan cabang ini.</p>}
      <label className={label}>Judul / nomor SPK pada dokumen<input name="title" required maxLength={300} className={input} /></label>
      <label className={label}>SPK dibuat oleh<select name="source" className={input}><option value="company">Perusahaan</option><option value="client">Klien</option></select></label>
      <label className={label}>Informasi tambahan<textarea name="notes" rows={4} className={input} /></label>
      <DocumentUpload key={branch} branchId={branch} label="Dokumen SPK manual" attachments={attachments} onChange={setAttachments} onBusyChange={setUploading} disabled={disabled || uploading || !client} />
      <input type="hidden" name="attachment_ids" value={JSON.stringify(attachments)} />
      <SubmitButton disabled={uploading || !client || !accepted.length}>Simpan draft SPK</SubmitButton>
    </fieldset></form>
  </Card>
}
