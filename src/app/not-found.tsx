import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-4xl font-extrabold text-blue-600">404</p>
        <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
          Halaman Tidak Ditemukan
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Halaman yang Anda tuju mungkin sudah dipindahkan, telah selesai diproses/disetujui, atau URL tidak valid.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/dashboard">
            <Button variant="primary" className="w-full sm:w-auto">
              Kembali ke Dashboard
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" className="w-full sm:w-auto">
              Halaman Login
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
