"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Bell, X } from "lucide-react"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import type { SalesNotifications } from "@/lib/sales"
import { sphStatusLabels, spkStatusLabels, projectStatusLabels } from "@/lib/sales"

export function SalesNotificationBell({ disabled = false }: { disabled?: boolean }) {
  const [data, setData] = useState<SalesNotifications | null>(null)
  const [error, setError] = useState("")
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const controller = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    if (disabled) return
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    try {
      const response = await fetch("/api/sales-notifications", {
        cache: "no-store",
        signal: request.signal,
      })
      if (response.redirected || !response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Sesi berakhir. Silakan masuk kembali.")
      }
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Notifikasi gagal dimuat.")
      if (!request.signal.aborted) {
        setData(result)
        setError("")
      }
    } catch (failure) {
      if (!request.signal.aborted) {
        setData(null)
        setError(failure instanceof Error ? failure.message : "Notifikasi gagal dimuat.")
      }
    }
  }, [disabled])

  useEffect(() => {
    const initial = setTimeout(() => {
      void refresh()
    }, 0)
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh()
    }, 30000)
    const focus = () => {
      void refresh()
    }
    window.addEventListener("focus", focus)
    return () => {
      clearTimeout(initial)
      clearInterval(timer)
      window.removeEventListener("focus", focus)
      controller.current?.abort()
    }
  }, [refresh])

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [open])

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false)
      }}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={`Notifikasi${data?.total ? `, ${data.total} perlu tindakan` : ""}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value)
          void refresh()
        }}
        className="relative flex size-10 items-center justify-center rounded-lg border border-line bg-white text-muted transition hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        <Bell size={18} />
        {Boolean(data?.total) && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm">
            {data!.total > 99 ? "99+" : data!.total}
          </span>
        )}
        {error && <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-amber-500" />}
      </button>

      {/* Backdrop di mobile (portrait & landscape) agar fokus dan mudah ditutup */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] sm:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {open && (
        <section
          aria-label="Pusat Notifikasi"
          className="
            fixed inset-x-3 top-[68px] z-50 mx-auto flex max-w-[420px] flex-col
            max-h-[calc(100dvh-80px)] rounded-2xl border border-line bg-white shadow-2xl
            sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px]
            sm:max-h-[min(75vh,calc(100dvh-80px))] sm:rounded-xl sm:shadow-xl
          "
        >
          {/* Header Notifikasi */}
          <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-slate-50/80 rounded-t-2xl sm:rounded-t-xl shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-brand" />
              <h2 className="font-semibold text-sm text-ink">Notifikasi Dokumen</h2>
              {Boolean(data?.total) && (
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">
                  {data!.total}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-muted hover:bg-slate-200/60 hover:text-ink sm:hidden"
              aria-label="Tutup notifikasi"
            >
              <X size={18} />
            </button>
          </div>

          {/* Isi Notifikasi (scrollable, responsive) */}
          <div className="overflow-y-auto p-4 space-y-3 overscroll-contain">
            {error ? (
              <p role="alert" className="text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
                {error}
              </p>
            ) : !data ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted">
                <span className="animate-pulse">Memuat notifikasi…</span>
              </div>
            ) : data.total ? (
              <ul className="divide-y divide-line">
                {data.items.map((item) => {
                  const isProject = item.kind === "project"
                  const isSpk = item.kind === "spk"
                  const href = isProject
                    ? `/proyek/${item.id}`
                    : isSpk
                    ? `/pengajuan/penjualan/spk/${item.id}`
                    : `/pengajuan/penjualan/sph/${item.id}`
                  const docLabel = item.document_number
                    ? item.document_number
                    : isProject
                    ? `PROYEK`
                    : isSpk
                    ? `SPK`
                    : `SPH No. ${item.sph_number ?? ""}`

                  const statusText = isProject
                    ? (projectStatusLabels[item.status] ?? item.status)
                    : isSpk
                    ? (spkStatusLabels[item.status] ?? item.status)
                    : (sphStatusLabels[item.status] ?? item.status)

                  return (
                    <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                      <Link
                        href={href}
                        onClick={() => setOpen(false)}
                        className="group block"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-brand group-hover:underline break-words">
                            {item.label}
                          </span>
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                            {docLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted break-words">
                          {statusText}
                        </p>
                        {item.review_note && (
                          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-canvas p-2 text-xs text-ink border border-line break-words">
                            {item.review_note}
                          </p>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="py-6 text-center text-sm text-muted">
                <p>Tidak ada pemberitahuan yang memerlukan tindakan.</p>
              </div>
            )}
          </div>

          {/* Footer Notifikasi */}
          {data && data.total > 0 && (
            <div className="border-t border-line px-4 py-2.5 bg-slate-50/60 rounded-b-2xl sm:rounded-b-xl shrink-0 text-center">
              <Link
                href="/pekerjaan-saya/pengajuan"
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-brand hover:underline"
              >
                Lihat seluruh pengajuan saya →
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
