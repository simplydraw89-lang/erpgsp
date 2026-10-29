"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export function LogoutButton() {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState("")

  async function signOut() {
    setErrorMessage("")
    const { error } = await createClient().auth.signOut()
    if (error) {
      setErrorMessage(`Gagal keluar: ${error.message}`)
      return
    }
    router.replace("/login")
    router.refresh()
  }

  return (
    <div>
      <button
        type="button"
        onClick={signOut}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-canvas hover:text-ink"
      >
        <LogOut size={16} />
        Keluar
      </button>
      {errorMessage && <p role="alert" className="mt-1 text-xs text-red-700">{errorMessage}</p>}
    </div>
  )
}
