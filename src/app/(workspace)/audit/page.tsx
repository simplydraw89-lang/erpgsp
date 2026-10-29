import { requireWorkspace } from "@/lib/auth/context"
import { Card } from "@/components/ui/card"

export default async function AuditPage() {
  const { supabase, organizationId } = await requireWorkspace()
  const { data: events, error } = await supabase
    .from("audit_events")
    .select("id, action, entity_type, entity_id, actor_id, details, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    throw new Error(`Gagal memuat jejak audit: ${error.message}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-brand">Akuntabilitas</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Jejak audit</h1>
        <p className="mt-2 text-sm text-muted">
          Catatan keputusan lintas modul yang tersedia untuk peran berwenang.
        </p>
      </div>
      <Card className="divide-y divide-line">
        {!events?.length && (
          <p className="px-6 py-14 text-center text-sm text-muted">Belum ada aktivitas audit.</p>
        )}
        {events?.map((event) => (
          <article key={event.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold capitalize text-ink">
                {event.action.replaceAll("_", " ")} · {event.entity_type}
              </p>
              <p className="mt-1 font-mono text-xs text-muted">{event.entity_id}</p>
              {event.details?.note && (
                <p className="mt-2 text-sm text-muted">{event.details.note}</p>
              )}
            </div>
            <time className="shrink-0 text-xs text-muted">
              {new Date(event.created_at).toLocaleString("id-ID")}
            </time>
          </article>
        ))}
      </Card>
    </div>
  )
}
