import { NextResponse } from "next/server"
import { requireWorkspace } from "@/lib/auth/context"

export async function GET() {
  const w = await requireWorkspace()
  const headers = {"Cache-Control":"private, no-store"}
  if (w.isReadOnlyPreview) return NextResponse.json({error:"Notifikasi pribadi tidak tersedia pada mode pratinjau."},{status:403,headers})
  const result = await w.supabase.rpc("sales_notifications",{p_org:w.organizationId})
  if (result.error) return NextResponse.json({error:"Notifikasi gagal dimuat. Periksa koneksi dan akses database."},{status:503,headers})
  return NextResponse.json(result.data,{headers})
}
