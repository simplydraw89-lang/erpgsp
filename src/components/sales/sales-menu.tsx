"use client"

import { useEffect, useId, useRef, type ReactNode } from "react"
import { ContactRound, FileCheck2, FileText, Receipt, X } from "lucide-react"
import { NavigationLink as Link } from "@/components/ui/navigation-link"

const sections = [
  { key: "klien", name: "Klien", description: "Calon mitra dan identitas perusahaan untuk dasar penawaran.", icon: ContactRound },
  { key: "sph", name: "SPH", description: "Surat penawaran berdasarkan klien terdaftar.", icon: FileText },
  { key: "spk", name: "SPK", description: "Perintah kerja dari perusahaan atau klien berdasarkan SPH.", icon: FileCheck2 },
  { key: "penagihan", name: "Penagihan", description: "Jadwal termin, penerbitan invoice, dan kuitansi pembayaran proyek.", icon: Receipt },
] as const

export function SalesMenu({ active, autoOpen = false, openInNewTab = false, children, triggerClassName, triggerLabel = "Menu Penjualan" }: {
  active?: string; autoOpen?: boolean; openInNewTab?: boolean; children?: ReactNode; triggerClassName?: string; triggerLabel?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (autoOpen && !dialog.current?.open) dialog.current?.showModal()
  }, [autoOpen])

  const options = sections.map(({ key, name, description, icon: Icon }) => (
    <Link key={key} href={`/pengajuan/penjualan/${key}`} aria-current={active === key ? "page" : undefined}
      target={openInNewTab ? "_blank" : undefined} rel={openInNewTab ? "noopener noreferrer" : undefined}
      title={`${description}${openInNewTab ? " · Buka di tab baru" : ""}`} onClick={() => dialog.current?.close()} className="group flex min-w-0 flex-col items-center gap-3 rounded-2xl px-2 py-3 text-center outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500">
      <span className="flex size-14 items-center justify-center rounded-[18px] bg-[#008cff] text-white transition group-hover:bg-blue-600"><Icon size={30} strokeWidth={1.8} aria-hidden="true" /></span>
      <span className="text-sm font-semibold text-slate-600">{name}</span>
    </Link>
  ))

  return <>
    <button type="button" onClick={() => dialog.current?.showModal()} aria-label={triggerLabel} aria-haspopup="dialog" className={triggerClassName ?? "rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium"}>{children ?? triggerLabel}</button>
    <dialog ref={dialog} aria-labelledby={titleId} onClick={event => { if (event.target === dialog.current) dialog.current?.close() }} className="w-[calc(100%-2rem)] max-w-[620px] overflow-visible border-0 bg-transparent p-0 outline-none backdrop:bg-black/60 backdrop:backdrop-blur-[4px]">
      <div className="relative mb-8 flex items-center justify-center px-12 text-white"><h2 id={titleId} className="text-lg font-semibold">Penjualan</h2><button type="button" aria-label="Tutup pilihan Penjualan" onClick={() => dialog.current?.close()} className="absolute right-0 rounded-full p-2 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><X size={20} /></button></div>
      <div className="min-h-[min(476px,65vh)] rounded-[30px] border border-slate-200 bg-white px-5 py-8 shadow-2xl sm:px-8 sm:py-9"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">{options}</div></div>
    </dialog>
  </>
}
