import { auth } from "@/auth"

import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isOnApiAuth = req.nextUrl.pathname.startsWith('/api/auth')
  const isOnLogin = req.nextUrl.pathname.startsWith('/login')

  if (isOnApiAuth) return

  const bp = process.env.NEXT_BASE_PATH || ""

  if (!isLoggedIn && !isOnLogin) {
    return NextResponse.redirect(new URL(`${bp}/login`, req.url))
  }

  if (isLoggedIn && isOnLogin) {
    return NextResponse.redirect(new URL(`${bp}/`, req.url))
  }

  // Se o usuário foi desativado após o login, força logout imediato
  // @ts-ignore
  if (isLoggedIn && req.auth?.user?.isDisabled) {
    return NextResponse.redirect(new URL(`${bp}/api/auth/signout`, req.url))
  }
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
