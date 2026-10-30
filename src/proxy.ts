import { NextResponse, type NextRequest } from "next/server"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config"

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    if (request.nextUrl.pathname === "/setup") return NextResponse.next()
    return NextResponse.redirect(new URL("/setup", request.url))
  }

  let response = NextResponse.next({ request })

  function redirectWithSession(url: URL) {
    const redirect = NextResponse.redirect(url)
    // Refreshes and expired-session cleanup must reach the browser even when
    // this request redirects instead of rendering a page.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }
  const {url,key}=getSupabaseConfig()
  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(
          cookiesToSet: {
            name: string
            value: string
            options: CookieOptions
          }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error && error.name !== "AuthSessionMissingError") {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("error", "session_verification")
    if (
      request.nextUrl.pathname !== "/login" ||
      request.nextUrl.searchParams.get("error") !== "session_verification"
    ) {
      return redirectWithSession(loginUrl)
    }
  }

  if (!user && request.nextUrl.pathname !== "/login") {
    return redirectWithSession(new URL("/login", request.url))
  }
  if (user && request.nextUrl.pathname === "/login") {
    return redirectWithSession(new URL("/dashboard", request.url))
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
