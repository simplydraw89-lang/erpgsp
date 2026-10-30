"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react"
import type { Field } from "@/lib/workflow"
import { labels } from "@/lib/workflow"

type Props = {
  type: string
  searchableFields: { name: string; label: string }[]
  dateFields: { name: string; label: string }[]
  statusField?: Field
  asset: boolean
}

export function ModuleFilters({ type, searchableFields, dateFields, statusField, asset }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [expanded, setExpanded] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  function updateFilters(form: HTMLFormElement) {
    const values = new FormData(form)
    const params = new URLSearchParams(searchParams.toString())
    params.set("type", type)
    for (const key of ["q", "field", "dateField", "from", "to", "status"]) {
      const value = String(values.get(key) ?? "")
      if (value) params.set(key, value)
      else params.delete(key)
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function handleChange(event: React.ChangeEvent<HTMLFormElement>) {
    const form = event.currentTarget
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => updateFilters(form), 250)
  }

  function resetFilters() {
    if (timer.current) clearTimeout(timer.current)
    router.replace(`${pathname}?type=${encodeURIComponent(type)}`, { scroll: false })
  }

  return (
    <aside className="module-filter-panel" aria-label="Filter data">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={17} className="text-brand" />
          <h2 className="text-sm font-semibold">Filter data</h2>
        </div>
        <button type="button" className="text-xs font-medium text-brand hover:underline lg:hidden" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
          {expanded ? "Tutup" : "Atur"}
        </button>
      </div>
      <form onChange={handleChange} className={`mt-4 space-y-4${expanded ? "" : " hidden lg:block"}`}>
        <input type="hidden" name="type" value={type} />
        {searchableFields.length > 0 && <label className="block text-xs font-medium text-muted">
          Cari nomor atau nama
          <div className="relative mt-1.5">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input aria-label="Cari nomor atau nama" name="q" defaultValue={searchParams.get("q") ?? ""} placeholder="Ketik untuk mencari" className="module-filter-input pl-9" />
          </div>
        </label>}
        {searchableFields.length > 1 && <label className="block text-xs font-medium text-muted">
          Cari berdasarkan
          <select aria-label="Cari berdasarkan" name="field" defaultValue={searchParams.get("field") ?? searchableFields[0]?.name} className="module-filter-input mt-1.5">
            {searchableFields.map((field) => <option key={field.name} value={field.name}>{field.label}</option>)}
          </select>
        </label>}
        {dateFields.length > 0 && <>
          {dateFields.length > 1 && <label className="block text-xs font-medium text-muted">
            Tanggal yang difilter
            <select aria-label="Tanggal yang difilter" name="dateField" defaultValue={searchParams.get("dateField") ?? dateFields[0]?.name} className="module-filter-input mt-1.5">
              {dateFields.map((field) => <option key={field.name} value={field.name}>{field.label}</option>)}
            </select>
          </label>}
          <label className="block text-xs font-medium text-muted">Tanggal awal<input aria-label="Tanggal awal" name="from" type="date" defaultValue={searchParams.get("from") ?? ""} className="module-filter-input mt-1.5" /></label>
          <label className="block text-xs font-medium text-muted">Tanggal akhir<input aria-label="Tanggal akhir" name="to" type="date" defaultValue={searchParams.get("to") ?? ""} className="module-filter-input mt-1.5" /></label>
        </>}
        {statusField && <label className="block text-xs font-medium text-muted">
          {asset ? "Status aset" : statusField.label}
          <select aria-label={asset ? "Status aset" : statusField.label} name="status" defaultValue={searchParams.get("status") ?? ""} className="module-filter-input mt-1.5">
            <option value="">Semua status</option>
            {statusField.options?.map((option) => <option key={option} value={option}>{statusField.name === "is_active" ? (option === "true" ? "Aktif" : "Tidak aktif") : labels[option] ?? option}</option>)}
          </select>
        </label>}
        <button type="button" onClick={resetFilters} className="inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-ink"><RotateCcw size={14} /> Hapus filter</button>
      </form>
      <p className="mt-4 hidden border-t border-line pt-3 text-[11px] leading-5 text-muted lg:block">Hasil diperbarui otomatis saat filter diubah.</p>
    </aside>
  )
}
