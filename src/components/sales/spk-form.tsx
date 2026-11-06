"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { SubmitButton } from "@/components/procurement/submit-button"
import { saveSalesDocument } from "@/app/(workspace)/pengajuan/penjualan/actions"
import { ClientPicker } from "./client-picker"
import { DocumentUpload } from "./document-upload"
import { type BusinessUnit, type SalesClient, type SalesDocument, procurementInput as input, procurementLabel as label } from "@/lib/procurement-ui"

export function SpkForm({
  branches,
  documents,
  disabled,
  initialSphId,
}: {
  branches: BusinessUnit[]
  documents: SalesDocument[]
  disabled: boolean
  initialSphId?: string
}) {
  const initialDoc = initialSphId ? documents.find(d => d.id === initialSphId) : null
  const [branch, setBranch] = useState(initialDoc?.branch_id ?? branches[0]?.id ?? "")
  const [selectedSphId, setSelectedSphId] = useState(initialDoc?.id ?? "")
  const [client, setClient] = useState<SalesClient | null>(
    (initialDoc?.client_snapshot as unknown as SalesClient) ?? null
  )
  const [attachments, setAttachments] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const availableSphs = documents.filter(
    document =>
      document.kind === "sph" &&
      ["ready", "accepted"].includes(document.status) &&
      document.branch_id === branch &&
      (!client || document.client_id === client.id)
  )

  function handleBranchChange(newBranchId: string) {
    setBranch(newBranchId)
    setAttachments([])
    setSelectedSphId("")
    setClient(null)
  }

  function handleSphChange(sphId: string) {
    setSelectedSphId(sphId)
    const found = documents.find(d => d.id === sphId)
    if (found && found.client_snapshot) {
      setClient({
        id: found.client_id,
        name: (found.client_snapshot.name as string) ?? "Klien",
        address: (found.client_snapshot.address as string) ?? "",
        npwp: (found.client_snapshot.npwp as string) ?? null,
        contact: (found.client_snapshot.contact as string) ?? null,
        phone: (found.client_snapshot.phone as string) ?? null,
        email: (found.client_snapshot.email as string) ?? null,
        industry: (found.client_snapshot.industry as any) ?? null,
        additional_information: null,
      })
    }
  }

  function handleClientChange(newClient: SalesClient) {
    setClient(newClient)
    const currentSph = documents.find(d => d.id === selectedSphId)
    if (currentSph && currentSph.client_id !== newClient.id) {
      setSelectedSphId("")
    }
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Buat Draft SPK</h2>
      <p className="mt-2 text-sm text-muted">
        SPK merujuk pada SPH yang telah disetujui Direktur Keuangan. Pilih cabang dan SPH rujukan untuk mengisi data klien secara otomatis.
      </p>
      <form action={saveSalesDocument} className="mt-5">
        <fieldset disabled={disabled || uploading || !branches.length} className="space-y-4">
          <input type="hidden" name="kind" value="spk" />
          
          <label className={label}>
            Cabang
            <select
              name="branch_id"
              required
              value={branch}
              onChange={event => handleBranchChange(event.target.value)}
              className={input}
            >
              <option value="">Pilih cabang</option>
              {branches.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className={label}>
            SPH Rujukan yang Telah Disetujui
            <select
              key={`${branch}-${client?.id}`}
              name="accepted_sph_id"
              required
              value={selectedSphId}
              onChange={event => handleSphChange(event.target.value)}
              className={input}
            >
              <option value="">Pilih SPH yang disetujui</option>
              {availableSphs.map(item => (
                <option key={item.id} value={item.id}>
                  SPH No. {item.sph_number} · {item.title} ({item.client_snapshot?.name ?? "Klien"})
                </option>
              ))}
            </select>
          </label>

          {!availableSphs.length && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {client
                ? `Belum ada SPH yang disetujui untuk klien "${client.name}" di cabang ini.`
                : "Belum ada SPH dengan status Disetujui di cabang ini."}
            </p>
          )}

          <div className={label}>
            Klien Terpilih (Sesuai SPH)
            <ClientPicker value={client} onChange={handleClientChange} disabled={disabled || uploading} />
          </div>

          <label className={label}>
            Judul / Nomor SPK pada Dokumen
            <input name="title" required maxLength={300} placeholder="Contoh: SPK Pekerjaan Uji Emisi & Air Limbah..." className={input} />
          </label>

          <label className={label}>
            SPK Diterbitkan Oleh
            <select name="source" className={input}>
              <option value="company">Perusahaan</option>
              <option value="client">Klien</option>
            </select>
          </label>

          <label className={label}>
            Informasi Tambahan / Catatan
            <textarea name="notes" rows={4} placeholder="Tambahkan catatan khusus bila ada..." className={input} />
          </label>

          <DocumentUpload
            key={branch}
            branchId={branch}
            label="Lampiran Dokumen SPK"
            attachments={attachments}
            onChange={setAttachments}
            onBusyChange={setUploading}
            disabled={disabled || uploading || !client}
          />
          <input type="hidden" name="attachment_ids" value={JSON.stringify(attachments)} />

          <SubmitButton disabled={uploading || !client || !selectedSphId}>
            Simpan Draft SPK
          </SubmitButton>
        </fieldset>
      </form>
    </Card>
  )
}
