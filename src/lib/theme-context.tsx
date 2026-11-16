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
  currentHour: number
  isDaytime: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("time")
  const [currentHour, setCurrentHour] = useState<number>(() => new Date().getHours())
  const [mounted, setMounted] = useState(false)

  // Baca preferensi dari localStorage saat pertama kali dimuat
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null
      if (saved && (saved === "light" || saved === "dark" || saved === "time")) {
        setPreferenceState(saved)
      } else {
        setPreferenceState("time")
      }
    } catch {
      setPreferenceState("time")
    }
    setCurrentHour(new Date().getHours())
    setMounted(true)
  }, [])

  // Timer berkala untuk memperbarui jam dan tema jika dalam mode "time" (setiap 30 detik)
  useEffect(() => {
    const timer = setInterval(() => {
      const h = new Date().getHours()
      setCurrentHour(h)
    }, 30000)

    return () => clearInterval(timer)
  }, [])

  const resolvedTheme = getResolvedTheme(preference, currentHour)
  const isDaytime = currentHour >= 6 && currentHour < 18

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

  return (
    <ThemeContext.Provider
      value={{
        preference,
        resolvedTheme,
        setPreference,
        currentHour,
        isDaytime,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    // Fallback aman jika digunakan di luar provider
    const hour = typeof window !== "undefined" ? new Date().getHours() : 12
    return {
      preference: "time" as ThemePreference,
      resolvedTheme: (hour >= 6 && hour < 18 ? "light" : "dark") as ResolvedTheme,
      setPreference: () => {},
      currentHour: hour,
      isDaytime: hour >= 6 && hour < 18,
    }
  }
  return context
}
