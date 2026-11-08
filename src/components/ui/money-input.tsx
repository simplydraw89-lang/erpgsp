"use client"

import { useEffect, useId, useRef, useState, type ComponentProps } from "react"
import { canonicalAmount, formatAmount, parseMoneyInput } from "@/lib/money"

type Props = Omit<ComponentProps<"input">,"type"|"value"|"defaultValue"|"onChange"|"min"|"max"|"step"> & {
  value?: string | number | null; defaultValue?: string | number | null;
  onValueChange?: (canonical: string) => void; min?: number | string; max?: number | string; allowNegative?: boolean
}

function normalizeMoneyInput(raw: string, previousDisplay = ""): string {
  let text = raw.trim().replace(/^(-?)Rp\s*/i, "$1").trim()
  if (!text) return ""

  // Jika ada karakter ilegal atau format US terbalik seperti "1,234.56" (koma sebelum titik)
  if (/[^0-9,.-]/.test(text)) return text
  const firstComma = text.indexOf(",")
  const lastDot = text.lastIndexOf(".")
  if (firstComma !== -1 && lastDot !== -1 && firstComma < lastDot) return text
  if ((text.match(/,/g) || []).length > 1) return text

  // 1. Pada keyboard HP/mobile: jika pengguna menekan '.' di akhir (misal "1000." atau "1.250.")
  // tombol titik pada keypad desimal HP otomatis diubah menjadi koma desimal Indonesia.
  if (text.endsWith(".") && !text.includes(",")) {
    const clean = text.slice(0, -1).replace(/[^0-9-]/g, "")
    return (clean || "0") + ","
  }

  // 2. Jika ada koma, proses desimal
  if (text.includes(",")) {
    const parts = text.split(",")
    const sign = parts[0].startsWith("-") ? "-" : ""
    const cleanWhole = parts[0].replace(/[^0-9]/g, "")
    const cleanFraction = parts.slice(1).join("").replace(/[^0-9]/g, "").slice(0, 2)
    return (sign ? "-" : "") + (cleanWhole || "0") + "," + cleanFraction
  }

  // 3. Jika pengguna menempelkan teks (paste) berformat desimal titik tunggal (misal "1250000.50"):
  const isPaste = Math.abs(text.length - previousDisplay.length) > 1
  const dotParts = text.split(".")
  if (isPaste && dotParts.length === 2 && dotParts[1].length > 0 && dotParts[1].length <= 2) {
    const sign = dotParts[0].startsWith("-") ? "-" : ""
    const cleanWhole = dotParts[0].replace(/[^0-9]/g, "")
    const cleanFraction = dotParts[1].replace(/[^0-9]/g, "")
    return (sign ? "-" : "") + (cleanWhole || "0") + "," + cleanFraction
  }

  // 4. Jika sedang mengetik/menghapus angka bulat:
  // Bersihkan titik ribuan yang lama agar penomoran ribuan diformat ulang secara dinamis tanpa error
  const sign = text.startsWith("-") ? "-" : ""
  const cleanDigits = text.replace(/[^0-9]/g, "")
  return (sign ? "-" : "") + cleanDigits
}

export function MoneyInput({ name, value, defaultValue = "", onValueChange, min, max, allowNegative = false, onBlur, ...props }: Props) {
  const [uncontrolled,setUncontrolled] = useState(defaultValue)
  const source = canonicalAmount(value === undefined ? uncontrolled : value) ?? "invalid"
  const [editing,setEditing] = useState({source,display:formatAmount(value ?? defaultValue),error:""})
  const current = editing.source === source ? editing : {source,display:formatAmount(value === undefined ? uncontrolled : value),error:source === "invalid" ? "Nominal tidak valid." : ""}
  const input = useRef<HTMLInputElement>(null)
  const errorId = useId()

  useEffect(() => {
    const element = input.current
    element?.setCustomValidity(current.error)
  },[current.error])

  useEffect(() => {
    const element = input.current
    const form = element?.form
    // Draft buttons bypass required validation, but must never bypass malformed money.
    const guard = (event: Event) => {if (element?.validity.customError && !element.matches(":disabled")) {event.preventDefault();event.stopImmediatePropagation();element.reportValidity()}}
    form?.addEventListener("submit",guard,true)
    return () => form?.removeEventListener("submit",guard,true)
  },[])

  return (
    <>
      <input
        title="Titik ribuan otomatis; gunakan koma untuk desimal. Contoh: 1.250.000,50."
        {...props}
        ref={input}
        type="text"
        inputMode="decimal"
        name={name ? `${name}__display` : undefined}
        value={current.display}
        aria-invalid={Boolean(current.error) || undefined}
        aria-describedby={[props["aria-describedby"],current.error ? errorId : undefined].filter(Boolean).join(" ") || undefined}
        onKeyDown={event => {
          if ((event.key === "." || event.key === ",") && !current.display.includes(",")) {
            const el = event.currentTarget
            const start = el.selectionStart ?? el.value.length
            const end = el.selectionEnd ?? el.value.length
            const raw = el.value.slice(0, start) + "," + el.value.slice(end)
            const normalized = normalizeMoneyInput(raw, current.display)
            const next = parseMoneyInput(normalized, allowNegative)
            if (!next.error) {
              event.preventDefault()
              el.setCustomValidity("")
              setEditing({ source: next.canonical, display: next.display, error: "" })
              setUncontrolled(next.canonical)
              onValueChange?.(next.canonical)
              requestAnimationFrame(() => {
                if (!el.isConnected) return
                el.setSelectionRange(next.display.length, next.display.length)
              })
              return
            }
          }
          props.onKeyDown?.(event)
        }}
        onChange={event => {
          const element = event.currentTarget
          const raw = element.value
          const caret = element.selectionStart ?? raw.length
          const isAtEnd = caret >= raw.length
          const logical = raw.slice(0, caret).replace(/[^0-9,-]/g, "").length
          const normalized = normalizeMoneyInput(raw, current.display)
          const next = parseMoneyInput(normalized, allowNegative)

          if (!next.error && next.canonical && ((min !== undefined && Number(next.canonical)<Number(min)) || (max !== undefined && Number(next.canonical)>Number(max)))) {
            next.error = `Nominal harus ${min !== undefined ? `minimal ${formatAmount(min)}` : ""}${min !== undefined && max !== undefined ? " dan " : ""}${max !== undefined ? `maksimal ${formatAmount(max)}` : ""}.`
          }

          element.setCustomValidity(next.error)
          const nextSource = next.error ? source : next.canonical
          setEditing({ source: nextSource, display: next.display, error: next.error })

          if (!next.error) {
            setUncontrolled(next.canonical)
            onValueChange?.(next.canonical)
          }

          if (!next.error) {
            requestAnimationFrame(() => {
              if (!element.isConnected) return
              if (isAtEnd) {
                element.setSelectionRange(next.display.length, next.display.length)
              } else {
                let position = 0, count = 0
                while (position < next.display.length && count < logical) {
                  if (/[0-9,-]/.test(next.display[position])) count++
                  position++
                }
                element.setSelectionRange(position, position)
              }
            })
          }
        }}
        onBlur={event => {
          if (!current.error) {
            setEditing({ source, display: formatAmount(source), error: "" })
          }
          onBlur?.(event)
        }}
      />
      {name && <input type="hidden" name={name} value={current.error ? "invalid" : source} disabled={props.disabled} />}
      {current.error && <span id={errorId} role="alert" className="mt-1 block text-xs text-red-700">{current.error}</span>}
    </>
  )
}
