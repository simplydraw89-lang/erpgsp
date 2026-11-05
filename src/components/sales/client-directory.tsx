"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { searchSalesClients } from "@/app/(workspace)/pengajuan/penjualan/actions"
import type { SalesClient } from "@/lib/procurement-ui"

export function ClientDirectory() {
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [clients, setClients] = useState<SalesClient[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    let current = true
    const timer = setTimeout(() => {
      setBusy(true); setError("")
      searchSalesClients(search, offset).then(result => { if (current) { setClients(result.clients); setHasMore(result.hasMore); setError(result.error ?? "") } })
        .catch(() => { if (current) setError("Daftar klien gagal dimuat. Coba kembali.") }).finally(() => { if (current) setBusy(false) })
    }, 250)
    return () => { current = false; clearTimeout(timer) }
  }, [search, offset])
  return <Card className="overflow-hidden">
    <div className="space-y-3 border-b border-line p-5"><h2 className="font-semibold">Daftar klien perusahaan</h2><label className="block text-sm">Cari nama klien<input type="search" value={search} onChange={event => { setSearch(event.target.value); setOffset(0) }} className="mt-1 block h-10 w-full rounded-lg border border-line px-3" /></label></div>
    {error ? <p role="alert" className="p-5 text-sm text-red-700">{error}</p> : <div className="overflow-x-auto"><table aria-busy={busy} className="w-full text-left text-sm"><thead className="bg-canvas text-muted"><tr>{["Nama / alamat", "NPWP", "Nomor kontak", "Email", "Jenis usaha", "Informasi lainnya"].map(title => <th key={title} className="px-4 py-3">{title}</th>)}</tr></thead><tbody>{clients.map(client => <tr key={client.id} className="border-t border-line"><td className="px-4 py-3"><strong>{client.name}</strong><span className="mt-1 block text-xs text-muted">{client.address}</span></td><td className="px-4 py-3">{client.npwp}</td><td className="px-4 py-3">{client.phone}</td><td className="px-4 py-3">{client.email}</td><td className="px-4 py-3">{client.industry}</td><td className="px-4 py-3">{client.additional_information || "—"}</td></tr>)}</tbody></table></div>}
    {busy ? <p role="status" className="p-5 text-sm text-muted">Memuat klien…</p> : !error && !clients.length && <p className="p-5 text-sm text-muted">Belum ada klien yang sesuai.</p>}
    <div className="flex items-center justify-between gap-3 border-t border-line p-4 text-sm"><button type="button" disabled={busy || offset === 0} onClick={() => setOffset(current => Math.max(0, current - 10))} className="rounded-lg border border-line px-3 py-2 disabled:opacity-40">Sebelumnya</button><span>Halaman {Math.floor(offset / 10) + 1}</span><button type="button" disabled={busy || !hasMore} onClick={() => setOffset(current => current + 10)} className="rounded-lg border border-line px-3 py-2 disabled:opacity-40">Berikutnya</button></div>
  </Card>
}
