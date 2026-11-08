"use client"

import { MoneyInput } from "@/components/ui/money-input"

import { useActionState, useRef, useState, type FormEvent } from "react"
import { Card } from "@/components/ui/card"
import { saveSphRequest } from "@/app/(workspace)/pengajuan/penjualan/actions"
import { ClientPicker } from "./client-picker"
import { DocumentUpload } from "./document-upload"
import { sphWorkScopes } from "@/lib/sales"
import { type BusinessUnit, type SalesClient, type SalesDocument, procurementInput as input, procurementLabel as label } from "@/lib/procurement-ui"

export function SphForm({ branches, draftId, document: draft, disabled }: { branches: BusinessUnit[]; draftId: string; document?: SalesDocument; disabled: boolean }) {
  const [state, action, pending] = useActionState(saveSphRequest, {})
  const [branch, setBranch] = useState(draft?.branch_id ?? branches[0]?.id ?? "")
  const [client, setClient] = useState<Partial<SalesClient> | null>(draft ? { ...draft.client_snapshot, id: draft.client_id } : null)
  const [attachments, setAttachments] = useState(draft?.attachment_ids ?? [])
  const [uploading, setUploading] = useState(false)
  const [branchNotice, setBranchNotice] = useState("")
  const form = useRef<HTMLFormElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const draftButton = useRef<HTMLButtonElement>(null)
  const submitButton = useRef<HTMLButtonElement>(null)
  const confirmationInput = useRef<HTMLInputElement>(null)
  const confirmed = useRef(false)
  const busy = disabled || pending || uploading

  function beforeSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    if (submitter?.value === "submit" && !confirmed.current) {
      event.preventDefault(); dialog.current?.showModal(); return
    }
    confirmed.current = false
  }
  function decide(yes: boolean) {
    dialog.current?.close()
    confirmed.current = yes
    if (confirmationInput.current) confirmationInput.current.value = String(yes)
    form.current?.requestSubmit(yes ? submitButton.current ?? undefined : draftButton.current ?? undefined)
  }

  const isReviewStage = draft && ["branch_review", "director_review"].includes(draft.status)
  const isFastTrack = draft?.return_to_stage === "director_review"

  return <Card className="p-5">
    <h2 className="font-semibold">{draft ? `Edit ${isReviewStage ? "Pemeriksa" : "Draft"} ${draft.document_number || `SPH No. ${draft.sph_number}`}` : "Buat draft SPH"}</h2>
    <p className="mt-2 text-sm leading-6 text-muted">
      {isReviewStage
        ? "Sebagai pemeriksa, Anda dapat langsung mengubah data di bawah ini (misal nilai, tanggal, atau catatan) lalu menyimpannya."
        : "Pilih cabang, klien dan judul untuk menyimpan draft. Lengkapi seluruh data sebelum submit. Bidang usaha mengikuti master klien."}
    </p>
    {isFastTrack && (
      <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950">
        <p className="font-semibold flex items-center gap-2">
          <span>⚡ Fast-Track Pengajuan Ulang ke Direktur</span>
        </p>
        <p className="mt-1">
          Pengajuan ini sebelumnya diminta revisi oleh <strong>Direktur Keuangan</strong>. Setelah perbaikan disimpan dan diajukan, berkas akan <strong>langsung diteruskan kembali ke Direktur Keuangan</strong> tanpa perlu menunggu pemeriksaan Manager Cabang lagi.
        </p>
      </div>
    )}
    <form ref={form} action={action} onSubmit={beforeSubmit} className="mt-5">
      <input type="hidden" name="id" value={draft?.id ?? draftId} />
      <input type="hidden" name="version" value={draft?.version ?? ""} />
      <input ref={confirmationInput} type="hidden" name="confirmed" defaultValue="false" />
      <input type="hidden" name="attachment_ids" value={JSON.stringify(attachments)} />
      {draft && <input type="hidden" name="branch_id" value={branch} />}
      <fieldset disabled={busy} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Cabang<select name={draft ? undefined : "branch_id"} value={branch} disabled={Boolean(draft)} required className={input} onChange={event => { setBranch(event.target.value); if (attachments.length) { setAttachments([]); setBranchNotice("Cabang berubah. Unggah kembali lampiran untuk cabang yang dipilih.") } }}><option value="">Pilih cabang</option>{branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <div className={label}>Pilih Klien<ClientPicker value={client} onChange={setClient} disabled={busy || Boolean(draft)} /></div>
          <label className={label}>Judul penawaran<input name="title" required defaultValue={draft?.title} maxLength={300} className={input} /></label>
          <label className={label}>Daerah pengerjaan<input name="work_area" required defaultValue={draft?.work_area ?? ""} maxLength={1000} className={input} /></label>
        </div>
        <fieldset className="rounded-xl border border-line p-4"><legend className="px-1 text-sm font-semibold">Lingkup pekerjaan</legend><div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">{sphWorkScopes.map(scope => <label key={scope} className="flex items-center gap-2 text-sm"><input type="checkbox" name="work_scopes" value={scope} defaultChecked={draft?.work_scopes.includes(scope)} className="size-4 accent-brand" />{scope}</label>)}</div></fieldset>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={label}>Nilai SPH (Rp)<MoneyInput name="amount" min="0.01" required defaultValue={draft?.amount ?? ""} className={input} /></label>
          <label className={label}>Bidang usaha<input value={client?.industry ?? ""} readOnly className={`${input} bg-canvas`} placeholder="Otomatis dari klien" /></label>
          <label className={label}>Deal Project<select name="deal_status" defaultValue={draft?.deal_status ?? "belum_deal"} required className={input}><option value="belum_deal">Belum deal</option><option value="sudah_deal">Sudah deal</option></select></label>
          <label className={label}>Masa berlaku sampai<input name="valid_until" type="date" required defaultValue={draft?.valid_until ?? ""} className={input} /></label>
        </div>
        <p className="text-xs text-muted">Status deal merupakan informasi pekerjaan; persetujuan internal dan kesepakatan kedua pihak dicatat tersendiri.</p>
        <label className={label}>Informasi tambahan / arahan khusus<textarea name="notes" defaultValue={draft?.notes ?? ""} rows={4} maxLength={10000} className={input} placeholder="Informasi pendukung atau arahan direktur terkait penawaran." /></label>
        <DocumentUpload key={branch} branchId={branch} label="Dokumen kelengkapan SPH" attachments={attachments} onChange={setAttachments} onBusyChange={setUploading} disabled={busy || !branch} />
        {branchNotice && <p role="status" className="text-sm text-amber-800">{branchNotice}</p>}
        {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
        <div className="flex flex-wrap gap-3 border-t border-line pt-4">
          <button ref={draftButton} type="submit" name="intent" value="draft" formNoValidate className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {pending ? "Menyimpan…" : draft ? "Simpan Perubahan SPH" : "Simpan ke draft"}
          </button>
          {(!draft || ["draft", "revision_requested", "rejected"].includes(draft.status)) && (
            <button ref={submitButton} type="submit" name="intent" value="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {isFastTrack ? "Kirim Perbaikan Langsung ke Direktur Keuangan" : "Submit SPH"}
            </button>
          )}
        </div>
      </fieldset>
    </form>
    <dialog ref={dialog} aria-labelledby={`sph-confirm-${draftId}`} className="w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-white p-6 shadow-xl backdrop:bg-slate-900/40">
      <h3 id={`sph-confirm-${draftId}`} className="text-lg font-semibold">
        {isFastTrack ? "Kirim perbaikan langsung ke Direktur Keuangan?" : "Apakah data yang Anda masukkan sudah benar?"}
      </h3>
      <p className="mt-3 text-sm leading-6 text-muted">
        {isFastTrack
          ? "Pengajuan perbaikan ini akan langsung diajukan ke Direktur Keuangan (melewati Manager Cabang)."
          : "Pilih Ya untuk mengajukan SPH ke pemeriksa berikutnya. Pilih Tidak untuk menyimpan sebagai draft."}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={() => decide(true)} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
          {isFastTrack ? "Ya, ajukan langsung ke Direktur" : "Ya, ajukan SPH"}
        </button>
        <button type="button" onClick={() => decide(false)} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold">
          Tidak, simpan draft
        </button>
      </div>
    </dialog>
  </Card>
}
