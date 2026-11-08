"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function AutoRefreshOnFocus() {
  const router = useRouter()

  useEffect(() => {
    function onFocus() {
      router.refresh()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        router.refresh()
      }
    })
    return () => {
      window.removeEventListener("focus", onFocus)
    }
  }, [router])

  return null
}
