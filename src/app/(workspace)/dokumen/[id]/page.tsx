import { notFound } from "next/navigation"
import { requireWorkspace } from "@/lib/auth/context"
import {
  recordSpecs,
  labels,
  displayValue,
  isWorkflowMissing,
  type WorkflowDocument,
} from "@/lib/workflow"
import { loadReferences } from "@/lib/workflow-server"
import { Card } from "@/components/ui/card"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { MigrationNotice } from "@/components/workflow/migration-notice"
import { RecordForm } from "@/components/workflow/record-form"
import { DocumentActions } from "@/components/workflow/document-actions"

type RequestRow = {
  id: string
  status: string
  required_role: string
  requested_by: string
  reviewed_by: string | null
  decision_note: string | null
  document_version: number
  created_at: string
  decided_at: string | null
  policy_snapshot: {
    version: number
    reviewer_role: string
    escalation_amount: number | null
  }
  document_snapshot: { payload: Record<string, unknown> }
}
const date = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value))

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}) {
  const [{ id }, query, { supabase, organizationId, user, role }] =
    await Promise.all([params, searchParams, requireWorkspace()])
  const { data, error } = await supabase
    .from("workflow_documents")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (isWorkflowMissing(error)) return <MigrationNotice />
  if (error || !data) notFound()
  const document = data as WorkflowDocument
  const spec = recordSpecs[document.record_type]
  const [requestResult, references] = await Promise.all([
    supabase
      .from("approval_requests")
      .select("*")
      .eq("document_id", id)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    loadReferences(supabase, organizationId, document.record_type),
  ])
  if (requestResult.error) throw new Error("Riwayat pengajuan gagal dimuat.")
  const requests = (requestResult.data ?? []) as RequestRow[]
  const current = requests.find(
    (request) => request.document_version === document.version,
  )
  const own = document.created_by === user.id
  const writer = spec.writers.includes(role)
  const canReview =
    document.state === "submitted" &&
    !!current &&
    current.required_role === role &&
    current.requested_by !== user.id
  const canExecute =
    document.state === "approved" &&
    !!current &&
    ((own && writer) || role === "owner" || role === current.required_role)
  const canEdit = own && writer && document.state === "draft"
  const editingDraft = canEdit && query.edit === "1"
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href={`/modul/${document.module_key}`}
        className="text-sm font-semibold text-brand"
      >
        ← Kembali ke modul
      </Link>
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              {spec.label} · {labels[document.operation]}
            </p>
            <h1 className="mt-2 text-3xl font-bold">{document.title}</h1>
            <p className="mt-2 text-sm text-muted">
              Versi dokumen {document.version}
              {document.operation === "update"
                ? ` · Berdasarkan record versi ${document.base_version}`
                : ""}
            </p>
          </div>
          <span className="rounded-full bg-brand-light px-4 py-2 text-sm font-semibold text-brand">
            {labels[document.state]}
          </span>
        </div>
        <ol className="mt-6 grid gap-2 sm:grid-cols-4">
          {[
            "draft",
            "submitted",
            document.state === "rejected" ? "rejected" : "approved",
            "executed",
          ].map((state, index) => (
            <li
              key={state}
              className={`rounded-lg border px-3 py-2 text-sm ${document.state === state ? "border-brand bg-brand-light font-semibold text-brand" : "border-line text-muted"}`}
            >
              {index + 1}. {labels[state]}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm leading-6 text-muted">
          {document.state === "draft"
            ? "Periksa isinya lalu ajukan pemeriksaan. Draft belum mengubah data resmi."
            : document.state === "rejected"
              ? "Dokumen ditolak. Pembuat dapat membuka revisi baru; persetujuan versi lama tidak berlaku untuk revisi."
              : document.state === "executed"
                ? `Data resmi telah diperbarui${document.executed_at ? ` pada ${date(document.executed_at)}` : ""}. Perubahan berikutnya harus melalui draft baru.`
                : "Isi dokumen terkunci. Keputusan dan eksekusi hanya berlaku untuk versi yang tercantum."}
        </p>
      </Card>
      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {editingDraft ? "Edit draft" : "Isi dokumen tersimpan"}
          </h2>
          {canEdit && !editingDraft && (
            <Link
              href={`/dokumen/${id}?edit=1`}
              className="text-sm font-semibold text-brand"
            >
              Edit draft
            </Link>
          )}
        </div>
        {editingDraft ? (
          <RecordForm
            key={`${document.id}-${document.version}`}
            type={document.record_type}
            values={document.payload}
            references={references}
            operation={document.operation}
            targetId={document.operation === "update" ? document.target_id : undefined}
            targetVersion={document.operation === "update" ? document.base_version : undefined}
            documentId={id}
            version={document.version}
          />
        ) : (
          <dl className="grid gap-5 sm:grid-cols-2">
            {spec.fields.map((field) => (
              <div key={field.name}>
                <dt className="text-xs text-muted">{field.label}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">
                  {references[field.name]?.find(
                    (option) => option.value === document.payload[field.name],
                  )?.label ?? displayValue(document.payload[field.name], field)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
      <Card className="p-6">
        <h2 className="mb-3 text-lg font-semibold">Tindakan dokumen</h2>
        {current && (
          <p className="mb-4 text-sm text-muted">
            Pemeriksa:{" "}
            <strong className="text-ink">
              {labels[current.required_role]}
            </strong>{" "}
            · Kebijakan versi {current.policy_snapshot?.version ?? "—"}.
            Pengaturan yang berlaku saat pengajuan disimpan bersama versi
            dokumen.
          </p>
        )}
        {editingDraft && (
          <p className="mb-4 text-sm text-muted">
            Simpan perubahan draft sebelum mengajukan pemeriksaan.
          </p>
        )}
        <DocumentActions
          id={id}
          version={document.version}
          canSubmit={canEdit && !editingDraft}
          canReview={canReview}
          canExecute={canExecute}
          canRevise={own && writer && document.state === "rejected"}
        />
        {!canEdit &&
          !canReview &&
          !canExecute &&
          !(own && writer && document.state === "rejected") && (
            <p className="text-sm text-muted">
              {document.state === "submitted"
                ? "Menunggu pemeriksa sesuai kebijakan. Pengaju tidak dapat menyetujui sendiri."
                : "Tidak ada tindakan yang tersedia untuk peran Anda pada status ini."}
            </p>
          )}
      </Card>
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Riwayat pengajuan</h2>
        {!requests.length && (
          <p className="mt-4 text-sm text-muted">
            Belum ada pengajuan yang dapat Anda akses.
          </p>
        )}
        <div className="mt-4 divide-y divide-line">
          {requests.map((request) => (
            <article key={request.id} className="py-4">
              <p className="text-sm font-semibold">
                Versi {request.document_version} · {labels[request.status]} ·
                Pemeriksa {labels[request.required_role]}
              </p>
              <p className="mt-1 text-xs text-muted">
                Diajukan {date(request.created_at)} oleh{" "}
                {request.requested_by.slice(0, 8)}
                {request.decided_at
                  ? ` · Diputuskan ${date(request.decided_at)} oleh ${request.reviewed_by?.slice(0, 8)}`
                  : ""}
              </p>
              {request.decision_note && (
                <p className="mt-3 whitespace-pre-wrap text-sm">
                  {request.decision_note}
                </p>
              )}
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-brand">
                  Isi versi yang diajukan
                </summary>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  {spec.fields.map((field) => (
                    <div key={field.name}>
                      <dt className="text-xs text-muted">{field.label}</dt>
                      <dd>
                        {displayValue(
                          request.document_snapshot?.payload?.[field.name],
                          field,
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            </article>
          ))}
        </div>
      </Card>
    </div>
  )
}
