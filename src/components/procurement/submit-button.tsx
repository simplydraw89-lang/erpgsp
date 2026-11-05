"use client"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
export function SubmitButton({ children, disabled, name, value, secondary = false }: { children: React.ReactNode; disabled?: boolean; name?: string; value?: string; secondary?: boolean }) {
  const { pending } = useFormStatus()
  return <Button type="submit" name={name} value={value} disabled={disabled || pending} variant={secondary ? "secondary" : "primary"}>{pending ? "Memproses…" : children}</Button>
}
