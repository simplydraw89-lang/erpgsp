"use client"

import { useEffect, useId, useRef, useState } from "react"
import { searchSalesClients } from "@/app/(workspace)/pengajuan/penjualan/actions"
import type { SalesClient } from "@/lib/procurement-ui"

export function ClientPicker({ value, onChange, disabled }: { value: Partial<SalesClient> | null; onChange: (client: SalesClient) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [clients, setClients] = useState<SalesClient[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const root = useRef<HTMLDivElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const request = useRef(0)
  const loadingMore = useRef(false)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    let active = true
    const current = ++request.current
    const timer = setTimeout(() => {
      setBusy(true); setError("")
      searchSalesClients(search, 0).then(result => {
        if (!active || request.current !== current) return
        setClients(result.clients); setHasMore(result.hasMore); setError(result.error ?? "")
      }).catch(() => { if (active && request.current === current) setError("Pencarian klien gagal. Coba kembali.") })
        .finally(() => { if (active && request.current === current) setBusy(false) })
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [open, search])
  useEffect(() => {
    if (!open) return
    searchInput.current?.focus()
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [open])

  async function loadMore() {
    if (busy || loadingMore.current) return
    loadingMore.current = true
    const current = request.current
    setBusy(true)
    try {
      const result = await searchSalesClients(search, clients.length)
      if (current !== request.current) return
      setClients(items => [...items, ...result.clients]); setHasMore(result.hasMore); setError(result.error ?? "")
    } catch { if (current === request.current) setError("Klien berikutnya gagal dimuat.") }
    finally { loadingMore.current = false; if (current === request.current) setBusy(false) }
  }

  return <div ref={root} className="relative" onKeyDown={event => { if (event.key === "Escape") setOpen(false) }}>
    <input type="hidden" name="client_id" value={value?.id ?? ""} />
    <button type="button" disabled={disabled} aria-label="Pilih Klien" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(current => !current)} className="mt-1 flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2 text-left text-sm disabled:bg-canvas"><span className="truncate">{value?.name ?? "Pilih klien"}</span><span aria-hidden="true">▾</span></button>
    {open && <div className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-line bg-white p-2 shadow-xl">
      <input ref={searchInput} type="search" aria-label="Cari nama klien" value={search} onChange={event => { setSearch(event.target.value); setClients([]); setHasMore(false); setBusy(true) }} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); root.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus() } }} placeholder="Cari nama PT / klien…" className="mb-2 h-10 w-full rounded-lg border border-line px-3 text-sm" />
      <div id={listId} role="listbox" aria-label="Daftar pilihan klien" aria-busy={busy} onScroll={event => { const list = event.currentTarget; if (hasMore && list.scrollHeight - list.scrollTop - list.clientHeight < 80) void loadMore() }} onKeyDown={event => {
        if (!["ArrowDown", "ArrowUp"].includes(event.key)) return
        const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'))
        const index = options.indexOf(event.target as HTMLButtonElement)
        if (index < 0) return
        event.preventDefault(); options[Math.max(0, Math.min(options.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))]?.focus()
      }} className="max-h-[400px] overflow-y-auto">
        {clients.map(client => <button type="button" role="option" aria-selected={value?.id === client.id} key={client.id} title={client.name} onClick={() => { onChange(client); setOpen(false) }} className="block h-10 w-full truncate rounded-lg px-3 text-left text-sm hover:bg-canvas focus-visible:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">{client.name}</button>)}
        {hasMore && <div role="presentation"><button type="button" disabled={busy} onClick={loadMore} className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm font-medium text-brand disabled:opacity-50">{busy ? "Memuat…" : "Muat klien berikutnya"}</button></div>}
      </div>
      {busy && <p role="status" className="p-2 text-xs text-muted">Memuat klien…</p>}
      {error && <p role="alert" className="p-2 text-sm text-red-700">{error}</p>}
      {!busy && !error && !clients.length && <p className="p-2 text-sm text-muted">Tidak ada klien ditemukan.</p>}
    </div>}
  </div>
}
