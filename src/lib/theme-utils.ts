export type ThemePreference = "light" | "dark"
export type ResolvedTheme = "light" | "dark"

export const THEME_STORAGE_KEY = "gsp_theme_preference"

/**
 * Logika penentuan tema:
 * - Default adalah "light" (Mode Terang bersih & profesional).
 * - Tidak ada mode waktu otomatis agar tidak mengganggu operasional kerja pengguna.
 */
export function getResolvedTheme(preference?: ThemePreference | null): ResolvedTheme {
  if (preference === "dark") return "dark"
  return "light"
}
