import { notFound } from "next/navigation"
import { requireWorkspace } from "@/lib/auth/context"
import { Card } from "@/components/ui/card"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { SalesMenu } from "@/components/sales/sales-menu"
import { SpkReviewForm } from "@/components/sales/spk-review-form"
import { SpkEditForm } from "@/components/sales/spk-edit-form"
import { SpkPrintTrigger } from "@/components/sales/spk-print-trigger"
import { AttachmentList, type AttachmentItem } from "@/components/sales/attachment-list"
import { ProcurementMessage } from "@/components/procurement/section-nav"
import { sphStatusLabels, spkStatusLabels, formatOfficialSalesNumber } from "@/lib/sales"
import { formatCurrency } from "@/lib/money"
import { type SalesDocument } from "@/lib/procurement-ui"
import { FolderCheck, ArrowRight, CheckCircle2, Edit3, ShieldAlert } from "lucide-react"
import { loadOrganizationActorDirectory, buildWorkflowAuditSummary } from "@/lib/audit-trail"
import { AuditWorkflowTimeline } from "@/components/procurement/audit-workflow-timeline"

export default async function SpkDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const { supabase, organizationId, user, isReadOnlyPreview } = await requireWorkspace()

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

  const [units, reviewerRes, editorRes, events, sphRes, projectRes, attachmentsRes, actorDir] = await Promise.all([
    supabase
      .from("business_units")
      .select("id,code,name,kind")
      .eq("organization_id", organizationId)
      .in("kind", ["branch", "center"])
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
          .select("id,sph_number,title,document_number,amount,created_at,client_snapshot")
          .eq("id", document.accepted_sph_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    document.project_id
      ? supabase
          .from("crm_projects")
          .select("id,code,name,status,approval_status")
          .eq("id", document.project_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    document.attachment_ids?.length
      ? supabase
          .from("procurement_attachments")
          .select("id,file_name,content_type,byte_size")
          .in("id", document.attachment_ids)
      : Promise.resolve({ data: [], error: null }),
    loadOrganizationActorDirectory(supabase, organizationId, user),
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
  const officialSphNumber = referencedSph
    ? formatOfficialSalesNumber(
        {
          ...referencedSph,
          client_snapshot: (referencedSph as any).client_snapshot || document.client_snapshot,
          created_at: (referencedSph as any).created_at || document.created_at,
        },
        "sph"
      )
    : null
  const officialSpkNumber = formatOfficialSalesNumber(
    {
      ...document,
      sph_number: document.sph_number ?? referencedSph?.sph_number ?? null,
    },
    "spk"
  )

  const canReview = Boolean(reviewerRes.data)
  const canEdit = Boolean(editorRes.data) && ["director_review", "revision_requested", "draft"].includes(document.status)

  const spkAuditSummary = buildWorkflowAuditSummary({
    entityKind: "spk",
    documentLabel: officialSpkNumber,
    currentStatus: document.status,
    createdByUserId: document.created_by,
    createdAt: document.created_at,
    returnToStage: document.return_to_stage,
    branchId: document.branch_id,
    branchName,
    events: (events.data ?? []) as any,
    actorMap: actorDir.actorMap,
    findRoleHolder: actorDir.findRoleHolder,
  })

  return (
    <div className="space-y-6">
      <Link href="/pengajuan/penjualan/spk" className="text-sm font-medium text-brand">
        ← Kembali ke Daftar SPK
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand">Penjualan & SPK</p>
          <h1 className="mt-2 text-3xl font-bold">
            {officialSpkNumber}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Status:{" "}
            <span className="font-semibold text-ink">
              {document.status === "director_review"
                ? "Menunggu Persetujuan Direktur Utama"
                : document.status === "draft"
                ? "Draft SPK (Belum diajukan)"
                : spkStatusLabels[document.status] ?? sphStatusLabels[document.status] ?? document.status}
            </span>
          </p>
        </div>
        <div>
          <SpkPrintTrigger
            document={{
              ...document,
              document_number: officialSpkNumber,
              sph_number: document.sph_number ?? referencedSph?.sph_number ?? null,
              sph_document_number: officialSphNumber,
              branch_name: branchName,
            }}
          />
        </div>
      </header>

      <SalesMenu active="spk" />
      <ProcurementMessage {...(await searchParams)} />

      {/* Banner status draft SPK */}
      {document.status === "draft" && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50/80 p-5 text-blue-950">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                Draft Dokumen SPK
              </span>
              <span className="rounded-full bg-blue-200 px-2 py-0.5 text-xs font-medium text-blue-800">
                Belum Diajukan
              </span>
            </div>
            <p className="mt-1 text-sm text-blue-900">
              Dokumen ini masih tersimpan sebagai draft dan belum dikirimkan ke Direktur Utama. Silakan periksa rincian atau perbarui dokumen di bawah, lalu klik <strong>Kirim Pengajuan SPK ke Direktur Utama</strong> untuk memulai persetujuan.
            </p>
          </div>
        </div>
      )}

      {/* Banner status entitas proyek terkait */}
      {createdProject && (() => {
        const pStatus = (createdProject as any).approval_status || createdProject.status;
        const isProjectActive = pStatus === "active";
        const isProjectReview = pStatus === "director_review";
        const isProjectRevision = pStatus === "revision_requested";

        return (
          <div className={`flex flex-wrap items-center justify-between gap-4 rounded-xl p-5 border ${
            isProjectActive
              ? "border-emerald-300 bg-emerald-50/90 text-emerald-950"
              : isProjectReview
              ? "border-indigo-300 bg-indigo-50/90 text-indigo-950"
              : isProjectRevision
              ? "border-orange-300 bg-orange-50/90 text-orange-950"
              : "border-amber-300 bg-amber-50/90 text-amber-950"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-white ${
                isProjectActive
                  ? "bg-emerald-600"
                  : isProjectReview
                  ? "bg-indigo-600"
                  : isProjectRevision
                  ? "bg-orange-600"
                  : "bg-amber-600"
              }`}>
                <FolderCheck size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {isProjectActive ? "Proyek Resmi Telah Aktif" : "Entitas Proyek Baru Dibuat"}
                  </span>
                  <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    isProjectActive
                      ? "bg-emerald-200 text-emerald-900 font-semibold"
                      : isProjectReview
                      ? "bg-indigo-200 text-indigo-900 font-semibold"
                      : isProjectRevision
                      ? "bg-orange-200 text-orange-900 font-semibold"
                      : "bg-amber-200 text-amber-950 font-semibold border border-amber-300"
                  }`}>
                    {isProjectActive ? (
                      <>
                        <CheckCircle2 size={12} /> Aktif & Berjalan
                      </>
                    ) : isProjectReview ? (
                      "⚡ Menunggu Persetujuan Direktur Utama"
                    ) : isProjectRevision ? (
                      "Perlu Revisi Dokumen"
                    ) : (
                      "Draft (Menunggu Dokumen Pendukung & RAB)"
                    )}
                  </span>
                </div>
                <h2 className="text-base font-bold text-ink">
                  {createdProject.code} · {createdProject.name}
                </h2>
                <p className="text-xs text-muted mt-0.5 max-w-2xl leading-5">
                  {isProjectActive
                    ? "Seluruh perencanaan & pagu RAB telah disetujui Direktur Utama. Proyek resmi berjalan dan akses portal klien aktif."
                    : isProjectReview
                    ? "Dokumen perencanaan proyek telah diajukan langsung ke Direktur Utama dan menunggu persetujuan (ACC)."
                    : isProjectRevision
                    ? "Direktur Utama meminta revisi pada dokumen perencanaan proyek."
                    : "Status proyek masih Draft. Cabang perlu melengkapi RAB, tim pelaksana, dan berkas pendukung untuk diajukan langsung ke Direktur Utama."}
                </p>
              </div>
            </div>
            <Link
              href={`/proyek/${createdProject.id}`}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow transition ${
                isProjectActive
                  ? "bg-emerald-700 hover:bg-emerald-800"
                  : isProjectReview
                  ? "bg-indigo-700 hover:bg-indigo-800"
                  : "bg-brand hover:bg-brand/90"
              }`}
            >
              {!isProjectActive && !isProjectReview
                ? "Lengkapi Dokumen Proyek →"
                : "Buka Manajemen Proyek →"}
            </Link>
          </div>
        );
      })()}

      {/* Rincian SPK */}
      <Card className="space-y-4 p-5">
        <div className="border-b border-line pb-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-brand">Rincian Dokumen SPK</span>
          <h2 className="text-xl font-bold text-ink">{document.title}</h2>
        </div>

        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <span className="text-xs font-medium text-muted">Nomor Resmi SPK:</span>
            <p className="font-semibold font-mono text-ink">{officialSpkNumber}</p>
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
            <span className="text-xs font-medium text-muted">Nilai Kontrak / SPK:</span>
            <p className="font-semibold text-brand">
              {formatCurrency(document.amount || referencedSph?.amount || 0)}
            </p>
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
                {officialSphNumber || `SPH No. ${referencedSph.sph_number}`} · {referencedSph.title}
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

      {/* Review Form khusus Direktur Utama (atau Super Admin) */}
      {canReview && document.status === "director_review" && (
        <Card className="border-amber-200 bg-amber-50/40 p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
              !
            </span>
            <h2 className="text-lg font-bold text-amber-950">
              Validasi & Persetujuan SPK (Direktur Utama)
            </h2>
          </div>
          <p className="mt-1 text-sm text-amber-800">
            Persetujuan dokumen kontrak/perintah kerja oleh Direktur Utama. Menyetujui SPK ini akan <strong>secara otomatis membuat entitas Proyek Baru</strong> dengan kode proyek resmi dan mengalokasikannya ke cabang terkait.
          </p>
          <SpkReviewForm id={id} version={document.version} disabled={isReadOnlyPreview} />
        </Card>
      )}

      {/* Penjelasan jika dibuka oleh user selain Direktur Utama saat menunggu persetujuan */}
      {!canReview && document.status === "director_review" && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-xs text-blue-900">
          <ShieldAlert size={18} className="text-blue-700 shrink-0" />
          <p>
            <strong>Kewenangan Direktur Utama:</strong> Dokumen SPK ini telah diajukan dan sedang menunggu persetujuan langsung dari <strong>Direktur Utama</strong> untuk penerbitan proyek resmi.
          </p>
        </div>
      )}

      {/* Form Edit Rincian SPK untuk Direktur Utama / Pengaju */}
      {canEdit && (
        <Card className="p-5">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <Edit3 size={18} className="text-brand" />
            <h2 className="font-semibold text-ink">
              {canReview ? "Penyesuaian Data SPK oleh Direktur Utama" : "Edit Rincian SPK"}
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
            status={document.status}
            disabled={isReadOnlyPreview}
            roleHint={
              canReview
                ? "Sebagai Direktur Utama, Anda dapat memperbarui judul, catatan, dan lampiran berkas SPK ini sebelum memberikan persetujuan."
                : undefined
            }
          />
        </Card>
      )}

      {/* Catatan Keputusan / Review sebelumnya */}
      {document.review_note && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Catatan Direktur Utama:</strong> {document.review_note}
        </div>
      )}

      {/* Riwayat SPK, Posisi Dokumen & KPI Waktu Pengerjaan */}
      <AuditWorkflowTimeline
        summary={spkAuditSummary}
        title="Riwayat SPK, Posisi Dokumen & KPI Waktu Pengerjaan"
      />
    </div>
  )
}
