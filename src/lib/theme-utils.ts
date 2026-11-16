export type ThemePreference = "light" | "dark" | "time"
export type ResolvedTheme = "light" | "dark"

export const THEME_STORAGE_KEY = "gsp_theme_preference"

/**
 * Logika penentuan tema berdasarkan waktu:
 * - Jam 06:00 s/d 17:59 (06:00 - 18:00): Mode Terang (Siang)
 * - Jam 18:00 s/d 05:59 (18:00 - 06:00): Mode Gelap (Malam)
 */
export function getResolvedTheme(preference: ThemePreference, hour: number): ResolvedTheme {
  if (preference === "light") return "light"
  if (preference === "dark") return "dark"
  // Sesuai waktu (time): 06:00 - 18:00 adalah siang
  return hour >= 6 && hour < 18 ? "light" : "dark"
}
