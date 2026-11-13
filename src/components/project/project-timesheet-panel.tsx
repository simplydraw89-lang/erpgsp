import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { logProjectTimesheetAction } from "@/app/(workspace)/proyek/timesheet-actions"

export type ProjectTimesheetRow = {
  id: string
  work_date: string
  personnel_name: string
  personnel_role: string | null
  phase_name: string
  hours_worked: number | string
  progress_pct: number
  notes: string | null
}

export function ProjectTimesheetPanel({
  projectId,
  isActiveProject,
  canLog,
  timesheets,
}: {
  projectId: string
  isActiveProject: boolean
  canLog: boolean
  timesheets: ProjectTimesheetRow[]
}) {
  const totalHours = timesheets.reduce((sum, item) => sum + Number(item.hours_worked ?? 0), 0)

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Realisasi Timesheet & Utilisasi Manpower</h2>
          <p className="text-sm text-muted">
            Catat jam kerja nyata tim ahli dan surveyor terhadap milestone proyek.
          </p>
        </div>
        <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold">
          Total TerCatat: {totalHours.toFixed(1)} jam
        </span>
      </div>

      {canLog && isActiveProject && (
        <form action={logProjectTimesheetAction} className="grid gap-3 rounded-lg border border-border bg-slate-50 p-4 md:grid-cols-6">
          <input type="hidden" name="project_id" value={projectId} />
          <input
            type="date"
            name="work_date"
            required
            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
          />
          <input
            type="text"
            name="personnel_name"
            required
            placeholder="Nama Personil"
            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
          />
          <input
            type="text"
            name="personnel_role"
            placeholder="Peran (mis. KTPA)"
            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
          />
          <input
            type="text"
            name="phase_name"
            required
            placeholder="Fase / Milestone"
            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
          />
          <input
            type="number"
            name="hours_worked"
            step="0.5"
            min="0.5"
            max="24"
            required
            placeholder="Jam"
            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
          />
          <input
            type="number"
            name="progress_pct"
            min="0"
            max="100"
            defaultValue={0}
            placeholder="Progres %"
            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
          />
          <input
            type="text"
            name="notes"
            placeholder="Catatan kegiatan lapangan"
            className="h-9 rounded-md border border-border bg-white px-2 text-sm md:col-span-5"
          />
          <Button type="submit" className="h-9">
            Catat Timesheet
          </Button>
        </form>
      )}

      {!isActiveProject && (
        <p className="text-xs text-muted">
          Pencatatan realisasi timesheet aktif setelah proyek disetujui Direktur Utama (`active`).
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Tanggal</th>
              <th className="px-3 py-2">Personil</th>
              <th className="px-3 py-2">Fase / Milestone</th>
              <th className="px-3 py-2 text-right">Jam</th>
              <th className="px-3 py-2 text-right">Progres</th>
              <th className="px-3 py-2">Catatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {timesheets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-xs text-muted">
                  Belum ada realisasi timesheet yang dicatat.
                </td>
              </tr>
            ) : (
              timesheets.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 whitespace-nowrap">{row.work_date}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{row.personnel_name}</span>
                    {row.personnel_role && (
                      <span className="ml-1 text-xs text-muted">({row.personnel_role})</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{row.phase_name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(row.hours_worked).toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.progress_pct}%</td>
                  <td className="px-3 py-2 text-xs text-muted">{row.notes ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
