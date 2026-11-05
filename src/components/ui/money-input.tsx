"use client"

import { useEffect, useId, useRef, useState, type ComponentProps } from "react"
import { canonicalAmount, formatAmount, parseMoneyInput } from "@/lib/money"

type Props = Omit<ComponentProps<"input">,"type"|"value"|"defaultValue"|"onChange"|"min"|"max"|"step"> & {
  value?: string | number | null; defaultValue?: string | number | null;
  onValueChange?: (canonical: string) => void; min?: number | string; max?: number | string; allowNegative?: boolean
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
  return <><input title="Titik ribuan otomatis; gunakan koma untuk desimal. Contoh: 1.250.000,50." {...props} ref={input} type="text" inputMode="decimal" name={name ? `${name}__display` : undefined} value={current.display} aria-invalid={Boolean(current.error) || undefined} aria-describedby={[props["aria-describedby"],current.error ? errorId : undefined].filter(Boolean).join(" ") || undefined} onChange={event => {
    const element=event.currentTarget
    const caret=element.selectionStart ?? element.value.length
    const logical=element.value.slice(0,caret).replace(/[^0-9,-]/g,"").length
    const next=parseMoneyInput(element.value,allowNegative)
    if (!next.error && next.canonical && ((min !== undefined && Number(next.canonical)<Number(min)) || (max !== undefined && Number(next.canonical)>Number(max)))) next.error=`Nominal harus ${min !== undefined ? `minimal ${formatAmount(min)}` : ""}${min !== undefined && max !== undefined ? " dan " : ""}${max !== undefined ? `maksimal ${formatAmount(max)}` : ""}.`
    element.setCustomValidity(next.error)
    const nextSource=next.error ? source : next.canonical
    setEditing({source:nextSource,display:next.display,error:next.error})
    if (!next.error) {setUncontrolled(next.canonical);onValueChange?.(next.canonical)}
    if (!next.error) requestAnimationFrame(() => {
      if (!element.isConnected) return
      let position=0,count=0
      while(position<next.display.length && count<logical) {if(/[0-9,-]/.test(next.display[position])) count++;position++}
      element.setSelectionRange(position,position)
    })
  }} onBlur={event=>{if (!current.error) setEditing({source,display:formatAmount(source),error:""});onBlur?.(event)}} />
    {name && <input type="hidden" name={name} value={current.error ? "invalid" : source} disabled={props.disabled} />}
    {current.error && <span id={errorId} role="alert" className="mt-1 block text-xs text-red-700">{current.error}</span>}
  </>
}
