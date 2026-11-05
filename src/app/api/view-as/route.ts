import { requireWorkspace } from "@/lib/auth/context"
import {
  clearViewAsCookie,
  setViewAsCookie,
} from "@/lib/auth/view-as"
import { previewRoles } from "@/lib/auth/view-as-roles"

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  return origin !== null && origin === new URL(request.url).origin
}

function isPreviewRole(
  role: unknown,
): role is (typeof previewRoles)[number] {
  return (
    typeof role === "string" &&
    previewRoles.includes(role as (typeof previewRoles)[number])
  )
}

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return Response.json({ error: "Permintaan tidak valid." }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Pilih peran pratinjau yang valid." }, { status: 400 })
  }

  const role =
    typeof body === "object" && body !== null && "role" in body
      ? body.role
      : null
  if (!isPreviewRole(role))
    return Response.json({ error: "Pilih peran pratinjau yang valid." }, { status: 400 })

  const workspace = await requireWorkspace()
  if (workspace.actorRole !== "owner")
    return Response.json(
      { error: "Hanya Superuser dapat menggunakan pratinjau peran." },
      { status: 403 },
    )

  await setViewAsCookie(
    workspace.supabase,
    workspace.user.id,
    workspace.organizationId,
    role,
  )
  return Response.json({ ok: true })
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request))
    return Response.json({ error: "Permintaan tidak valid." }, { status: 403 })

  await clearViewAsCookie()
  return Response.json({ ok: true })
}
