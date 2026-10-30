"use client"

import Link, { useLinkStatus } from "next/link"
import type { ComponentProps } from "react"

function NavigationFeedback() {
  const { pending } = useLinkStatus()
  return pending ? (
    <span role="status" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 overflow-hidden bg-brand/10">
      <span className="loading-progress block h-full w-1/3 bg-brand" />
      <span className="sr-only">Halaman sedang dimuat...</span>
    </span>
  ) : null
}

export function NavigationLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <NavigationFeedback />
    </Link>
  )
}
