"use client"

import React, { useEffect, useRef, useState } from "react"
import { Sun, Moon, Clock, Check, Sparkles } from "lucide-react"
import { useTheme, type ThemePreference } from "@/lib/theme-context"

interface ThemeToggleProps {
  className?: string
  align?: "left" | "right"
}

export function ThemeToggle({ className = "", align = "right" }: ThemeToggleProps) {
  const { preference, resolvedTheme, setPreference, currentHour, isDaytime } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Tutup dengan tombol Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  const options: {
    id: ThemePreference
    label: string
    sublabel: string
    icon: typeof Sun
    color: string
    badge?: string
  }[] = [
    {
      id: "light",
      label: "Mode Terang",
      sublabel: "Tampilan cerah, selalu aktif",
      icon: Sun,
      color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
    },
    {
      id: "dark",
      label: "Mode Gelap",
      sublabel: "Tampilan gelap, nyaman di mata",
      icon: Moon,
      color: "text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800",
    },
    {
      id: "time",
      label: "Mode Sesuai Waktu",
      sublabel: "06:00–18:00 Terang · 18:00–06:00 Gelap",
      icon: Clock,
      color: "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800",
      badge: isDaytime ? "Siang · Terang" : "Malam · Gelap",
    },
  ]

  const ActiveIcon =
    preference === "light"
      ? Sun
      : preference === "dark"
      ? Moon
      : Clock

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Pengaturan Mode Tampilan (Terang / Gelap / Sesuai Waktu)"
        aria-expanded={isOpen}
        title={`Tema saat ini: ${
          preference === "light"
            ? "Mode Terang"
            : preference === "dark"
            ? "Mode Gelap"
            : `Sesuai Waktu (${isDaytime ? "Siang · Terang" : "Malam · Gelap"})`
        }`}
        className="flex size-9 items-center justify-center rounded-xl border border-line bg-white/90 text-slate-700 shadow-sm transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
      >
        <ActiveIcon
          className={`size-4 transition-transform ${
            preference === "light"
              ? "text-amber-500"
              : preference === "dark"
              ? "text-indigo-400"
              : "text-teal-600 dark:text-teal-400"
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Pilih Mode Tampilan"
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } mt-2 w-72 rounded-2xl border border-slate-200 bg-white/98 p-2 shadow-2xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-150 dark:border-slate-700 dark:bg-slate-900/98`}
        >
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Mode Tampilan
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Sparkles className="size-2.5 text-teal-600" />
                {String(currentHour).padStart(2, "0")}:00 WIB
              </span>
            </div>
          </div>

          <div className="space-y-1 p-1">
            {options.map((opt) => {
              const isSelected = preference === opt.id
              const Icon = opt.icon
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setPreference(opt.id)
                    setIsOpen(false)
                  }}
                  className={`flex w-full items-start gap-3 rounded-xl p-2.5 text-left text-xs transition cursor-pointer ${
                    isSelected
                      ? "bg-teal-50/80 text-teal-950 font-semibold ring-1 ring-teal-500/30 dark:bg-teal-950/40 dark:text-teal-100"
                      : "text-slate-700 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/80"
                  }`}
                >
                  <div
                    className={`flex size-7 shrink-0 items-center justify-center rounded-lg border ${opt.color}`}
                  >
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold">{opt.label}</span>
                      {isSelected && (
                        <Check className="size-3.5 text-teal-600 dark:text-teal-400" />
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500 leading-tight dark:text-slate-400">
                      {opt.sublabel}
                    </p>
                    {opt.badge && (
                      <div className="mt-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-teal-100/70 px-1.5 py-0.5 text-[10px] font-medium text-teal-800 dark:bg-teal-900/50 dark:text-teal-300">
                          {isDaytime ? "☀️" : "🌙"} Aktif: {opt.badge}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-1 px-3 py-1.5 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800 text-center">
            Pilihan tersimpan otomatis di perangkat ini
          </div>
        </div>
      )}
    </div>
  )
}
