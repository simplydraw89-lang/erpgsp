import Image from "next/image"
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
    <main className="portal-background flex h-dvh w-full items-center justify-center overflow-hidden p-4">
      <div className="w-full max-w-[390px] rounded-[28px] border border-slate-200/80 bg-white/95 px-6 py-6 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.08)] backdrop-blur-md sm:px-8 sm:py-7">
        <div className="flex flex-col items-center text-center">
          {/* Top Logo Badge - circular with shadow */}
          <div className="mb-2.5 flex size-16 items-center justify-center rounded-full border border-slate-100 bg-white p-2 shadow-[0_6px_20px_rgba(0,0,0,0.06)]">
            <Image
              src="/gsp-brand-logo.jpg"
              alt="PT. Global Solusi Prima"
              width={80}
              height={80}
              priority
              unoptimized
              className="h-full w-full object-contain select-none"
            />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Welcome Back
          </h1>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Sign In to Continue
          </p>
        </div>

        <LoginForm initialError={initialError} />
      </div>
    </main>
  )
}
