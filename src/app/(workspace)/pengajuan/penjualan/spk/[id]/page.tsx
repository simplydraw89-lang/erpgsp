import { notFound } from "next/navigation"
import { requireWorkspace } from "@/lib/auth/context"
import { Card } from "@/components/ui/card"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { SalesMenu } from "@/components/sales/sales-menu"
import { SpkReviewForm } from "@/components/sales/spk-review-form"
import { SpkEditForm } from "@/components/sales/spk-edit-form"
import { AttachmentList, type AttachmentItem } from "@/components/sales/attachment-list"
import { ProcurementMessage } from "@/components/procurement/section-nav"
import { sphStatusLabels } from "@/lib/sales"
import { type SalesDocument } from "@/lib/procurement-ui"
import { FolderCheck, ArrowRight, CheckCircle2, Edit3, ShieldAlert } from "lucide-react"

export default async function SpkDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const { supabase, organizationId, workAssignments, isReadOnlyPreview } = await requireWorkspace()

  const result = await supabase
    .from("sales_documents")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("kind", "spk")
    .maybeSingle()

  if (result.error) throw new Error("SPK gagal dimuat. Periksa koneksi dan izin akses.")
  if (!result.data) notFound()
  const document = result.data as SalesDocument

  const [units, reviewerRes, editorRes, events, sphRes, projectRes, attachmentsRes] = await Promise.all([
    supabase
      .from("business_units")
      .select("id,code,name,kind")
      .eq("organization_id", organizationId)
      .eq("kind", "branch")
      .order("code"),
    supabase.rpc("spk_review_allowed", { p_id: id }),
    supabase.rpc("spk_edit_allowed", { p_id: id }),
    supabase
      .from("procurement_events")
      .select("id,action,note,actor_id,details,created_at")
      .eq("organization_id", organizationId)
      .eq("entity_id", id)
      .order("created_at"),
    document.accepted_sph_id
      ? supabase
          .from("sales_documents")
          .select("id,sph_number,title,document_number,amount")
          .eq("id", document.accepted_sph_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    document.project_id
      ? supabase
          .from("crm_projects")
          .select("id,code,name,status")
          .eq("id", document.project_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    document.attachment_ids?.length
      ? supabase
          .from("procurement_attachments")
          .select("id,file_name,content_type,byte_size")
          .in("id", document.attachment_ids)
      : Promise.resolve({ data: [], error: null }),
  ])

  const attachmentItems: AttachmentItem[] = (attachmentsRes.data ?? []).map((a) => ({
    id: a.id,
    file_name: a.file_name,
    content_type: a.content_type,
    byte_size: Number(a.byte_size),
  }))

  const branchName = units.data?.find((b) => b.id === document.branch_id)?.name ?? "Cabang"
  const createdProject = projectRes.data
  const referencedSph = sphRes.data

  const isFinanceDirector = workAssignments.some((job) => job.job_role === "finance_director")
  const canReview = Boolean(reviewerRes.data)
  const canEdit = Boolean(editorRes.data) && ["director_review", "revision_requested", "draft"].includes(document.status)

  return (
    <div className="space-y-6">
      <Link href="/pengajuan/penjualan/spk" className="text-sm font-medium text-brand">
        ← Kembali ke Daftar SPK
      </Link>

      <header>
        <p className="text-sm font-medium text-brand">Penjualan & SPK</p>
        <h1 className="mt-2 text-3xl font-bold">
          {document.document_number ? document.document_number : `SPK: ${document.title}`}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Status:{" "}
          <span className="font-semibold text-ink">
            {document.status === "director_review"
              ? "Menunggu Validasi Direktur Utama / Direktur Teknis"
              : sphStatusLabels[document.status] ?? document.status}
          </span>
        </p>
      </header>

      <SalesMenu active="spk" />
      <ProcurementMessage {...(await searchParams)} />

      {/* Banner jika proyek sudah otomatis terbuat */}
      {createdProject && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-300 bg-emerald-50/80 p-5 text-emerald-950">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <FolderCheck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  Proyek Resmi Telah Dibuat
                </span>
                <span className="flex items-center gap-1 rounded-full bg-emerald-200/80 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  <CheckCircle2 size={12} /> Aktif
                </span>
              </div>
              <h2 className="text-base font-bold text-emerald-950">
                {createdProject.code} · {createdProject.name}
              </h2>
            </div>
          </div>
          <Link
            href={`/portal-proyek?project=${createdProject.id}`}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-800"
          >
            Buka Portal Proyek <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {/* Rincian SPK */}
      <Card className="space-y-4 p-5">
        <div className="border-b border-line pb-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-brand">Rincian Dokumen SPK</span>
          <h2 className="text-xl font-bold text-ink">{document.title}</h2>
        </div>

        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <span className="text-xs font-medium text-muted">Nomor Resmi SPK:</span>
            <p className="font-semibold text-ink">{document.document_number || "Menunggu penomoran"}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-muted">Cabang Operasional:</span>
            <p className="font-semibold text-ink">{branchName}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-muted">Klien Mitra:</span>
            <p className="font-semibold text-ink">{document.client_snapshot?.name || "Klien terdaftar"}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-muted">Diterbitkan Oleh:</span>
            <p className="font-semibold text-ink">
              {document.source === "client" ? "Klien" : "Perusahaan"}
            </p>
          </div>
          {referencedSph && (
            <div className="sm:col-span-2 rounded-lg bg-canvas p-3 border border-line">
              <span className="text-xs font-medium text-muted">Rujukan SPH yang Disetujui:</span>
              <p className="font-semibold text-ink">
                SPH No. {referencedSph.sph_number} {referencedSph.document_number ? `(${referencedSph.document_number})` : ""} · {referencedSph.title}
              </p>
            </div>
          )}
        </dl>

        {document.notes && (
          <div className="pt-2">
            <span className="text-xs font-medium text-muted">Catatan & Informasi Tambahan:</span>
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-canvas p-3 text-sm text-ink border border-line">
              {document.notes}
            </p>
          </div>
        )}

        <div className="pt-2">
          <AttachmentList
            attachments={attachmentItems}
            title="Dokumen Lampiran SPK (Surat Perintah Kerja & Berkas Pendukung)"
          />
        </div>
      </Card>

      {/* Review Form khusus Direktur Utama / Direktur Teknis */}
      {canReview && document.status === "director_review" && (
        <Card className="border-amber-200 bg-amber-50/40 p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
              !
            </span>
            <h2 className="text-lg font-bold text-amber-950">
              Validasi & Persetujuan SPK (Direktur Utama / Direktur Teknis)
            </h2>
          </div>
          <p className="mt-1 text-sm text-amber-800">
            Validasi dokumen kontrak/perintah kerja. Menyetujui SPK ini akan <strong>secara otomatis membuat entitas Proyek Baru</strong> dengan kode proyek resmi dan mengalokasikannya ke cabang terkait.
          </p>
          <SpkReviewForm id={id} version={document.version} disabled={isReadOnlyPreview} />
        </Card>
      )}

      {/* Info jika dilihat oleh Direktur Keuangan saat menunggu approval */}
      {isFinanceDirector && !canReview && document.status === "director_review" && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-xs text-blue-900">
          <ShieldAlert size={18} className="text-blue-700 shrink-0" />
          <p>
            <strong>Akses Direktur Keuangan:</strong> Anda berwenang mengubah rincian dan lampiran SPK ini melalui formulir di bawah. Hak validasi & persetujuan untuk menerbitkan proyek berada pada Direktur Utama / Direktur Teknis.
          </p>
        </div>
      )}

      {/* Form Edit Rincian SPK untuk Direktur Keuangan / Pengaju */}
      {canEdit && (
        <Card className="p-5">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <Edit3 size={18} className="text-brand" />
            <h2 className="font-semibold text-ink">
              {isFinanceDirector ? "Penyesuaian Data SPK oleh Direktur Keuangan" : "Edit Rincian SPK"}
            </h2>
          </div>
          <SpkEditForm
            id={id}
            version={document.version}
            branchId={document.branch_id}
            initialTitle={document.title}
            initialSource={document.source}
            initialNotes={document.notes || ""}
            initialAttachments={document.attachment_ids || []}
            disabled={isReadOnlyPreview}
            roleHint={
              isFinanceDirector
                ? "Sebagai Direktur Keuangan, Anda dapat memperbarui judul, catatan, dan lampiran berkas SPK ini sebelum divalidasi oleh Direktur Utama / Direktur Teknis."
                : undefined
            }
          />
        </Card>
      )}

      {/* Catatan Keputusan / Review sebelumnya */}
      {document.review_note && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Catatan Direksi:</strong> {document.review_note}
        </div>
      )}

      {/* Riwayat SPK */}
      <Card className="p-5">
        <h2 className="font-semibold text-ink">Riwayat Pemeriksaan & Tindakan SPK</h2>
        <ol className="mt-4 space-y-4">
          {events.data?.map((event) => (
            <li key={event.id} className="border-l-2 border-line pl-4">
              <p className="text-sm font-medium text-ink">
                {event.action === "submitted_to_director"
                  ? "SPK diajukan ke Direktur Utama / Direktur Teknis"
                  : event.action === "approved"
                  ? "SPK divalidasi & disetujui · Proyek resmi dibuat otomatis"
                  : event.action === "revision_requested"
                  ? "Diminta revisi oleh Direksi"
                  : event.action === "rejected"
                  ? "Ditolak oleh Direksi"
                  : event.action === "updated"
                  ? "Rincian SPK disesuaikan / diperbarui"
                  : "Draft SPK disimpan"}
              </p>
              {event.note && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{event.note}</p>}
              <time className="mt-1 block text-xs text-muted">
                {new Intl.DateTimeFormat("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Bangkok",
                }).format(new Date(event.created_at))}
              </time>
            </li>
          ))}
          {!events.data?.length && (
            <p className="text-xs text-muted">Belum ada riwayat aktivitas tercatat.</p>
          )}
        </ol>
      </Card>
    </div>
  )
}
