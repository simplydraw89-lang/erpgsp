import { CircleAlert, Database, KeyRound } from "lucide-react"
import { Card } from "@/components/ui/card"
import { LogoutButton } from "@/components/auth/logout-button"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const configured = isSupabaseConfigured()

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <Card className="w-full max-w-xl p-7 md:p-9">
        <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-brand-light text-brand">
          {configured ? <CircleAlert size={23} /> : <Database size={23} />}
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand">
          GSP Group · setup
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {configured ? "Akun belum terhubung ke organisasi" : "Hubungkan workspace ke Supabase"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          {configured
            ? "Sesi login valid, tetapi keanggotaan organisasi belum ditemukan. Minta administrator organisasi menambahkan akun Anda."
            : "Konfigurasikan URL dan anon key Supabase di .env.local, lalu jalankan migration awal dari folder supabase/migrations."}
        </p>
        {reason && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Kode setup: {reason}
          </p>
        )}
        {!configured && (
          <div className="mt-6 space-y-3 rounded-lg bg-canvas p-4 text-sm">
            <p className="flex items-center gap-2 font-medium"><KeyRound size={16} className="text-brand" /> NEXT_PUBLIC_SUPABASE_URL</p>
            <p className="flex items-center gap-2 font-medium"><KeyRound size={16} className="text-brand" /> NEXT_PUBLIC_SUPABASE_ANON_KEY</p>
          </div>
        )}
        {configured && <div className="mt-6"><LogoutButton /></div>}
      </Card>
    </main>
  )
}
