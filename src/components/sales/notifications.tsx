"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Bell } from "lucide-react"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import type { SalesNotifications } from "@/lib/sales"
import { sphStatusLabels } from "@/lib/sales"

export function SalesNotificationBell({ disabled = false }: { disabled?: boolean }) {
  const [data,setData] = useState<SalesNotifications | null>(null)
  const [error,setError] = useState("")
  const [open,setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const controller = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    if (disabled) return
    controller.current?.abort()
    const request = new AbortController();controller.current=request
    try {
      const response = await fetch("/api/sales-notifications",{cache:"no-store",signal:request.signal})
      if (response.redirected || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Sesi berakhir. Silakan masuk kembali.")
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Notifikasi gagal dimuat.")
      if (!request.signal.aborted) {setData(result);setError("")}
    } catch (failure) {if (!request.signal.aborted) {setData(null);setError(failure instanceof Error ? failure.message : "Notifikasi gagal dimuat.")}}
  },[disabled])
  useEffect(() => {
    const initial = setTimeout(() => {void refresh()},0)
    const timer = setInterval(() => {if (document.visibilityState === "visible") void refresh()},30000)
    const focus = () => {void refresh()}
    window.addEventListener("focus",focus)
    return () => {clearTimeout(initial);clearInterval(timer);window.removeEventListener("focus",focus);controller.current?.abort()}
  },[refresh])
  useEffect(() => {
    if (!open) return
    const close = (event:PointerEvent) => {if (!root.current?.contains(event.target as Node)) setOpen(false)}
    document.addEventListener("pointerdown",close)
    return () => document.removeEventListener("pointerdown",close)
  },[open])
  return <div ref={root} className="relative" onKeyDown={event => {if(event.key === "Escape") setOpen(false)}}>
    <button type="button" disabled={disabled} aria-label={`Notifikasi${data?.total ? `, ${data.total} perlu tindakan` : ""}`} aria-expanded={open} onClick={() => {setOpen(value=>!value);void refresh()}} className="relative flex size-10 items-center justify-center rounded-lg border border-line bg-white text-muted hover:text-brand"><Bell size={18} />{Boolean(data?.total) && <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{data!.total>99 ? "99+" : data!.total}</span>}{error && <span className="absolute right-0 top-0 size-2 rounded-full bg-amber-500" />}</button>
    {open && <section aria-label="Notifikasi SPH" className="absolute right-0 top-full z-40 mt-2 max-h-[70vh] w-[min(90vw,380px)] overflow-y-auto rounded-xl border border-line bg-white p-4 text-ink shadow-xl"><h2 className="font-semibold">Notifikasi SPH</h2>{error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : !data ? <p role="status" className="mt-3 text-sm">Memuat…</p> : data.total ? <ul className="mt-3 divide-y divide-line">{data.items.map(item => <li key={item.id} className="py-3"><a href={`/pengajuan/penjualan/sph/${item.id}`} target="_blank" rel="noopener noreferrer" className="block text-sm font-semibold text-brand">{item.label} · SPH {item.sph_number}</a><p className="mt-1 text-xs text-muted">{sphStatusLabels[item.status]}</p>{item.review_note && <p className="mt-2 whitespace-pre-wrap text-sm">{item.review_note}</p>}</li>)}</ul> : <p className="mt-3 text-sm text-muted">Tidak ada SPH yang perlu ditindaklanjuti.</p>}{data && data.total>100 && <Link href="/pengajuan/penjualan/sph" className="text-sm text-brand">Lihat daftar SPH untuk pemberitahuan lainnya →</Link>}</section>}
  </div>
}
