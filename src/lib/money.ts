/** Database values use a decimal point; user-facing values use Indonesian separators. */
export function canonicalAmount(value: string | number | null | undefined): string | null {
  if (value === "" || value == null) return ""
  const raw = typeof value === "number" ? (Number.isFinite(value) ? value.toFixed(2) : "invalid") : value
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(raw)) return null
  const negative = raw.startsWith("-")
  const [integer, fraction = ""] = raw.replace(/^-/, "").split(".")
  return `${negative ? "-" : ""}${integer.replace(/^0+(?=\d)/, "")}.${fraction.padEnd(2, "0")}`
}

export function formatAmount(value: string | number | null | undefined): string {
  const canonical = canonicalAmount(value)
  if (canonical == null) return "Nominal tidak valid"
  if (!canonical) return ""
  const [integer, fraction] = canonical.split(".")
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction}`
}

export function formatCurrency(value: string | number | null | undefined): string {
  const amount = formatAmount(value)
  if (!amount) return "—"
  if (amount === "Nominal tidak valid") return amount
  return amount.startsWith("-") ? `-Rp\u00a0${amount.slice(1)}` : `Rp\u00a0${amount}`
}

export function parseMoneyInput(raw: string, allowNegative = false): { canonical: string; display: string; error: string } {
  const text = raw.trim().replace(/^(-?)Rp\s*/i, "$1").trim()
  if (!text) return { canonical: "", display: "", error: "" }
  const sign = allowNegative ? "-?" : ""
  // A point is ONLY a grouping separator. Reject ambiguous US decimals/pastes.
  if (!new RegExp(`^${sign}(?:\\d+|\\d{1,3}(?:\\.\\d{3})+)(?:,\\d{0,2})?$`).test(text)) {
    return { canonical: "invalid", display: raw, error: "Gunakan titik untuk ribuan dan koma untuk desimal, maksimal 2 angka. Contoh: 1.250.000,50." }
  }
  const [whole, fraction] = text.replaceAll(".", "").split(",")
  const integer = whole.replace(/^(-?)0+(?=\d)/, "$1")
  return {
    canonical: canonicalAmount(`${integer}${fraction ? `.${fraction}` : ""}`)!,
    display: integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (fraction === undefined ? "" : `,${fraction}`),
    error: "",
  }
}
