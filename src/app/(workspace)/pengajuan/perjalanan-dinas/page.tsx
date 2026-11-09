import { requireWorkspace } from "@/lib/auth/context"
import { Card } from "@/components/ui/card"
import { SppdAdvanceForm, type SppdProjectOption } from "@/components/procurement/sppd-advance-form"
import { ProcurementMessage } from "@/components/procurement/section-nav"
import { type BusinessUnit, rupiah, formatDateID } from "@/lib/procurement-ui"
import { Plane, Calendar, MapPin, CheckCircle2, Clock, FileText, ArrowRight } from "lucide-react"
import Link from "next/link"

export default async function PerjalananDinasPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const q = await searchParams
  const { supabase, organizationId, user, actorRole, isReadOnlyPreview, workAssignments } = await requireWorkspace()

  const [unitsRes, projectsRes, advancesRes] = await Promise.all([
    supabase
      .from("business_units")
      .select("id,code,name,kind")
      .eq("organization_id", organizationId)
      .in("kind", ["branch", "center"])
      .order("code"),
    supabase
      .from("crm_projects")
      .select("id,code,name,branch_id,contract_amount,rab_total")
      .eq("organization_id", organizationId)
      .eq("approval_status", "active")
      .order("code", { ascending: false }),
    supabase
      .from("cash_advances")
      .select(`
        id, advance_number, sppd_number, description, amount, needed_on,
        departure_on, return_on, trip_destination, advance_status, created_at,
        project:crm_projects(id, code, name)
      `)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(50),
  ])

  const central =
    actorRole === "owner" ||
    (workAssignments ?? []).some(
      (job) =>
        !job.branch_id &&
        ["president", "finance_director", "technical_director", "finance", "accounting_tax"].includes(job.job_role)
    )

  const branches = ((unitsRes.data ?? []) as BusinessUnit[]).filter(
    (b) => central || (workAssignments ?? []).some((j) => j.branch_id === b.id)
  )

  const projects: SppdProjectOption[] = (projectsRes.data ?? []).map((p: any) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    branch_id: p.branch_id,
    contract_amount: Number(p.contract_amount || 0),
    rab_total: Number(p.rab_total || 0),
  }))

  const advances = advancesRes.data ?? []

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-brand">Pengajuan Lapangan</p>
        <h1 className="mt-2 text-3xl font-bold">Perjalanan Dinas & Kasbon (SPPD)</h1>
        <p className="mt-2 text-sm text-muted">
          Penerbitan dokumen SPPD dan pencairan uang muka kasbon lapangan yang langsung terintegrasi dengan pemotongan pagu RAB proyek.
        </p>
      </header>

      <ProcurementMessage error={q.error} notice={q.notice} />

      <SppdAdvanceForm
        branches={branches}
        projects={projects}
        disabled={isReadOnlyPreview || !branches.length}
      />

      {/* Riwayat SPPD & Kasbon */}
      <Card className="p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-ink">Daftar Pengajuan SPPD & Kasbon Lapangan</h2>
            <p className="text-xs text-muted">
              Seluruh transaksi kasbon yang diajukan dan realisasi pemotongan pagu proyek yang terkait.
            </p>
          </div>
          <span className="text-xs font-semibold text-muted bg-slate-100 px-2.5 py-1 rounded-full">
            Total {advances.length} Pengajuan
          </span>
        </div>

        {advances.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted">
            Belum ada pengajuan SPPD atau kasbon operasional yang dicatat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-canvas text-slate-700">
                <tr>
                  <th className="p-3">No. SPPD / Kasbon</th>
                  <th className="p-3">Proyek Terkait</th>
                  <th className="p-3">Tujuan & Jadwal</th>
                  <th className="p-3">Keperluan</th>
                  <th className="p-3 text-right">Nominal</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {advances.map((item: any) => {
                  const proj = Array.isArray(item.project) ? item.project[0] : item.project
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="p-3">
                        <span className="font-mono font-bold text-brand block">
                          {item.sppd_number || item.advance_number}
                        </span>
                        {item.sppd_number && (
                          <span className="font-mono text-[11px] text-muted block">
                            KB: {item.advance_number}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {proj ? (
                          <Link
                            href={`/proyek/${proj.id}`}
                            className="font-medium text-brand hover:underline block"
                          >
                            <span className="font-mono font-semibold">{proj.code}</span>
                            <span className="block text-[11px] text-muted truncate max-w-[200px]">
                              {proj.name}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-muted italic">Non-Proyek</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-slate-800 block">
                          {item.trip_destination || "-"}
                        </span>
                        <span className="text-[11px] text-muted block">
                          {item.departure_on ? formatDateID(item.departure_on) : ""}
                          {item.return_on ? ` s/d ${formatDateID(item.return_on)}` : ""}
                        </span>
                      </td>
                      <td className="p-3 max-w-[240px]">
                        <p className="truncate text-slate-700" title={item.description}>
                          {item.description}
                        </p>
                      </td>
                      <td className="p-3 text-right font-semibold text-ink">
                        {rupiah(Number(item.amount || 0))}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            item.advance_status === "settled"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.advance_status === "disbursed"
                              ? "bg-blue-100 text-blue-800"
                              : item.advance_status === "approved"
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {item.advance_status === "settled"
                            ? "Selesai (Pertanggungjawaban)"
                            : item.advance_status === "disbursed"
                            ? "Dicairkan"
                            : item.advance_status === "approved"
                            ? "Disetujui"
                            : item.advance_status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
