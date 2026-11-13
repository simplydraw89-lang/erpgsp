"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Zap, Users, FolderCheck, ArrowRight, ExternalLink, Briefcase } from "lucide-react"
import { Card } from "@/components/ui/card"
import { searchSalesClients, type ClientWithProjects } from "@/app/(workspace)/pengajuan/penjualan/actions"

export function ClientDirectory() {
  const [tab, setTab] = useState<"active" | "all">("active")
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [clients, setClients] = useState<ClientWithProjects[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [activeCount, setActiveCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let current = true
    const timer = setTimeout(() => {
      setBusy(true)
      setError("")
      searchSalesClients(search, offset, tab)
        .then((result) => {
          if (current) {
            setClients(result.clients)
            setHasMore(result.hasMore)
            if (result.activeCount !== undefined) setActiveCount(result.activeCount)
            if (result.totalCount !== undefined) setTotalCount(result.totalCount)
            setError(result.error ?? "")
          }
        })
        .catch(() => {
          if (current) setError("Daftar klien gagal dimuat. Coba kembali.")
        })
        .finally(() => {
          if (current) setBusy(false)
        })
    }, 250)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [search, offset, tab])

  return (
    <Card className="overflow-hidden">
      {/* Header & Tabs */}
      <div className="space-y-4 border-b border-line p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-ink text-base">Daftar Klien Perusahaan</h2>
            <p className="text-xs text-muted mt-0.5">
              Pemisahan antara Klien yang sudah Deal Proyek aktif dengan Klien Prospek / tahap penawaran.
            </p>
          </div>
          <div className="w-full sm:w-72">
            <input
              type="search"
              placeholder="Cari nama klien..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setOffset(0)
              }}
              className="block h-9 w-full rounded-lg border border-line px-3 text-xs"
            />
          </div>
        </div>

        {/* Tab Segmented Control */}
        <div className="flex border-b border-line gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setTab("active")
              setOffset(0)
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === "active"
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <Zap className="size-4 text-emerald-600" />
            <span>Klien Aktif (Deal Proyek)</span>
            {activeCount > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900 border border-emerald-300">
                {activeCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("all")
              setOffset(0)
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === "all"
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <Users className="size-4 text-slate-500" />
            <span>Semua / Klien Prospek</span>
            {totalCount > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-muted">
                {totalCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="p-5 text-sm text-red-700">
          {error}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table aria-busy={busy} className="w-full text-left text-sm">
            <thead className="bg-canvas text-muted text-xs">
              <tr>
                <th className="px-4 py-3">Nama Klien / Alamat</th>
                <th className="px-4 py-3">Status Hubungan</th>
                <th className="px-4 py-3">Kontak & Email</th>
                <th className="px-4 py-3">NPWP & Industri</th>
                <th className="px-4 py-3">Proyek Berjalan & Kolaborasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {clients.map((client) => {
                const activeProjects = (client.projects ?? []).filter(
                  (p) => p.status === "active" || p.approval_status === "active" || p.status === "planned"
                )
                const isDeal = activeProjects.length > 0

                return (
                  <tr key={client.id} className="hover:bg-canvas/50 transition">
                    <td className="px-4 py-3.5">
                      <strong className="text-ink font-semibold">{client.name}</strong>
                      <span className="mt-1 block text-xs text-muted max-w-xs">{client.address}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {isDeal ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 border border-emerald-300">
                          <FolderCheck className="size-3 text-emerald-700" /> Klien Aktif (Deal)
                        </span>
                      ) : client.hasOtherBranchProjects ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 border border-amber-200">
                          Aktif di Cabang Lain
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          Tahap Prospek / SPH
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted">
                      <span className="font-medium text-ink block">{client.contact || "-"}</span>
                      <span>{client.phone}</span>
                      {client.email && <span className="block text-[11px] text-brand">{client.email}</span>}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted">
                      <span>NPWP: {client.npwp || "-"}</span>
                      <span className="block text-slate-700 mt-0.5 font-medium">{client.industry}</span>
                    </td>
                    <td className="px-4 py-3.5 text-xs space-y-1.5">
                      {activeProjects.map((p) => (
                        <div key={p.id} className="flex flex-wrap items-center gap-2">
                          {p.branch?.code && (
                            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                              {p.branch.code}
                            </span>
                          )}
                          <span className="font-semibold text-ink">{p.code}</span>
                          <span className="text-muted truncate max-w-[140px]">{p.name}</span>
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/proyek/${p.id}`}
                              className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-brand hover:bg-slate-200"
                            >
                              Proyek <ArrowRight className="size-2.5" />
                            </Link>
                            <Link
                              href={`/portal-proyek?project=${p.id}`}
                              className="inline-flex items-center gap-1 rounded bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand hover:bg-brand/20"
                            >
                              Portal & MoM <ExternalLink className="size-2.5" />
                            </Link>
                          </div>
                        </div>
                      ))}
                      {!activeProjects.length && client.hasOtherBranchProjects && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-800/90 bg-amber-50/70 rounded-md px-2.5 py-1.5 border border-amber-200/60">
                          <span className="italic">Proyek aktif berjalan di cabang lain (akses dibatasi)</span>
                        </div>
                      )}
                      {!activeProjects.length && !client.hasOtherBranchProjects && (
                        <span className="text-muted italic">Belum ada proyek berjalan</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {busy ? (
        <p role="status" className="p-5 text-sm text-muted">
          Memuat data klien...
        </p>
      ) : (
        !error &&
        !clients.length && (
          <p className="p-8 text-center text-sm text-muted">
            {tab === "active"
              ? "Belum ada Klien Aktif dengan proyek deal saat ini. Klien akan otomatis aktif ketika SPK disetujui Direktur Utama."
              : "Belum ada data klien yang sesuai dengan pencarian."}
          </p>
        )
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line p-4 text-sm">
        <button
          type="button"
          disabled={busy || offset === 0}
          onClick={() => setOffset((current) => Math.max(0, current - 20))}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-canvas"
        >
          Sebelumnya
        </button>
        <span className="text-xs text-muted">
          Halaman {Math.floor(offset / 20) + 1}
        </span>
        <button
          type="button"
          disabled={busy || !hasMore}
          onClick={() => setOffset((current) => current + 20)}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-canvas"
        >
          Berikutnya
        </button>
      </div>
    </Card>
  )
}
