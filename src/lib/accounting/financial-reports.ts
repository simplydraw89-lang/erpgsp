export type TrialBalanceRow = {
  entity_id: string
  period_id: string
  account_code: string
  account_name: string
  debit_total: number | string
  credit_total: number | string
  net_debit_balance: number | string
}

export type CoaMetaRow = {
  code: string
  name: string
  account_type: string
  normal_balance: string
}

export type ReportLine = {
  accountCode: string
  accountName: string
  accountType: string
  amount: number
}

export type FinancialStatementSummary = {
  incomeStatement: {
    revenues: ReportLine[]
    expenses: ReportLine[]
    totalRevenue: number
    totalExpense: number
    netIncome: number
  }
  balanceSheet: {
    assets: ReportLine[]
    liabilities: ReportLine[]
    equities: ReportLine[]
    totalAssets: number
    totalLiabilities: number
    totalEquityBase: number
    currentEarnings: number
    totalLiabilitiesAndEquity: number
    isBalanced: boolean
  }
}

function toNum(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function buildFinancialStatements(
  trialBalance: TrialBalanceRow[],
  accounts: CoaMetaRow[],
  filters?: { entityId?: string | null; periodId?: string | null },
): FinancialStatementSummary {
  const accountMap = new Map(accounts.map((acc) => [acc.code, acc]))
  const grouped = new Map<string, { code: string; name: string; netDebit: number }>()

  for (const row of trialBalance) {
    if (filters?.entityId && row.entity_id !== filters.entityId) continue
    if (filters?.periodId && row.period_id !== filters.periodId) continue
    const prev = grouped.get(row.account_code)
    const netDebit = toNum(row.net_debit_balance)
    if (prev) {
      prev.netDebit += netDebit
    } else {
      grouped.set(row.account_code, {
        code: row.account_code,
        name: row.account_name,
        netDebit,
      })
    }
  }

  const revenues: ReportLine[] = []
  const expenses: ReportLine[] = []
  const assets: ReportLine[] = []
  const liabilities: ReportLine[] = []
  const equities: ReportLine[] = []

  const sortedCodes = Array.from(grouped.keys()).sort()
  for (const code of sortedCodes) {
    const item = grouped.get(code)!
    const meta = accountMap.get(code)
    const type = meta?.account_type ?? inferTypeFromCode(code)
    if (Math.abs(item.netDebit) < 0.005) continue

    if (type === "revenue") {
      revenues.push({
        accountCode: code,
        accountName: item.name,
        accountType: type,
        amount: -item.netDebit,
      })
    } else if (type === "expense") {
      expenses.push({
        accountCode: code,
        accountName: item.name,
        accountType: type,
        amount: item.netDebit,
      })
    } else if (type === "asset") {
      assets.push({
        accountCode: code,
        accountName: item.name,
        accountType: type,
        amount: item.netDebit,
      })
    } else if (type === "liability") {
      liabilities.push({
        accountCode: code,
        accountName: item.name,
        accountType: type,
        amount: -item.netDebit,
      })
    } else if (type === "equity") {
      equities.push({
        accountCode: code,
        accountName: item.name,
        accountType: type,
        amount: -item.netDebit,
      })
    }
  }

  const totalRevenue = revenues.reduce((sum, r) => sum + r.amount, 0)
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0)
  const netIncome = totalRevenue - totalExpense

  const totalAssets = assets.reduce((sum, a) => sum + a.amount, 0)
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.amount, 0)
  const totalEquityBase = equities.reduce((sum, q) => sum + q.amount, 0)
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquityBase + netIncome

  return {
    incomeStatement: {
      revenues,
      expenses,
      totalRevenue,
      totalExpense,
      netIncome,
    },
    balanceSheet: {
      assets,
      liabilities,
      equities,
      totalAssets,
      totalLiabilities,
      totalEquityBase,
      currentEarnings: netIncome,
      totalLiabilitiesAndEquity,
      isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1,
    },
  }
}

function inferTypeFromCode(code: string): string {
  const first = code.trim().charAt(0)
  if (first === "1") return "asset"
  if (first === "2") return "liability"
  if (first === "3") return "equity"
  if (first === "4") return "revenue"
  return "expense"
}
