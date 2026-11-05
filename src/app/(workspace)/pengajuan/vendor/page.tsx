import { redirect } from "next/navigation"
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const query = await searchParams
  const messages = new URLSearchParams()
  if (query.error) messages.set("error", query.error)
  if (query.notice) messages.set("notice", query.notice)
  redirect(`/vendor${messages.size ? `?${messages}` : ""}`)
}
