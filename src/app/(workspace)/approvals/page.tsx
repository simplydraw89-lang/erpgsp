import { requireWorkspace } from "@/lib/auth/context"
import { Card } from "@/components/ui/card"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { MigrationNotice } from "@/components/workflow/migration-notice"
import {
  isWorkflowMissing,
  labels,
  recordSpecs,
  type WorkflowDocument,
} from "@/lib/workflow"

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>
}) {
  const [{ supabase, organizationId, user, role }, query] = await Promise.all([
    requireWorkspace(),
    searchParams,
  ])
  const scope = ["mine", "drafts", "review"].includes(query.scope ?? "")
    ? query.scope
    : "all"
  let documentsQuery = supabase
    .from("workflow_documents")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(100)
  if (scope === "mine" || scope === "drafts")
    documentsQuery = documentsQuery.eq("created_by", user.id)
  if (scope === "drafts") documentsQuery = documentsQuery.eq("state", "draft")
  if (scope === "review") {
    const requests = await supabase
      .from("approval_requests")
      .select("document_id")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .eq("required_role", role)
      .neq("requested_by", user.id)
      .order("created_at")
      .limit(100)
    if (isWorkflowMissing(requests.error)) return <MigrationNotice />
    if (requests.error) throw new Error("Antrean pemeriksaan gagal dimuat.")
    const ids = (requests.data ?? []).flatMap((request) =>
      request.document_id ? [request.document_id] : [],
    )
    documentsQuery = documentsQuery.in(
      "id",
      ids.length ? ids : ["00000000-0000-0000-0000-000000000000"],
    )
  }
  const { data, error } = await documentsQuery
  if (isWorkflowMissing(error)) return <MigrationNotice />
  if (error) throw new Error("Dokumen persetujuan gagal dimuat.")
  const documents = (data ?? []) as WorkflowDocument[]
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand">Kontrol internal</p>
          <h1 className="mt-2 text-3xl font-bold">Pusat persetujuan</h1>
          <p className="mt-2 text-sm text-muted">
            Buka dokumen untuk melihat isinya, versi, kebijakan pemeriksa, dan
            riwayat keputusan.
          </p>
        </div>
        <Link
          href="/pengaturan/persetujuan"
          className="rounded-lg border border-line bg-white px-4 py-2 text-sm"
        >
          Kebijakan pemeriksa
        </Link>
      </div>
      <nav aria-label="Filter pengajuan" className="flex flex-wrap gap-2">
        {[
          { value: "all", name: "Semua dokumen" },
          { value: "mine", name: "Pengajuan saya" },
          { value: "drafts", name: "Draft saya" },
          { value: "review", name: "Perlu pemeriksaan" },
        ].map((tab) => (
          <Link
            key={tab.value}
            href={
              tab.value === "all"
                ? "/approvals"
                : `/approvals?scope=${tab.value}`
            }
            aria-current={scope === tab.value ? "page" : undefined}
            className={`rounded-lg border px-4 py-2 text-sm ${scope === tab.value ? "border-brand bg-brand-light font-semibold text-brand" : "border-line bg-white text-muted"}`}
          >
            {tab.name}
          </Link>
        ))}
      </nav>
      <div className="grid gap-3 sm:grid-cols-5">
        {["draft", "submitted", "approved", "rejected", "executed"].map(
          (state) => (
            <Card key={state} className="p-4">
              <p className="text-xs text-muted">{labels[state]}</p>
              <p className="mt-2 text-2xl font-bold">
                {
                  documents.filter((document) => document.state === state)
                    .length
                }
              </p>
            </Card>
          ),
        )}
      </div>
      <p className="text-xs text-muted">
        Ringkasan dari maksimal 100 dokumen terbaru yang dapat Anda akses.
      </p>
      <Card className="divide-y divide-line">
        {!documents.length && (
          <p className="p-8 text-sm text-muted">
            Belum ada dokumen. Buat draft dari modul terkait.
          </p>
        )}
        {documents.map((document) => (
          <Link
            key={document.id}
            href={`/dokumen/${document.id}`}
            className="flex items-center justify-between gap-4 p-5 hover:bg-canvas"
          >
            <div>
              <p className="font-semibold">{document.title}</p>
              <p className="mt-1 text-xs text-muted">
                {recordSpecs[document.record_type].label} ·{" "}
                {labels[document.operation]} · Versi {document.version}
              </p>
            </div>
            <span className="rounded-full bg-brand-light px-3 py-1 text-xs text-brand">
              {labels[document.state]} →
            </span>
          </Link>
        ))}
      </Card>
    </div>
  )
}
