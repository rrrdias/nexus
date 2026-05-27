import { auth } from "@/auth"

import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isOnApiAuth = req.nextUrl.pathname.startsWith('/api/auth')
  const isOnLogin = req.nextUrl.pathname.startsWith('/login')

  if (isOnApiAuth) return

  if (!isLoggedIn && !isOnLogin) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (isLoggedIn && isOnLogin) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Se o usuário foi desativado após o login, força logout imediato
  // @ts-ignore
  if (isLoggedIn && req.auth?.user?.isDisabled) {
    const url = req.nextUrl.clone()
    url.pathname = '/api/auth/signout'
    return NextResponse.redirect(url)
  }
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
