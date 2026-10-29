import Link from "next/link"
import { Activity } from "lucide-react"
import { Card } from "@/components/ui/card"
import { LoginForm } from "./login-form"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const initialError =
    error === "session_verification"
      ? "Sesi tidak dapat diverifikasi. Silakan coba masuk kembali."
      : undefined

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <Card className="w-full max-w-md p-7 md:p-9">
        <Link href="/" className="mb-8 inline-flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-brand text-white">
            <Activity size={21} />
          </span>
          <span>
            <span className="block text-sm font-bold text-ink">GSP Group</span>
            <span className="block text-xs text-muted">Enterprise workspace</span>
          </span>
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand">Selamat datang</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Masuk ke workspace</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Gunakan akun perusahaan Anda. Hak akses dan organisasi diverifikasi dari Supabase.
        </p>
        <LoginForm initialError={initialError} />
      </Card>
    </main>
  )
}
