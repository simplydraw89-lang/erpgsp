import test from "node:test"
import assert from "node:assert/strict"
import { getResolvedTheme } from "../src/lib/theme-utils.ts"

test("Theme resolution handles Light and Dark correctly with Light as standard default", () => {
  // 1. Default fallback (undefined / null) -> light
  assert.strictEqual(getResolvedTheme(undefined), "light", "Default fallback should be light")
  assert.strictEqual(getResolvedTheme(null), "light", "Null preference should be light")

  // 2. Mode Terang -> light
  assert.strictEqual(getResolvedTheme("light"), "light", "Light preference should resolve to light")

  // 3. Mode Gelap -> dark
  assert.strictEqual(getResolvedTheme("dark"), "dark", "Dark preference should resolve to dark")
})
