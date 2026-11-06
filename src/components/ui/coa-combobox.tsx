"use client"

import { useState, useRef, useEffect } from "react"
import { type ProcurementAccount } from "@/lib/procurement-ui"

export function CoaCombobox({
  accounts,
  value,
  onChange,
  disabled = false,
  className = ""
}: {
  accounts: ProcurementAccount[]
  value?: string
  onChange: (id: string) => void
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedAccount = accounts.find(a => a.id === value)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredAccounts = accounts.filter(a => {
    if (!query) return true
    const q = query.toLowerCase()
    return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
  })

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled || !accounts.length}
        onClick={() => {
          if (!disabled && accounts.length) {
            setOpen(prev => !prev)
            setQuery("")
          }
        }}
        className={`flex w-full items-center justify-between truncate rounded-lg border border-line bg-white px-3 py-2 text-left text-sm focus:border-brand focus:outline-none disabled:bg-canvas disabled:opacity-60 ${className}`}
      >
        <span className={`truncate ${selectedAccount ? "font-medium text-slate-900" : "text-muted"}`}>
          {selectedAccount ? `${selectedAccount.code} · ${selectedAccount.name}` : "Pilih / Cari COA..."}
        </span>
        <span className="ml-2 text-xs text-muted">▼</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full min-w-[260px] overflow-hidden rounded-lg border border-line bg-white shadow-xl sm:min-w-[320px]">
          <div className="border-b border-line p-2">
            <input
              type="text"
              autoFocus
              placeholder="Ketik kode atau nama COA..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full rounded-md border border-line bg-canvas px-2.5 py-1.5 text-xs focus:border-brand focus:bg-white focus:outline-none"
            />
          </div>

          <div className="max-h-48 overflow-y-auto p-1 text-xs">
            {filteredAccounts.length > 0 ? (
              filteredAccounts.map(a => {
                const isSelected = a.id === value
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      onChange(a.id)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left transition-colors hover:bg-brand-light hover:text-brand ${
                      isSelected ? "bg-brand/10 font-semibold text-brand" : "text-slate-800"
                    }`}
                  >
                    <span className="truncate">{a.code} · {a.name}</span>
                    {isSelected && <span className="ml-2 font-bold text-brand">✓</span>}
                  </button>
                )
              })
            ) : (
              <p className="p-3 text-center text-muted">COA tidak ditemukan</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
