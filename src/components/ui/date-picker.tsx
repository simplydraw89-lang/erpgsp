"use client"

import { useState, useEffect, useRef, type ChangeEvent } from "react"
import { Calendar } from "lucide-react"

interface DatePickerProps {
  name: string
  value?: string // format: YYYY-MM-DD
  defaultValue?: string // format: YYYY-MM-DD
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
  onValueChange?: (isoDate: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
  id?: string
}

// Normalize any date string (YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY) into YYYY-MM-DD
function normalizeToIso(raw: string | null | undefined): string {
  if (!raw) return ""
  const clean = raw.trim().slice(0, 10)
  const parts = clean.split(/[-/.]/)
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`
    }
    if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
    }
  }
  return clean
}

// Convert YYYY-MM-DD (or DD-MM-YYYY) to DD/MM/YYYY
function toDisplay(iso: string | null | undefined): string {
  if (!iso) return ""
  const norm = normalizeToIso(iso)
  const parts = norm.split("-")
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return iso
}

// Convert DD/MM/YYYY to YYYY-MM-DD
function toIso(display: string): string {
  if (!display) return ""
  const parts = display.trim().split("/")
  if (parts.length === 3 && parts[2]?.length === 4) {
    const d = parts[0].padStart(2, "0")
    const m = parts[1].padStart(2, "0")
    const y = parts[2]
    return `${y}-${m}-${d}`
  }
  return ""
}

export function DatePicker({
  name,
  value,
  defaultValue = "",
  onChange,
  onValueChange,
  placeholder = "dd/mm/yyyy",
  required = false,
  disabled = false,
  className = "mt-1 block min-h-10 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:bg-canvas",
  id,
}: DatePickerProps) {
  const isControlled = value !== undefined
  const initialIso = normalizeToIso(isControlled ? (value ?? "") : defaultValue)
  const [internalIso, setInternalIso] = useState<string>(initialIso)
  const [displayValue, setDisplayValue] = useState<string>(toDisplay(initialIso))
  const hiddenDateRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isControlled) {
      const norm = normalizeToIso(value ?? "")
      setInternalIso(norm)
      setDisplayValue(toDisplay(norm))
    }
  }, [value, isControlled])

  // Handle manual typing with auto slash formatting (DD/MM/YYYY)
  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value.replace(/[^0-9/]/g, "")
    
    // Auto-insert slash if user just types numbers
    const digits = raw.replace(/\D/g, "")
    if (digits.length <= 8) {
      if (digits.length > 4) {
        raw = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`
      } else if (digits.length > 2) {
        raw = `${digits.slice(0, 2)}/${digits.slice(2, 4)}`
      } else {
        raw = digits
      }
    }

    setDisplayValue(raw)

    const iso = toIso(raw)
    if (iso && iso.length === 10) {
      setInternalIso(iso)
      onValueChange?.(iso)
      if (onChange) {
        const synthEvent = {
          ...e,
          target: { ...e.target, name, value: iso },
        } as unknown as ChangeEvent<HTMLInputElement>
        onChange(synthEvent)
      }
    } else if (!raw) {
      setInternalIso("")
      onValueChange?.("")
      if (onChange) {
        const synthEvent = {
          ...e,
          target: { ...e.target, name, value: "" },
        } as unknown as ChangeEvent<HTMLInputElement>
        onChange(synthEvent)
      }
    }
  }

  // When user uses the native calendar popup button
  function handleNativePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const iso = e.target.value
    setInternalIso(iso)
    setDisplayValue(toDisplay(iso))
    onValueChange?.(iso)
    if (onChange) {
      onChange(e)
    }
  }

  function openNativePicker() {
    if (disabled) return
    const picker = hiddenDateRef.current
    if (picker) {
      if (typeof picker.showPicker === "function") {
        picker.showPicker()
      } else {
        picker.focus()
        picker.click()
      }
    }
  }

  return (
    <div className="relative flex items-center">
      {/* Hidden real input that holds YYYY-MM-DD for form submit */}
      <input
        type="hidden"
        name={name}
        value={internalIso}
        required={required}
      />

      {/* Visible formatted text input (DD/MM/YYYY) */}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={displayValue}
        onChange={handleTextChange}
        disabled={disabled}
        className={`${className} pr-10`}
        maxLength={10}
      />

      {/* Hidden native date input for calendar popup */}
      <input
        ref={hiddenDateRef}
        type="date"
        tabIndex={-1}
        value={internalIso}
        onChange={handleNativePickerChange}
        disabled={disabled}
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
        aria-hidden="true"
      />

      {/* Calendar icon button to trigger native picker popup */}
      <button
        type="button"
        tabIndex={-1}
        onClick={openNativePicker}
        disabled={disabled}
        className="absolute right-3 text-slate-400 hover:text-slate-600 disabled:opacity-40"
        title="Pilih tanggal dari kalender"
      >
        <Calendar size={18} />
      </button>
    </div>
  )
}
