import Link from "next/link"
import { notFound } from "next/navigation"
import { BriefcaseBusiness, CheckCircle2, Clock, AlertTriangle, FileText, ArrowLeft, Users, Calendar, Calculator, ShieldCheck, Receipt } from "lucide-react"
import { Card } from "@/components/ui/card"
import { requireWorkspace } from "@/lib/auth/context"
import { rupiah, formatDateID } from "@/lib/procurement-ui"
import { ProjectPlanningForm } from "@/components/project/project-planning-form"
import { ProjectReviewForm } from "@/components/project/project-review-form"

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const { id } = await params
  const qParams = await searchParams
  const { supabase, organizationId, user, actorRole, isReadOnlyPreview, workAssignments } = await requireWorkspace()

  // Load project details
  const { data: project, error } = await supabase
    .from("crm_projects")
    .select(`
      *,
      client:sales_clients(name, contact, email),
      branch:business_units(code, name),
      spk:sales_documents!crm_projects_spk_id_fkey(id, document_number, title, amount, valid_until)
    `)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle()

  if (error || !project) {
    notFound()
  }

  // Load procurement / audit events
  const { data: events } = await supabase
    .from("procurement_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(20)

  // Roles & permissions
  const isOwner = actorRole === "owner"
  const isDirut = (workAssignments ?? []).some((j) => !j.branch_id && j.job_role === "president")
  const isDirector = (workAssignments ?? []).some(
    (j) => !j.branch_id && ["president", "technical_director", "finance_director"].includes(j.job_role)
  )
  const isBranchUser = (workAssignments ?? []).some((j) => j.branch_id === project.branch_id)

  const canEdit =
    !isReadOnlyPreview &&
    ["draft", "revision_requested"].includes(project.approval_status) &&
    (isOwner || isBranchUser || project.created_by === user.id)

  const canReview = !isReadOnlyPreview && project.approval_status === "director_review" && (isOwner || isDirut)

  const contractVal = Number(project.contract_amount) || 0
  const rabVal = Number(project.rab_total) || 0
  const margin = contractVal > 0 ? ((contractVal - rabVal) / contractVal) * 100 : 0

  const status = project.approval_status || (project.status === "active" ? "active" : "draft")

  return (
    <div className="space-y-6">
      <Link href="/proyek" className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline font-medium">
        <ArrowLeft className="size-4" /> Kembali ke Daftar Proyek
      </Link>

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-100 px-2.5 py-1 text-xs font-mono font-semibold text-slate-800">
              {project.code}
            </span>
            <span className="text-xs font-medium text-muted">Cabang: {project.branch?.name || "Pusat"}</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold text-ink">{project.name}</h1>
          <p className="mt-1 text-sm text-muted">
            Klien: <span className="font-medium text-slate-800">{project.client?.name || "Klien Terdaftar"}</span>
          </p>
        </div>

        <div className="flex flex-col items-end">
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${
              status === "active"
                ? "bg-emerald-100 text-emerald-800"
                : status === "director_review"
                ? "bg-indigo-100 text-indigo-800"
                : status === "revision_requested"
                ? "bg-amber-100 text-amber-800"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {status === "active"
              ? "Proyek Aktif (ACC Dirut)"
              : status === "director_review"
              ? "Menunggu Verifikasi Dirut"
              : status === "revision_requested"
              ? "Perlu Revisi Cabang"
              : "Draft Mobilisasi Cabang"}
          </span>
          <span className="text-[11px] text-muted mt-1">Versi Dokumen: {project.version}</span>
        </div>
      </header>

      {qParams.notice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {qParams.notice}
        </div>
      )}
      {qParams.error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {qParams.error}
        </div>
      )}

      {/* Catatan Review Jika Ada */}
      {project.review_note && (
        <Card className="border-amber-200 bg-amber-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Catatan Direktur Utama / Pemeriksa</p>
          <p className="mt-1.5 text-sm text-amber-950 whitespace-pre-wrap leading-6">{project.review_note}</p>
        </Card>
      )}

      {/* Reference Card: SPK & Kontrak */}
      <Card className="p-5 grid gap-4 sm:grid-cols-4 bg-slate-50/50">
        <div>
          <p className="text-xs text-muted">Referensi Dokumen SPK</p>
          <p className="mt-1 text-sm font-semibold text-brand">
            {project.spk ? (
              <Link href={`/pengajuan/penjualan/spk/${project.spk.id}`} className="hover:underline">
                {project.spk.document_number || project.spk.title}
              </Link>
            ) : (
              "SPK Terkait"
            )}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Nilai Kontrak Disepakati</p>
          <p className="mt-1 text-sm font-semibold text-ink">{rupiah(contractVal)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Total Pagu Anggaran (RAB)</p>
          <p className="mt-1 text-sm font-semibold text-brand">{rupiah(rabVal)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Estimasi Margin Laba</p>
          <p
            className={`mt-1 text-sm font-bold ${
              margin >= 25 ? "text-emerald-600" : margin > 0 ? "text-amber-600" : "text-red-600"
            }`}
          >
            {margin.toFixed(2)}%
          </p>
        </div>
      </Card>

      {/* JIKA STATUS DRAFT / REVISI: Tampilkan Form Perencanaan untuk Cabang */}
      {canEdit && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-ink">Lengkapi Data Perencanaan Proyek</h2>
            <span className="text-xs text-muted">
              Wajib melengkapi SDM, rincian teknis pengerjaan, timesheet jadwal, dan rincian RAB sebelum diajukan.
            </span>
          </div>
          <ProjectPlanningForm project={project} disabled={isReadOnlyPreview} />
        </section>
      )}

      {/* JIKA STATUS MENUNGGU REVIEW DIREKSI: Tampilkan Review Form untuk Dirut */}
      {canReview && (
        <section className="space-y-4">
          <ProjectReviewForm projectId={project.id} version={project.version} disabled={isReadOnlyPreview} />
        </section>
      )}

      {/* JIKA BUKAN MODE EDIT: Tampilkan Rangkuman Perencanaan (Read-Only) */}
      {!canEdit && (
        <div className="space-y-6">
          {status === "active" && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50/60 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-6 text-emerald-600" />
                <div>
                  <h3 className="font-semibold text-emerald-950">Pagu Anggaran RAB Terkunci (Budget Baseline)</h3>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Proyek ini telah diverifikasi dan disetujui secara resmi oleh Direktur Utama. Seluruh pengeluaran pembelian & kasbon proyek akan diverifikasi terhadap pagu ini.
                  </p>
                </div>
              </div>
              <Link
                href={`/portal-proyek?project=${project.id}`}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition"
              >
                Buka Portal Proyek →
              </Link>
            </div>
          )}

          {/* Readonly: SDM Tim Proyek */}
          <Card className="p-5 space-y-3">
            <h3 className="font-semibold text-ink flex items-center gap-2">
              <Users className="size-4 text-brand" /> 1. Alokasi SDM / Man Power Proyek
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas text-muted">
                  <tr>
                    <th className="px-3 py-2">No</th>
                    <th className="px-3 py-2">Nama Personil</th>
                    <th className="px-3 py-2">Peran di Proyek</th>
                    <th className="px-3 py-2">Sertifikasi / Keahlian</th>
                    <th className="px-3 py-2">Durasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(project.manpower || []).map((m: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 text-muted">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-ink">{m.name}</td>
                      <td className="px-3 py-2">{m.role}</td>
                      <td className="px-3 py-2">{m.certification || "-"}</td>
                      <td className="px-3 py-2">{m.duration || "-"}</td>
                    </tr>
                  ))}
                  {(!project.manpower || project.manpower.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-muted">
                        Belum ada personil yang ditugaskan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Readonly: Rincian Teknis & Deliverables */}
          <Card className="p-5 space-y-3">
            <h3 className="font-semibold text-ink flex items-center gap-2">
              <FileText className="size-4 text-brand" /> 2. Rincian Teknis & Deliverables Pekerjaan
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 text-xs text-muted mb-2">
              <p>Mulai: <span className="font-medium text-ink">{project.starts_on ? formatDateID(project.starts_on) : "Belum ditentukan"}</span></p>
              <p>Target Selesai: <span className="font-medium text-ink">{project.ends_on ? formatDateID(project.ends_on) : "Belum ditentukan"}</span></p>
            </div>
            <p className="whitespace-pre-wrap text-xs leading-6 text-slate-800 bg-slate-50 p-4 rounded-lg border border-line">
              {project.work_details || "Belum ada rincian teknis."}
            </p>
          </Card>

          {/* Readonly: Jadwal & Timesheet */}
          <Card className="p-5 space-y-3">
            <h3 className="font-semibold text-ink flex items-center gap-2">
              <Calendar className="size-4 text-brand" /> 3. Jadwal & Milestones Tahapan
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas text-muted">
                  <tr>
                    <th className="px-3 py-2">No</th>
                    <th className="px-3 py-2">Nama Tahapan</th>
                    <th className="px-3 py-2">Tanggal Mulai</th>
                    <th className="px-3 py-2">Target Selesai</th>
                    <th className="px-3 py-2">PIC Pelaksana</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(project.timesheet_schedule || []).map((s: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 text-muted">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-ink">{s.phase}</td>
                      <td className="px-3 py-2">{s.start_date ? formatDateID(s.start_date) : "-"}</td>
                      <td className="px-3 py-2">{s.end_date ? formatDateID(s.end_date) : "-"}</td>
                      <td className="px-3 py-2">{s.pic || "-"}</td>
                    </tr>
                  ))}
                  {(!project.timesheet_schedule || project.timesheet_schedule.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-muted">
                        Belum ada jadwal tahapan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Readonly: RAB Pos Biaya */}
          <Card className="p-5 space-y-3">
            <h3 className="font-semibold text-ink flex items-center gap-2">
              <Calculator className="size-4 text-brand" /> 4. Rincian Rencana Anggaran Biaya (RAB)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas text-muted">
                  <tr>
                    <th className="px-3 py-2">Kategori</th>
                    <th className="px-3 py-2">Uraian Kebutuhan</th>
                    <th className="px-3 py-2 text-right">Volume</th>
                    <th className="px-3 py-2">Satuan</th>
                    <th className="px-3 py-2 text-right">Harga Satuan</th>
                    <th className="px-3 py-2 text-right">Total Pos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(project.rab_breakdown || []).map((r: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 capitalize font-medium text-slate-700">{r.category?.replace("_", " ")}</td>
                      <td className="px-3 py-2 font-medium text-ink">{r.description}</td>
                      <td className="px-3 py-2 text-right">{r.volume}</td>
                      <td className="px-3 py-2">{r.unit}</td>
                      <td className="px-3 py-2 text-right">{rupiah(r.unit_price)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">{rupiah(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 font-semibold text-slate-800">
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-right">
                      Total Rencana Anggaran Biaya (RAB):
                    </td>
                    <td className="px-3 py-3 text-right text-brand">{rupiah(rabVal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Readonly: Termin Pembayaran & Penagihan */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <h3 className="font-semibold text-ink flex items-center gap-2">
                <Receipt className="size-4 text-brand" /> 5. Rencana Termin Pembayaran & Penagihan
              </h3>
              <Link
                href="/pengajuan/penjualan/penagihan"
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-brand hover:bg-slate-50 transition"
              >
                Buka Meja Kerja Penagihan & Invoice →
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas text-muted">
                  <tr>
                    <th className="px-3 py-2">Tahap</th>
                    <th className="px-3 py-2">Keterangan Termin</th>
                    <th className="px-3 py-2 text-right">Bobot (%)</th>
                    <th className="px-3 py-2 text-right">Nominal (Rp)</th>
                    <th className="px-3 py-2">Pemicu Tagihan (Deliverables)</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(project.payment_terms || []).map((t: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 text-muted">Termin {idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-ink">{t.name}</td>
                      <td className="px-3 py-2 text-right">{t.percentage}%</td>
                      <td className="px-3 py-2 text-right font-bold text-ink">{rupiah(t.amount)}</td>
                      <td className="px-3 py-2 text-muted italic">{t.trigger || "-"}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            t.status === "paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : t.status === "invoiced"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {t.status === "paid"
                            ? "✓ Lunas"
                            : t.status === "invoiced"
                            ? "⚡ Invoice Terbit"
                            : "Rencana"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!project.payment_terms || project.payment_terms.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-muted">
                        Jadwal termin pembayaran belum diatur pada proyek ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Riwayat / Log Eksekusi */}
      <Card className="p-5">
        <h3 className="font-semibold text-ink text-sm">Riwayat & Log Proyek</h3>
        <ol className="mt-4 space-y-3">
          {(events ?? []).map((e: any) => (
            <li key={e.id} className="border-l-2 border-line pl-4 text-xs">
              <p className="font-semibold text-ink">{e.action}</p>
              {e.note && <p className="mt-0.5 text-muted">{e.note}</p>}
              <time className="mt-1 block text-[11px] text-muted">
                {new Intl.DateTimeFormat("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Bangkok",
                }).format(new Date(e.created_at))}
              </time>
            </li>
          ))}
          {(!events || events.length === 0) && (
            <p className="text-xs text-muted">Belum ada riwayat aktivitas pada proyek ini.</p>
          )}
        </ol>
      </Card>
    </div>
  )
}
