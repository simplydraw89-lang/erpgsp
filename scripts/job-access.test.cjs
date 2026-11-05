/* eslint-disable @typescript-eslint/no-require-imports -- Pure TypeScript module tested through the installed compiler. */
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const vm = require("node:vm")
const ts = require("typescript")
const result = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/auth/job-access.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: result, Set })
const roles = (...args) => Array.from(result.navigationForJobs(...args))

test("system owner keeps unrestricted navigation without employee assignments", () => {
  assert.deepEqual(roles("owner", null, []), ["owner"])
})
test("one person can have Accounting, Finance and HR navigation together", () => {
  assert.deepEqual(roles("staff", "contract", [
    { job_role: "accounting_tax" }, { job_role: "finance" }, { job_role: "hr" },
  ]), ["finance", "hr", "staff"])
})
test("external status and unassigned accounts never inherit internal legacy navigation", () => {
  for (const status of ["client", "vendor", "consultant"]) {
    assert.deepEqual(roles("director", status, [{ job_role: "finance_director" }]), [])
  }
  for (const status of [null]) {
    assert.deepEqual(roles("director", status, [{ job_role: "finance_director" }]), ["staff"])
  }
  assert.deepEqual(roles("finance", "permanent", []), ["staff"])
})
test("readonly preview displays only the selected role", () => {
  assert.deepEqual(roles("owner", "permanent", [{ job_role: "finance" }], "hr"), ["hr"])
})
