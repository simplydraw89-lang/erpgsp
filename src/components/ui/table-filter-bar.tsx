"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Search, Filter, RotateCcw } from "lucide-react"

export type FilterField = {
  key: string
  label: string
  type?: "text" | "select" | "date"
  placeholder?: string
  options?: { value: string; label: string }[]
}

export function TableFilterBar({
  fields,
  branches,
  isCentralUser,
  userBranchId,
}: {
  fields: FilterField[]
  branches?: { id: string; name: string }[]
  isCentralUser?: boolean
  userBranchId?: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleFilter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const params = new URLSearchParams()

    for (const [key, val] of fd.entries()) {
      const v = String(val).trim()
      if (v) params.set(key, v)
    }

    router.replace(`${pathname}?${params.toString()}`)
  }

  function handleReset() {
    router.replace(pathname)
  }

  const hasFilter = Array.from(searchParams.keys()).some((k) => k !== "error" && k !== "notice" && k !== "page")

  return (
    <form onSubmit={handleFilter} className="rounded-xl border border-line bg-canvas/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Filter size={16} className="text-brand" />
          <span>Filter & Pencarian Data</span>
        </div>
        {hasFilter && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline"
          >
            <RotateCcw size={12} />
            Reset Filter
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {/* Cabang Filter: Hanya aktif dan selectable jika user pusat */}
        {branches && branches.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">Cabang</label>
            {isCentralUser ? (
              <select
                name="branch_id"
                defaultValue={searchParams.get("branch_id") || ""}
                className="h-9 w-full rounded-lg border border-line bg-white px-2.5 text-xs text-ink outline-none focus:border-brand"
              >
                <option value="">Semua Cabang (Pusat)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex h-9 items-center rounded-lg border border-line/60 bg-slate-100 px-2.5 text-xs text-muted">
                {branches.find((b) => b.id === userBranchId)?.name || "Cabang Anda (Terisolasi)"}
              </div>
            )}
          </div>
        )}

        {fields.map((f) => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs font-medium text-muted">{f.label}</label>
            {f.type === "select" ? (
              <select
                name={f.key}
                defaultValue={searchParams.get(f.key) || ""}
                className="h-9 w-full rounded-lg border border-line bg-white px-2.5 text-xs text-ink outline-none focus:border-brand"
              >
                <option value="">Semua {f.label}</option>
                {f.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : f.type === "date" ? (
              <input
                type="date"
                name={f.key}
                defaultValue={searchParams.get(f.key) || ""}
                className="h-9 w-full rounded-lg border border-line bg-white px-2.5 text-xs text-ink outline-none focus:border-brand"
              />
            ) : (
              <div className="relative">
                <input
                  type="text"
                  name={f.key}
                  placeholder={f.placeholder || `Cari ${f.label.toLowerCase()}...`}
                  defaultValue={searchParams.get(f.key) || ""}
                  className="h-9 w-full rounded-lg border border-line bg-white pl-8 pr-2.5 text-xs text-ink outline-none focus:border-brand"
                />
                <Search size={14} className="absolute left-2.5 top-2.5 text-muted" />
              </div>
            )}
          </div>
        ))}

        <div className="flex items-end">
          <button
            type="submit"
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-xs font-medium text-white transition hover:bg-brand/90"
          >
            <Search size={14} />
            Terapkan Filter
          </button>
        </div>
      </div>
    </form>
  )
}
