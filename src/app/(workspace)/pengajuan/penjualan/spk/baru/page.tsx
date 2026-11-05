import { requireWorkspace } from "@/lib/auth/context"
import { Card } from "@/components/ui/card"
import { NavigationLink as Link } from "@/components/ui/navigation-link"
import { SalesMenu } from "@/components/sales/sales-menu"

export default async function NewSpkPage({ searchParams }: { searchParams: Promise<{sph?:string}> }) {
  const { sph } = await searchParams
  const w = await requireWorkspace()
  if (!sph || !/^[0-9a-f-]{36}$/i.test(sph)) return <div className="space-y-4"><h1 className="text-3xl font-bold">Buat SPK</h1><p>Pilih Buat SPK dari SPH yang telah disetujui.</p><Link href="/pengajuan/penjualan/sph" className="text-brand">Buka daftar SPH →</Link></div>
  const result = await w.supabase.rpc("sph_spk_context",{p_org:w.organizationId,p_id:sph})
  if (result.error) return <div className="space-y-4"><h1 className="text-3xl font-bold">Buat SPK</h1><p role="alert">{result.error.message}</p><Link href="/pengajuan/penjualan/sph" className="text-brand">Kembali ke daftar SPH</Link></div>
  const context = result.data
  return <div className="space-y-6"><Link href="/pengajuan/penjualan/spk" className="text-sm text-brand">← Daftar SPK</Link><h1 className="text-3xl font-bold">Buat SPK</h1><SalesMenu active="spk" /><Card className="space-y-3 p-5"><h2 className="font-semibold">Berdasarkan SPH No. {context.sph_number}</h2><p>{context.title}</p><p className="text-sm text-muted">Klien: {context.client_name}</p><p className="text-sm text-muted">Referensi SPH telah diverifikasi. Rincian form SPK akan ditambahkan setelah arahan berikutnya.</p></Card></div>
}
