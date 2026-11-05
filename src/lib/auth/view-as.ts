import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import type { OrganizationRole } from "@/lib/auth/context"
import { previewRoles } from "@/lib/auth/view-as-roles"

const cookieName = "gsp_view_as"
const maxAgeSeconds = 4 * 60 * 60

type ViewAsPayload = {
  role: Exclude<OrganizationRole, "owner">
  userId: string
  organizationId: string
  expiresAt: number
}

export type ViewAsState = {
  isActive: boolean
  role: Exclude<OrganizationRole, "owner"> | null
  isInvalid: boolean
}

function signature(payload: string, accessToken: string) {
  return createHmac("sha256", accessToken).update(payload).digest("base64url")
}

function encode(payload: ViewAsPayload, accessToken: string) {
  const serialized = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${serialized}.${signature(serialized, accessToken)}`
}

function decode(
  value: string,
  accessToken: string,
  userId: string,
  organizationId: string,
): ViewAsPayload | null {
  const [serialized, suppliedSignature, extra] = value.split(".")
  if (!serialized || !suppliedSignature || extra) return null

  const expectedSignature = signature(serialized, accessToken)
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return null

  try {
    const payload = JSON.parse(
      Buffer.from(serialized, "base64url").toString("utf8"),
    ) as ViewAsPayload
    if (
      !previewRoles.includes(payload.role) ||
      payload.userId !== userId ||
      payload.organizationId !== organizationId ||
      !Number.isSafeInteger(payload.expiresAt) ||
      payload.expiresAt <= Date.now()
    )
      return null
    return payload
  } catch {
    return null
  }
}

async function getAccessToken(
  supabase: {
    auth: {
      getSession: () => Promise<{
        data: { session: { access_token: string } | null }
        error: { message: string } | null
      }>
    }
  },
) {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error(`Gagal memverifikasi sesi pratinjau: ${error.message}`)
  if (!data.session?.access_token)
    throw new Error("Sesi aktif diperlukan untuk mode lihat sebagai.")
  return data.session.access_token
}

export async function readViewAsState(
  supabase: Parameters<typeof getAccessToken>[0],
  userId: string,
  organizationId: string,
): Promise<ViewAsState> {
  const value = (await cookies()).get(cookieName)?.value
  if (!value) return { isActive: false, role: null, isInvalid: false }

  const token = await getAccessToken(supabase)
  const payload = decode(value, token, userId, organizationId)
  return payload
    ? { isActive: true, role: payload.role, isInvalid: false }
    : { isActive: true, role: "auditor", isInvalid: true }
}

export async function setViewAsCookie(
  supabase: Parameters<typeof getAccessToken>[0],
  userId: string,
  organizationId: string,
  role: Exclude<OrganizationRole, "owner">,
) {
  const token = await getAccessToken(supabase)
  const payload: ViewAsPayload = {
    role,
    userId,
    organizationId,
    expiresAt: Date.now() + maxAgeSeconds * 1000,
  }
  ;(await cookies()).set(cookieName, encode(payload, token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  })
}

export async function clearViewAsCookie() {
  ;(await cookies()).delete(cookieName)
}
