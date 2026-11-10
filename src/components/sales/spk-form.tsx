"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { SubmitButton } from "@/components/procurement/submit-button"
import { saveSalesDocument } from "@/app/(workspace)/pengajuan/penjualan/actions"
import { ClientPicker } from "./client-picker"
import { DocumentUpload } from "./document-upload"
import { formatOfficialSalesNumber } from "@/lib/sales"
import { type BusinessUnit, type SalesClient, type SalesDocument, procurementInput as input, procurementLabel as label } from "@/lib/procurement-ui"

function generateSpkNumberFromSph(sphDoc?: SalesDocument | null) {
  if (!sphDoc) return ""
  return formatOfficialSalesNumber(sphDoc, "spk")
}

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
  const [spkNumber, setSpkNumber] = useState(initialDoc ? generateSpkNumberFromSph(initialDoc) : "")
  const [title, setTitle] = useState(initialDoc?.title ? `SPK ${initialDoc.title}` : "")
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
    setSpkNumber("")
    setTitle("")
    setClient(null)
  }

  function handleSphChange(sphId: string) {
    setSelectedSphId(sphId)
    const found = documents.find(d => d.id === sphId)
    if (found) {
      setSpkNumber(generateSpkNumberFromSph(found))
      if (!title || title.startsWith("SPK")) {
        setTitle(found.title ? `SPK ${found.title}` : "")
      }
      if (found.client_snapshot) {
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
    } else {
      setSpkNumber("")
    }
  }

  function handleClientChange(newClient: SalesClient) {
    setClient(newClient)
    const currentSph = documents.find(d => d.id === selectedSphId)
    if (currentSph && currentSph.client_id !== newClient.id) {
      setSelectedSphId("")
      setSpkNumber("")
      setTitle("")
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-xl font-bold text-ink">Buat Pengajuan SPK</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        SPK diterbitkan merujuk pada SPH yang telah disetujui Direktur Keuangan. Pilih cabang dan SPH rujukan untuk mengisi data klien secara otomatis. Anda dapat memilih <strong>Simpan Draft SPK</strong> untuk menyimpan tanpa diajukan, atau <strong>Kirim Pengajuan SPK ke Direktur</strong> untuk memulai proses persetujuan.
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
                  {formatOfficialSalesNumber(item, "sph")} · {item.title} ({item.client_snapshot?.name ?? "Klien"})
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

          <input type="hidden" name="client_id" value={client?.id ?? ""} />

          <div className={label}>
            Klien Terpilih (Sesuai SPH)
            <ClientPicker value={client} onChange={handleClientChange} disabled={disabled || uploading} />
          </div>

          {/* Kolom Nomor Dokumen SPK Otomatis dari SPH */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Nomor Dokumen SPK Resmi
              </span>
              <span className="rounded bg-blue-200/80 px-2 py-0.5 text-[11px] font-semibold text-blue-950">
                {spkNumber ? "Otomatis dari SPH" : "Pilih SPH Terlebih Dahulu"}
              </span>
            </div>
            <label className={label}>
              Nomor SPK
              <input
                name="document_number"
                value={spkNumber}
                onChange={e => setSpkNumber(e.target.value)}
                required
                placeholder="SPK/KLIEN/GSP/..."
                className={`${input} font-mono font-bold text-blue-950 bg-white`}
              />
            </label>
            <p className="text-xs text-blue-700">
              Nomor SPK disinkronkan langsung dengan kode penomoran SPH yang telah disetujui internal.
            </p>
          </div>

          <label className={label}>
            Judul / Lingkup Pekerjaan SPK
            <input
              name="title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              maxLength={300}
              placeholder="Contoh: SPK Pekerjaan Uji Emisi & Monitoring Lingkungan..."
              className={input}
            />
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

          <div className="flex flex-col-reverse gap-3 pt-4 border-t border-line sm:flex-row sm:items-center">
            <SubmitButton
              name="intent"
              value="draft"
              secondary
              disabled={uploading || !client || !selectedSphId}
            >
              Simpan Draft SPK
            </SubmitButton>
            <SubmitButton
              name="intent"
              value="submit"
              disabled={uploading || !client || !selectedSphId}
            >
              Kirim Pengajuan SPK ke Direktur
            </SubmitButton>
          </div>
        </fieldset>
      </form>
    </Card>
  )
}
