import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// Verify buildFinancialStatements logic by loading TS or testing equivalent math
// Since Node 24 supports type-stripping on .ts imports or we can test via tsx/node --experimental-strip-types
const moduleUrl = new URL("../src/lib/accounting/financial-reports.ts", import.meta.url)

test("Financial statements calculate balanced Balance Sheet and Income Statement", async () => {
  const { buildFinancialStatements } = await import(moduleUrl.href)

  const accounts = [
    { code: "1110", name: "Kas & Bank", account_type: "asset", normal_balance: "debit" },
    { code: "2110", name: "Utang Usaha", account_type: "liability", normal_balance: "credit" },
    { code: "3100", name: "Modal Disetor", account_type: "equity", normal_balance: "credit" },
    { code: "4100", name: "Pendapatan Jasa", account_type: "revenue", normal_balance: "credit" },
    { code: "5100", name: "Beban Operasional", account_type: "expense", normal_balance: "debit" },
  ]

  const trialBalance = [
    // Modal 100.000.000, Pendapatan 50.000.000, Beban 20.000.000, Utang 10.000.000 => Kas = 140.000.000
    { entity_id: "e1", period_id: "p1", account_code: "1110", account_name: "Kas & Bank", debit_total: 140000000, credit_total: 0, net_debit_balance: 140000000 },
    { entity_id: "e1", period_id: "p1", account_code: "2110", account_name: "Utang Usaha", debit_total: 0, credit_total: 10000000, net_debit_balance: -10000000 },
    { entity_id: "e1", period_id: "p1", account_code: "3100", account_name: "Modal Disetor", debit_total: 0, credit_total: 100000000, net_debit_balance: -100000000 },
    { entity_id: "e1", period_id: "p1", account_code: "4100", account_name: "Pendapatan Jasa", debit_total: 0, credit_total: 50000000, net_debit_balance: -50000000 },
    { entity_id: "e1", period_id: "p1", account_code: "5100", account_name: "Beban Operasional", debit_total: 20000000, credit_total: 0, net_debit_balance: 20000000 },
  ]

  const result = buildFinancialStatements(trialBalance, accounts, { entityId: "e1", periodId: "p1" })

  assert.equal(result.incomeStatement.totalRevenue, 50000000)
  assert.equal(result.incomeStatement.totalExpense, 20000000)
  assert.equal(result.incomeStatement.netIncome, 30000000)
  assert.equal(result.balanceSheet.totalAssets, 140000000)
  assert.equal(result.balanceSheet.totalLiabilities, 10000000)
  assert.equal(result.balanceSheet.totalEquityBase, 100000000)
  assert.equal(result.balanceSheet.currentEarnings, 30000000)
  assert.equal(result.balanceSheet.totalLiabilitiesAndEquity, 140000000)
  assert.equal(result.balanceSheet.isBalanced, true)
})

test("Migration 20261112000100 includes RLS and writable guards", () => {
  const sql = readFileSync(
    resolve("supabase/migrations/20261112000100_accounting_tax_hr_project_enhancements.sql"),
    "utf8",
  )
  assert.match(sql, /enable row level security/)
  assert.match(sql, /gsp_private\.assert_writable\(\)/)
  assert.match(sql, /leave_requests/)
  assert.match(sql, /payroll_runs/)
  assert.match(sql, /bank_statement_lines/)
  assert.match(sql, /project_timesheets/)
})
