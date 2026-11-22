"use client"

import React, { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"
import { useTheme } from "@/lib/theme-context"

interface ThemeToggleProps {
  className?: string
  align?: "left" | "right"
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { preference, resolvedTheme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === "dark" : false

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
      title={isDark ? "Tema Gelap aktif · Klik untuk beralih ke Mode Terang" : "Tema Terang aktif · Klik untuk beralih ke Mode Gelap"}
      className={`group relative flex size-9 items-center justify-center rounded-xl border border-line bg-white/90 text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 dark:border-slate-700/80 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer active:scale-95 ${className}`}
    >
      <span className="sr-only">
        {isDark ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
      </span>

      {isDark ? (
        <Moon className="size-4 text-indigo-400 transition-transform duration-200 group-hover:-rotate-12" />
      ) : (
        <Sun className="size-4 text-amber-500 transition-transform duration-200 group-hover:rotate-45" />
      )}
    </button>
  )
}
