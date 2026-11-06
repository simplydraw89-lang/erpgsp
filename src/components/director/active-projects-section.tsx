import Link from "next/link"
import { FolderKanban } from "lucide-react"
import type { ActiveProjectSummary } from "@/lib/director-dashboard"

export function ActiveProjectsSection({
  projects,
}: {
  projects: ActiveProjectSummary[]
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FolderKanban size={19} className="text-brand" />
          <h3 className="font-semibold text-ink">Ringkasan Proyek Aktif ({projects.length})</h3>
        </div>
        <Link
          href="/modul/crm?type=project"
          className="text-xs font-semibold text-brand hover:underline"
        >
          Lihat semua proyek &rarr;
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas text-muted">
              <tr>
                <th scope="col" className="p-3.5 font-semibold">Kode Proyek</th>
                <th scope="col" className="p-3.5 font-semibold">Nama Proyek</th>
                <th scope="col" className="p-3.5 font-semibold">Klien</th>
                <th scope="col" className="p-3.5 font-semibold">Status</th>
                <th scope="col" className="p-3.5 font-semibold">Periode Pelaksanaan</th>
                <th scope="col" className="p-3.5 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {projects.length ? (
                projects.map((proj) => (
                  <tr key={proj.id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-mono font-medium text-brand">{proj.code}</td>
                    <td className="p-3.5 font-medium text-ink">{proj.name}</td>
                    <td className="p-3.5 text-muted">{proj.clientName ?? "Klien Internal / Mitra"}</td>
                    <td className="p-3.5">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                        {proj.status === "active" ? "Aktif Berjalan" : "Direncanakan"}
                      </span>
                    </td>
                    <td className="p-3.5 text-muted">
                      {proj.startsOn || proj.endsOn
                        ? `${proj.startsOn ?? "Mulai"} s/d ${proj.endsOn ?? "Selesai"}`
                        : "Jadwal fleksibel"}
                    </td>
                    <td className="p-3.5 text-right">
                      <Link
                        href={`/modul/crm?type=project&edit=${proj.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-brand hover:underline"
                      >
                        Detail &rarr;
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-sm text-muted">
                    Belum ada proyek aktif saat ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
