import { createClient } from "@/lib/supabase/server"
import { extractDocument } from "../extract"
import { readViewAsState } from "@/lib/auth/view-as"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error:"Asal permintaan tidak diizinkan." }, { status:403 })
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error:"Lampiran tidak ditemukan." }, { status:404 })
  const supabase = await createClient()
  const { data:{user}, error } = await supabase.auth.getUser()
  if (error || !user) return Response.json({ error:"Silakan masuk kembali." }, { status:401 })
  const { data:attachment } = await supabase.from("procurement_attachments").select("storage_path,organization_id,byte_size,content_type").eq("id",id).maybeSingle()
  if (!attachment) return Response.json({ error:"Lampiran tidak ditemukan atau tidak dapat diakses." }, { status:404 })
  const preview = await readViewAsState(supabase,user.id,attachment.organization_id)
  if (preview.isActive || preview.isInvalid) return Response.json({ error:"Pembacaan dinonaktifkan dalam mode pratinjau." }, { status:403 })
  if (Number(attachment.byte_size)>10*1024*1024) return Response.json({error:"Dokumen maksimal 10 MB."},{status:413})
  const {data:file,error:downloadError} = await supabase.storage.from("procurement-documents").download(attachment.storage_path)
  if (downloadError || !file) return Response.json({error:"Dokumen belum dapat dibaca."},{status:400})
  const bytes=Buffer.from(await file.arrayBuffer())
  const extension=attachment.content_type==="application/pdf"?"pdf":attachment.content_type==="image/png"?"png":"jpg"
  return Response.json({ id,...await extractDocument(bytes,extension) },{headers:{"Cache-Control":"private, no-store"}})
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Lampiran tidak ditemukan." }, { status: 404 })
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: "Silakan masuk kembali." }, { status: 401 })
  const { data, error: metadataError } = await supabase.from("procurement_attachments").select("storage_path,file_name,content_type,byte_size").eq("id", id).maybeSingle()
  if (metadataError) return Response.json({ error: "Informasi dokumen gagal dimuat. Coba kembali." }, { status: 502 })
  if (!data) return Response.json({ error: "Lampiran tidak ditemukan atau tidak dapat diakses." }, { status: 404 })
  if (!["application/pdf", "image/png", "image/jpeg"].includes(data.content_type)) return Response.json({ error: "Format dokumen tidak mendukung pratinjau." }, { status: 415 })
  if (Number(data.byte_size) > 10 * 1024 * 1024) return Response.json({ error: "Dokumen maksimal 10 MB." }, { status: 413 })
  const { data: file, error } = await supabase.storage.from("procurement-documents").download(data.storage_path)
  if (error || !file) return Response.json({ error: "Dokumen belum dapat ditampilkan. Coba kembali." }, { status: 502 })
  const filename = encodeURIComponent(data.file_name).replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
  return new Response(file.stream(), { headers: {
    "Content-Type": data.content_type,
    "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  } })
}
