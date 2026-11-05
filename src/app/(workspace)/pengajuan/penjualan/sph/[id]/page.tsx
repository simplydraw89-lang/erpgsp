import { formatCurrency } from "@/lib/money"
import { notFound } from "next/navigation"
import { requireWorkspace } from "@/lib/auth/context"
import { Card } from "@/components/ui/card"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { SalesMenu } from "@/components/sales/sales-menu"
import { SphReviewForm } from "@/components/sales/sph-review-form"
import { SphForm } from "@/components/sales/sph-form"
import { SubmitButton } from "@/components/procurement/submit-button"
import { ProcurementMessage } from "@/components/procurement/section-nav"
import { acceptSalesSph } from "@/app/(workspace)/pengajuan/penjualan/actions"
import { sphStatusLabels } from "@/lib/sales"
import { type BusinessUnit, type SalesDocument, procurementInput as input, procurementLabel as label } from "@/lib/procurement-ui"

export default async function SphPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const { supabase, organizationId, user, actorRole, isReadOnlyPreview } = await requireWorkspace()
  const result = await supabase.from("sales_documents").select("*").eq("id", id).eq("organization_id", organizationId).eq("kind", "sph").maybeSingle()
  if (result.error) throw new Error("SPH gagal dimuat. Periksa koneksi dan izin akses.")
  if (!result.data) notFound()
  const document = result.data as SalesDocument
  const [units, reader, reviewer, acceptor, events] = await Promise.all([
    supabase.from("business_units").select("id,code,name,kind").eq("organization_id", organizationId).eq("kind", "branch").order("code"),
    supabase.rpc("can_read_sales_clients", { p_org: organizationId }),
    supabase.rpc("sph_review_allowed", { p_id: id }),
    supabase.rpc("has_business_job", { p_org: organizationId, p_branch: document.branch_id, p_roles: ["president", "finance_director", "technical_director", "branch_manager"] }),
    supabase.from("procurement_events").select("id,action,note,actor_id,details,created_at").eq("organization_id", organizationId).eq("entity_id", id).order("created_at"),
  ])
  if ([units.error, reader.error, reviewer.error, acceptor.error, events.error].some(Boolean)) throw new Error("Detail pemeriksaan atau riwayat SPH gagal dimuat.")
  const canEdit = Boolean(reader.data) && ["draft", "revision_requested"].includes(document.status) && (document.created_by === user.id || actorRole === "owner")
  const fields = <><input type="hidden" name="document_id" value={id} /><input type="hidden" name="version" value={document.version} /></>
  return <div className="space-y-6">
    <Link href="/pengajuan/penjualan/sph" className="text-sm font-medium text-brand">← Daftar SPH</Link>
    <header><p className="text-sm text-brand">Penjualan</p><h1 className="mt-2 text-3xl font-bold">SPH No. {document.sph_number}</h1><p className="mt-2 text-sm text-muted">{sphStatusLabels[document.status] ?? document.status}</p></header>
    <SalesMenu active="sph" /><ProcurementMessage {...await searchParams} />
    <Card className="space-y-3 p-5"><h2 className="text-lg font-semibold">{document.title}</h2><p className="text-sm">Klien: {document.client_snapshot?.name ?? "Klien terdaftar"}</p><p className="text-sm">Cabang: {units.data?.find(branch => branch.id === document.branch_id)?.name}</p><dl className="grid gap-3 text-sm sm:grid-cols-2"><div>Daerah pengerjaan: {document.work_area || "Belum diisi"}</div><div>Bidang usaha: {document.client_snapshot?.industry || "Belum diisi"}</div><div>Lingkup: {document.work_scopes?.join(", ") || "Belum diisi"}</div><div>Deal Project: {document.deal_status === "sudah_deal" ? "Sudah deal" : document.deal_status === "belum_deal" ? "Belum deal" : "Belum diisi"}</div><div>Nilai SPH: {document.amount == null ? "Belum diisi" : formatCurrency(document.amount)}</div><div>Masa berlaku sampai: {document.valid_until || "Belum diisi"}</div></dl><p className="whitespace-pre-wrap text-sm text-muted">{document.notes}</p>{document.attachment_ids.map((attachment, index) => <a key={attachment} href={`/api/invoice-documents/${attachment}`} target="_blank" rel="noopener noreferrer" className="block text-sm font-medium text-brand">Buka dokumen kelengkapan {index + 1} ↗</a>)}</Card>
    {document.review_note && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Catatan pemeriksa: {document.review_note}</p>}
    {canEdit && <SphForm key={`${id}-${document.version}`} document={document} branches={(units.data ?? []).filter(branch => branch.id === document.branch_id) as BusinessUnit[]} draftId={id} disabled={isReadOnlyPreview} />}
    {Boolean(reviewer.data) && <Card className="p-5"><h2 className="font-semibold">{sphStatusLabels[document.status]}</h2><SphReviewForm id={id} version={document.version} disabled={isReadOnlyPreview} /></Card>}
    {["ready","accepted"].includes(document.status) && (document.created_by === user.id || actorRole === "owner") && !isReadOnlyPreview && <Link href={`/pengajuan/penjualan/spk/baru?sph=${id}`} className="inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Buat SPK →</Link>}
    {document.status === "ready" && Boolean(acceptor.data) && <Card className="p-5"><h2 className="font-semibold">Catat kesepakatan perusahaan dan klien</h2><p className="mt-2 text-sm text-muted">Persetujuan internal selesai. Status deal saja belum menjadi bukti kesepakatan kedua pihak.</p><form action={acceptSalesSph} className="mt-4 space-y-4">{fields}<fieldset disabled={isReadOnlyPreview} className="space-y-4"><label className={label}>Referensi bukti persetujuan kedua pihak<input name="acceptance_reference" required className={input} /></label><label className={label}>Tanggal kesepakatan<input name="accepted_on" type="date" required className={input} /></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" name="bilateral_confirmed" required className="mt-1" />Bukti persetujuan perusahaan dan klien telah saya periksa.</label><SubmitButton>Catat kesepakatan kedua pihak</SubmitButton></fieldset></form></Card>}
    <Card className="p-5"><h2 className="font-semibold">Riwayat SPH</h2><ol className="mt-4 space-y-4">{events.data?.map(event => <li key={event.id} className="border-l-2 border-line pl-4"><p className="text-sm font-medium" title={event.actor_id}>{event.action === "submitted" ? "SPH diajukan" : event.action === "approved" ? `Disetujui · ${sphStatusLabels[event.details?.from_status] ?? "Pemeriksa"}` : event.action === "revision_requested" ? "Diminta revisi" : event.action === "rejected" ? "Ditolak" : event.action === "mutual_acceptance_recorded" ? "Kesepakatan kedua pihak dicatat" : "Draft / lampiran disimpan"}</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted">{event.note}</p><time className="mt-1 block text-xs text-muted">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(event.created_at))}</time></li>)}</ol></Card>
  </div>
}
