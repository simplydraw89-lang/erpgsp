"use client"

import React, { useEffect, useState } from "react"
import {
  Sun,
  Moon,
  CheckCircle2,
  X,
  Sliders,
  Sparkles,
  ArrowRight,
  RotateCw,
} from "lucide-react"
import { useTheme, type ThemePreference } from "@/lib/theme-context"
import { NavigationLink as Link } from "@/components/ui/navigation-link"

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { preference, resolvedTheme, setPreference } = useTheme()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedPref, setSelectedPref] = useState<ThemePreference | null>(null)

  // Tutup dengan Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  function handleSelectTheme(pref: ThemePreference) {
    setSelectedPref(pref)
    setIsRefreshing(true)
    setPreference(pref)

    // Terapkan langsung ke class HTML sebelum reload
    if (pref === "dark") {
      document.documentElement.classList.add("dark")
      document.documentElement.setAttribute("data-theme", "dark")
      document.documentElement.style.colorScheme = "dark"
    } else {
      document.documentElement.classList.remove("dark")
      document.documentElement.setAttribute("data-theme", "light")
      document.documentElement.style.colorScheme = "light"
    }

    // Refresh halaman otomatis seketika untuk mempersingkat waktu
    setTimeout(() => {
      window.location.reload()
    }, 120)
  }

  const themeOptions: {
    id: ThemePreference
    title: string
    subtitle: string
    description: string
    icon: typeof Sun
    accentColor: string
    badgeText?: string
    previewBg: string
    previewBorder: string
  }[] = [
    {
      id: "light",
      title: "Mode Terang",
      subtitle: "Standar Default (Direkomendasikan)",
      description: "Latar belakang putih bersih dan kontras standar. Sangat nyaman untuk akuntansi & aktivitas siang hari.",
      icon: Sun,
      accentColor: "text-amber-500",
      badgeText: "Default Sistem",
      previewBg: "bg-gradient-to-br from-amber-50 to-white",
      previewBorder: "border-amber-300",
    },
    {
      id: "dark",
      title: "Mode Gelap",
      subtitle: "Deep Slate (Nyaman di Mata)",
      description: "Palet deep slate modern yang teduh di mata dan hemat daya di ruangan redup/malam.",
      icon: Moon,
      accentColor: "text-indigo-400",
      previewBg: "bg-gradient-to-br from-slate-900 to-slate-950",
      previewBorder: "border-indigo-500",
    },
  ]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-150 dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Loading Overlay saat otomatis refresh */}
        {isRefreshing && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm dark:bg-slate-900/90">
            <RotateCw className="size-8 text-teal-600 animate-spin" />
            <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Menerapkan tema & merefresh halaman...
            </p>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400">
              <Sliders className="size-5" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-base font-bold text-ink">
                Pengaturan Tampilan & Sistem
              </h2>
              <p className="text-xs text-muted">
                Pilih preferensi tema antarmuka yang Anda inginkan
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela pengaturan"
            className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Status info bar */}
          <div className="flex items-center justify-between rounded-xl bg-teal-50/60 px-4 py-2.5 text-xs border border-teal-200/60 dark:bg-teal-950/30 dark:border-teal-900/40">
            <div className="flex items-center gap-2 text-teal-900 dark:text-teal-200 font-medium">
              <Sparkles className="size-3.5 text-teal-600 dark:text-teal-400" />
              <span>Tema Aktif:</span>
              <strong className="capitalize">{resolvedTheme === "dark" ? "Mode Gelap (Dark)" : "Mode Terang (Light)"}</strong>
            </div>
            <span className="text-[11px] text-teal-700 dark:text-teal-300">
              Tersimpan lokal
            </span>
          </div>

          {/* 2 Pilihan Tema */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {themeOptions.map((opt) => {
              const isSelected = (selectedPref || preference) === opt.id
              const Icon = opt.icon

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectTheme(opt.id)}
                  className={`flex flex-col justify-between text-left rounded-2xl border p-4 transition-all cursor-pointer relative select-none ${
                    isSelected
                      ? "border-teal-600 bg-white shadow-md ring-2 ring-teal-500/30 dark:border-teal-400 dark:bg-slate-800"
                      : "border-line bg-slate-50/70 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between pb-2.5 border-b border-line dark:border-slate-700/60">
                      <div
                        className={`flex size-8 items-center justify-center rounded-lg border ${opt.previewBorder} ${opt.previewBg}`}
                      >
                        <Icon className={`size-4 ${opt.accentColor}`} />
                      </div>

                      <div
                        className={`flex size-4 items-center justify-center rounded-full border ${
                          isSelected
                            ? "border-teal-600 bg-teal-600 text-white dark:border-teal-400 dark:bg-teal-400 dark:text-slate-950"
                            : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="size-3.5" />}
                      </div>
                    </div>

                    <h3 className="mt-2.5 font-bold text-xs text-ink">{opt.title}</h3>
                    <p className="text-[10px] text-muted font-medium">{opt.subtitle}</p>
                    <p className="mt-2 text-[11px] leading-relaxed text-muted">
                      {opt.description}
                    </p>

                    {opt.badgeText && (
                      <span className="mt-2 inline-flex items-center rounded-md bg-teal-100/70 px-2 py-0.5 text-[10px] font-semibold text-teal-800 dark:bg-teal-900/60 dark:text-teal-300">
                        {opt.badgeText}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-line dark:border-slate-700/60 text-[11px] font-semibold flex items-center justify-between">
                    <span className={isSelected ? "text-teal-600 dark:text-teal-400" : "text-slate-400"}>
                      {isSelected ? "Aktif Sekarang ✓" : "Pilih Mode"}
                    </span>
                    <span className="text-muted text-[10px]">Klik →</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Quick links ke pengaturan terkait */}
          <div className="pt-2 border-t border-line dark:border-slate-800">
            <p className="text-xs font-semibold text-ink mb-2">Pengaturan Lainnya:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <Link
                href="/pengaturan/persetujuan"
                onClick={onClose}
                className="flex items-center justify-between rounded-xl border border-line p-2.5 hover:bg-slate-50 transition dark:border-slate-800 dark:hover:bg-slate-800"
              >
                <span className="text-muted font-medium">Kebijakan Approval Dokumen</span>
                <ArrowRight className="size-3.5 text-teal-600" />
              </Link>
              <Link
                href="/struktur-akses"
                onClick={onClose}
                className="flex items-center justify-between rounded-xl border border-line p-2.5 hover:bg-slate-50 transition dark:border-slate-800 dark:hover:bg-slate-800"
              >
                <span className="text-muted font-medium">Struktur & Hak Akses Organisasi</span>
                <ArrowRight className="size-3.5 text-teal-600" />
              </Link>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-line bg-slate-50/70 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-800/40 text-xs">
          <span className="text-muted text-[11px]">
            Pengaturan tersimpan otomatis di perangkat ini
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-200 px-4 py-1.5 font-semibold text-slate-800 hover:bg-slate-300 transition dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
