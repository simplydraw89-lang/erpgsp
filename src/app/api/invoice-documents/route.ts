import { randomUUID } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { readViewAsState } from "@/lib/auth/view-as"
import { extractDocument } from "./extract"

export const runtime = "nodejs"
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_BYTES = 10 * 1024 * 1024

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Asal permintaan tidak diizinkan." }, { status: 403 })
  const length = Number(request.headers.get("content-length"))
  if (length > MAX_BYTES + 64 * 1024) return Response.json({ error: "Dokumen maksimal 10 MB." }, { status: 413 })
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return Response.json({ error: "Silakan masuk kembali." }, { status: 401 })
  let body: FormData
  try { body = await request.formData() } catch { return Response.json({ error: "Format unggahan tidak valid." }, { status: 400 }) }
  const branchId = String(body.get("branch_id") || "")
  const manual = body.get("mode") === "sales-manual"
  const domain = manual || body.get("mode") === "spk" ? "sales" : "procurement"
  const file = body.get("file")
  if (!uuid.test(branchId) || !(file instanceof File) || !file.size || file.size > MAX_BYTES) return Response.json({ error: "Cabang dan dokumen maksimal 10 MB wajib diisi." }, { status: 400 })
  const { data: branch } = await supabase.from("business_units").select("id,organization_id,kind").eq("id", branchId).eq("kind", "branch").maybeSingle()
  if (!branch) return Response.json({ error: "Cabang tidak ditemukan atau tidak dapat diakses." }, { status: 403 })
  const permission = await supabase.rpc("can_access_business", { p_org: branch.organization_id, p_branch: branch.id, p_domain: domain })
  if (permission.error || !permission.data) return Response.json({ error: "Akses dokumen tidak diizinkan." }, { status: 403 })
  if (domain === "sales") {
    const salesPermission = await supabase.rpc("can_upload_sales_document", { p_org: branch.organization_id, p_branch: branch.id })
    if (salesPermission.error || !salesPermission.data) return Response.json({ error: "Unggah dokumen penjualan hanya untuk peran yang berwenang pada cabang ini." }, { status: 403 })
  }
  const viewAs = await readViewAsState(supabase, user.id, branch.organization_id)
  if (viewAs.isActive || viewAs.isInvalid) return Response.json({ error: "Unggah dinonaktifkan dalam mode pratinjau." }, { status: 403 })
  const bytes = Buffer.from(await file.arrayBuffer())
  const extension = bytes.subarray(0, 5).toString() === "%PDF-" ? "pdf" : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "png" : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "jpg" : null
  if (!extension) return Response.json({ error: "Isi berkas harus PDF, PNG, atau JPEG." }, { status: 400 })
  const contentType = extension === "pdf" ? "application/pdf" : extension === "png" ? "image/png" : "image/jpeg"
  const id = randomUUID()
  const storagePath = `${branch.organization_id}/${branch.id}/${user.id}/${id}.${extension}`
  const { error: uploadError } = await supabase.storage.from("procurement-documents").upload(storagePath, bytes, { contentType, upsert: false, cacheControl: "0" })
  if (uploadError) return Response.json({ error: "Unggah privat gagal. Periksa kesiapan penyimpanan dan akses cabang." }, { status: 400 })
  const { error: metadataError } = await supabase.from("procurement_attachments").insert({ id, organization_id: branch.organization_id, branch_id: branch.id, uploaded_by: user.id, storage_path: storagePath, file_name: file.name.slice(0, 240), content_type: contentType, byte_size: file.size, domain })
  if (metadataError) return Response.json({ error: "Dokumen terunggah tetapi registrasi lampiran gagal. Hubungi Super Admin; dokumen belum terhubung ke pengajuan." }, { status: 400 })
  if (manual) return Response.json({ id }, { headers: { "Cache-Control": "private, no-store" } })
  let extraction: Awaited<ReturnType<typeof extractDocument>>
  try { extraction = await extractDocument(bytes, extension) }
  catch { extraction = { warning: "Dokumen tersimpan privat. Pembacaan gagal; isi data secara manual." } }
  return Response.json({ id, ...extraction }, { headers: { "Cache-Control": "private, no-store" } })
}
