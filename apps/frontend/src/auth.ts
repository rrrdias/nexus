import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

const BACKEND_JWT_LIFETIME_MS = 2 * 60 * 60 * 1000
const REFRESH_THRESHOLD_MS = 30 * 60 * 1000

export const { handlers, auth, signIn, signOut } = NextAuth({
  basePath: "/api/auth",
  trustHost: true,
  pages: {
    signIn: "/nexus/login",
    error: "/nexus/login",
  },
  session: { 
    strategy: "jwt", 
    maxAge: 30 * 60, // 30 minutos de sessão
    updateAge: 10 * 60, // Atualiza o cookie a cada 10 minutos se ativo
  },
  providers: [
    Credentials({
      credentials: {
        login: { label: "Usuário ou Email", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const login = String(credentials?.login ?? "").trim()
        const password = String(credentials?.password ?? "")

        if (!login || !password) {
          return null
        }

        try {
          const apiBaseUrl = process.env.NEXT_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3004"
          const res = await fetch(apiBaseUrl + '/api/auth/login', {

            method: 'POST',
            body: JSON.stringify({ email: login, password }),
            headers: { "Content-Type": "application/json" }
          })
          const data = await res.json()

          if (res.ok && data.user && data.access_token) {
            return {
              id: data.user.id,
              name: data.user.name,
              email: data.user.email,
              image: data.user.image,
              isSuperAdmin: data.user.isSuperAdmin,
              groups: data.user.groups,
              accessToken: data.access_token
            }
          }
          return null
        } catch (error) {
          console.error("Error in authorize:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
        token.isSuperAdmin = user.isSuperAdmin
        token.groups = user.groups
        token.accessToken = user.accessToken
        token.accessTokenExpiresAt = Date.now() + BACKEND_JWT_LIFETIME_MS - REFRESH_THRESHOLD_MS
        token.isDisabled = false
        return token
      }

      if (token.accessToken && Date.now() >= (token.accessTokenExpiresAt || 0)) {
        try {
          const apiBaseUrl = process.env.NEXT_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3004"
          const res = await fetch(`${apiBaseUrl}/api/auth/refresh`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token.accessToken}`,
            },
            cache: "no-store",
          })

          if (res.ok) {
            const data = await res.json()
            if (data?.access_token) {
              token.accessToken = data.access_token
              token.isSuperAdmin = data.user?.isSuperAdmin ?? token.isSuperAdmin
              token.groups = data.user?.groups ?? token.groups
              token.accessTokenExpiresAt = Date.now() + BACKEND_JWT_LIFETIME_MS - REFRESH_THRESHOLD_MS
              token.isDisabled = false
            }
          } else if (res.status === 401) {
            token.isDisabled = true
            token.accessToken = ""
          }
        } catch (error) {
          console.error("[Auth] Erro ao renovar token JWT silenciosamente:", error)
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.isSuperAdmin = !!token.isSuperAdmin
        session.user.groups = (token.groups as string[]) || []
        session.user.id = token.sub as string
        session.user.accessToken = token.accessToken as string
        session.user.isDisabled = !!token.isDisabled
      }
      return session
    }
  }
})
