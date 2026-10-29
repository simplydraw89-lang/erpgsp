import { requireWorkspace } from "@/lib/auth/context"
import { Card } from "@/components/ui/card"
import { ApprovalQueue } from "./queue"

export default async function ApprovalsPage() {
  const { supabase, organizationId } = await requireWorkspace()
  const { data: requests, error } = await supabase
    .from("approval_requests")
    .select("id, module_key, record_type, record_id, required_role, status, requested_by, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    throw new Error(`Gagal memuat antrean persetujuan: ${error.message}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-brand">Kontrol internal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Persetujuan</h1>
        <p className="mt-2 text-sm text-muted">
          Pemisahan pengaju dan penyetuju. Keputusan dicatat dalam jejak audit.
        </p>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-4 font-semibold">Permintaan</th>
                <th className="px-5 py-4 font-semibold">Modul</th>
                <th className="px-5 py-4 font-semibold">Peran pemeriksa</th>
                <th className="px-5 py-4 font-semibold">Diajukan</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(requests ?? []).map((request) => (
                <ApprovalQueue key={request.id} request={request} />
              ))}
              {!requests?.length && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-muted">
                    Belum ada permintaan persetujuan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
