import { auth } from "@/auth"

import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth

  const isOnApiAuth = req.nextUrl.pathname.startsWith('/api/auth')
  const isOnLogin = req.nextUrl.pathname.startsWith('/login')

  if (isOnApiAuth) return

  if (!isLoggedIn && !isOnLogin) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  if (isLoggedIn && isOnLogin) {
    return NextResponse.redirect(new URL('/', req.nextUrl))
  }

  // Se o usuário foi desativado após o login, força logout imediato
  if (isLoggedIn && req.auth?.user?.isDisabled) {
    return NextResponse.redirect(new URL('/api/auth/signout', req.nextUrl))
  }
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
