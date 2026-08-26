import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const pathname = req.nextUrl.pathname

  const isOnApiAuth = pathname.includes('/api/auth')
  const isOnLogin = pathname === '/login' || pathname === '/nexus/login' || pathname.endsWith('/login')

  if (isOnApiAuth) return

  // Não autenticado tentando acessar rota protegida -> manda para /nexus/login
  if (!isLoggedIn && !isOnLogin) {
    const loginUrl = new URL('/nexus/login', req.url)
    return NextResponse.redirect(loginUrl)
  }

  // Já autenticado na tela de login -> manda para /nexus
  if (isLoggedIn && isOnLogin) {
    const homeUrl = new URL('/nexus', req.url)
    return NextResponse.redirect(homeUrl)
  }

  // Usuário desativado -> força logout
  if (isLoggedIn && req.auth?.user?.isDisabled) {
    const signoutUrl = new URL('/nexus/api/auth/signout', req.url)
    return NextResponse.redirect(signoutUrl)
  }
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|favicon.svg|.*\\.svg$).*)'],
}
