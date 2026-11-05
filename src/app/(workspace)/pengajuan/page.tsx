import { redirect } from "next/navigation"

// Compatibility for existing bookmarks; each business domain has its own page.
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string; error?: string; notice?: string }> }) {
  const query = await searchParams
  const path = query.view === "penjualan" ? "/pengajuan/penjualan" : query.view === "vendor" ? "/vendor" : "/pengajuan/pembelian"
  const messages = new URLSearchParams()
  if (query.error) messages.set("error", query.error)
  if (query.notice) messages.set("notice", query.notice)
  redirect(path + (messages.size ? "?" + messages : ""))
}
