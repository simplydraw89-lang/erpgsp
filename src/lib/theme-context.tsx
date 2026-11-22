"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import {
  type ThemePreference,
  type ResolvedTheme,
  THEME_STORAGE_KEY,
  getResolvedTheme,
} from "./theme-utils"

export type { ThemePreference, ResolvedTheme }
export { getResolvedTheme }

interface ThemeContextType {
  preference: ThemePreference
  resolvedTheme: ResolvedTheme
  setPreference: (pref: ThemePreference) => void
  toggleTheme: () => void
  currentHour: number
  isDaytime: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default selalu "light" (Terang), tidak ada paksaan otomatis berdasarkan waktu
  const [preference, setPreferenceState] = useState<ThemePreference>("light")
  const [mounted, setMounted] = useState(false)

  // Baca preferensi dari localStorage saat pertama kali dimuat
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null
      if (saved === "dark") {
        setPreferenceState("dark")
      } else {
        setPreferenceState("light")
      }
    } catch {
      setPreferenceState("light")
    }
    setMounted(true)
  }, [])

  const resolvedTheme = getResolvedTheme(preference)

  // Sinkronkan class 'dark' ke tag <html> dan atribut data-theme
  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement
    if (resolvedTheme === "dark") {
      root.classList.add("dark")
      root.setAttribute("data-theme", "dark")
      root.style.colorScheme = "dark"
    } else {
      root.classList.remove("dark")
      root.setAttribute("data-theme", "light")
      root.style.colorScheme = "light"
    }
  }, [resolvedTheme, mounted])

  function setPreference(newPref: ThemePreference) {
    setPreferenceState(newPref)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newPref)
    } catch {
      // ignore
    }
  }

  function toggleTheme() {
    const nextPref = preference === "dark" ? "light" : "dark"
    setPreference(nextPref)
  }

  const hour = typeof window !== "undefined" ? new Date().getHours() : 12

  return (
    <ThemeContext.Provider
      value={{
        preference,
        resolvedTheme,
        setPreference,
        toggleTheme,
        currentHour: hour,
        isDaytime: hour >= 6 && hour < 18,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    return {
      preference: "light" as ThemePreference,
      resolvedTheme: "light" as ResolvedTheme,
      setPreference: () => {},
      toggleTheme: () => {},
      currentHour: 12,
      isDaytime: true,
    }
  }
  return context
}
