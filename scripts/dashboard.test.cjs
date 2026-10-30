/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness transpiles pure TypeScript utilities. */
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")
const exportsForTest = {}
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/lib/dashboard.ts"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText,
  { exports: exportsForTest, Intl, Date },
)
const { calendarDate, daysUntil, getPersonalGreeting, getDisplayName } =
  exportsForTest

test("invalid deadlines cannot crash dashboard date formatting",()=>{
  const {calendarDay}=exportsForTest
  assert.equal(calendarDay("2026-10-31"),"2026-10-31")
  assert.equal(calendarDay("2026-10-31T00:00:00.000Z"),"2026-10-31")
  assert.equal(calendarDay("infinity"),null)
  assert.equal(calendarDay("2026-02-31"),null)
  assert.equal(calendarDay(null),null)
})
test("dashboard calendar uses the user timezone around UTC midnight", () => {
  assert.equal(calendarDate(new Date("2026-10-29T18:00:00Z")), "2026-10-30")
  assert.equal(
    getPersonalGreeting("Ardie Kumara", new Date("2026-10-30T09:00:00Z"))
      .greeting,
    "Selamat sore",
  )
  assert.equal(
    getPersonalGreeting("Ardie Kumara", new Date("2026-10-30T09:00:00Z"))
      .firstName,
    "Ardie",
  )
})
test("due days compare calendar dates without time-of-day rounding", () => {
  assert.equal(daysUntil("2026-10-31", "2026-10-30"), 1)
  assert.equal(daysUntil("2026-10-30", "2026-10-30"), 0)
  assert.equal(daysUntil("2026-10-29", "2026-10-30"), -1)
})
test("display name accepts text metadata and falls back safely", () => {
  assert.equal(
    getDisplayName({
      email: "ardie@example.invalid",
      user_metadata: { full_name: "Ardie Kumara" },
    }),
    "Ardie Kumara",
  )
  assert.equal(
    getDisplayName({
      email: "ardie@example.invalid",
      user_metadata: { full_name: {} },
    }),
    "ardie",
  )
  assert.equal(getDisplayName({}), "Pengguna")
})
