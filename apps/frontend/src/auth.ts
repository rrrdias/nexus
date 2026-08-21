import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

export const { handlers, auth, signIn, signOut } = NextAuth({
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
          const apiBaseUrl = process.env.NEXT_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
          console.log("[NextAuth DEBUG] apiBaseUrl is:", apiBaseUrl)
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
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.isSuperAdmin = !!token.isSuperAdmin
        session.user.groups = (token.groups as string[]) || []
        session.user.id = token.sub as string
        session.user.accessToken = token.accessToken as string
      }
      return session
    }
  }
})
