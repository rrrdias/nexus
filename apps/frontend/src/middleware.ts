import { auth } from "@/auth"
import { NextResponse } from "next/server"
import {
  createStudentSessionToken,
  verifyStudentSessionToken,
} from "@/lib/student-session"

export default auth(async (req) => {
  const isLoggedIn = !!req.auth
  const pathname = req.nextUrl.pathname

  const isOnApiAuth = pathname.includes('/api/auth')
  const isOnLogin = pathname === '/login' || pathname === '/nexus/login' || pathname.endsWith('/login')
  const isPublicRoute =
    pathname.includes('/agendamento') ||
    pathname.includes('/api/public') ||
    pathname.includes('/loadingpage') ||
    pathname.includes('/landingpage')

  // Ignora completamente recursos estáticos e internos do Next.js (CSS, JS, Fontes, Imagens)
  if (
    pathname.includes('/_next') ||
    pathname.startsWith('/static') ||
    /\.(css|js|map|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(pathname)
  ) {
    return
  }

  if (isOnApiAuth) return

  // Tratamento da rota pública de agendamento de provas com sessão segura HMAC de 30 minutos
  if (isPublicRoute) {
    if (pathname.includes('/agendamento')) {
      const urlMat =
        req.nextUrl.searchParams.get('matricula')?.trim() ||
        req.nextUrl.searchParams.get('userid')?.trim()
      const existingCookie = req.cookies.get('nexus_student_session')?.value?.trim()

      if (urlMat) {
        // Nova sessão iniciada ou alternada a partir da URL
        const token = await createStudentSessionToken(urlMat)
        const res = NextResponse.next()
        res.cookies.set('nexus_student_session', token, {
          maxAge: 30 * 60, // 30 minutos em segundos (1800s)
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
        })
        return res
      }

      if (existingCookie) {
        const verifyRes = await verifyStudentSessionToken(existingCookie)
        if (!verifyRes.valid) {
          // Token inválido, adulterado ou expirado -> remove cookie
          const res = NextResponse.next()
          res.cookies.delete('nexus_student_session')
          return res
        }
      }
    }
    return
  }

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
