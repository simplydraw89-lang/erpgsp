import test from "node:test"
import assert from "node:assert/strict"
import { getResolvedTheme } from "../src/lib/theme-utils.ts"

test("Theme resolution handles Light, Dark, and Time-based correctly", () => {
  // 1. Mode Terang
  for (let h = 0; h < 24; h++) {
    assert.strictEqual(getResolvedTheme("light", h), "light", `Hour ${h} should be light in light mode`)
  }

  // 2. Mode Gelap
  for (let h = 0; h < 24; h++) {
    assert.strictEqual(getResolvedTheme("dark", h), "dark", `Hour ${h} should be dark in dark mode`)
  }

  // 3. Mode Sesuai Waktu:
  // Siang (06:00 - 18:00) -> Terang
  const dayHours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
  for (const h of dayHours) {
    assert.strictEqual(getResolvedTheme("time", h), "light", `Hour ${h} should resolve to light during daytime`)
  }

  // Malam (18:00 - 06:00) -> Gelap
  const nightHours = [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5]
  for (const h of nightHours) {
    assert.strictEqual(getResolvedTheme("time", h), "dark", `Hour ${h} should resolve to dark during nighttime`)
  }
})
