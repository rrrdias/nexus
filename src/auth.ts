import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { hashPassword, isPasswordHash, verifyPassword } from "@/lib/password"


export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
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

        // Lazy import to prevent Edge Runtime from attempting to bundle Postgres
        const { db } = await import("@/db")
        const { users, userGroups, groups } = await import("@/db/schema")
        const { eq, or } = await import("drizzle-orm")

        try {
          const user = await db.select().from(users).where(
            or(
              eq(users.userid, login),
              eq(users.email, login)
            )
          ).limit(1)

          if (user.length === 0) return null

          // Bloqueia login de usuários inativos
          if (user[0].isActive === false) {
            return null
          }

          const passwordMatches = await verifyPassword(password, user[0].password)
          if (!passwordMatches) {
            return null
          }

          if (!isPasswordHash(user[0].password)) {
            await db.update(users)
              .set({ password: await hashPassword(password) })
              .where(eq(users.id, user[0].id))
          }

          const groupsData = await db.select({
            id: groups.id,
            name: groups.name
          })
          .from(userGroups)
          .innerJoin(groups, eq(userGroups.groupId, groups.id))
          .where(eq(userGroups.userId, user[0].id))

          return {
            ...user[0],
            groups: groupsData.map(g => g.name),
            isSuperAdmin: groupsData.some(g => g.name === 'Super Admin')
          }
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
        // @ts-ignore
        token.groups = user.groups
        // @ts-ignore
        token.isSuperAdmin = user.isSuperAdmin
        token.sub = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        // @ts-ignore
        session.user.groups = token.groups || []
        // @ts-ignore
        session.user.isSuperAdmin = !!token.isSuperAdmin
        // @ts-ignore
        session.user.id = token.sub as string

        // Verificação em tempo real: consulta o banco para checar se o usuário ainda está ativo.
        // Se foi desativado após o login, a sessão é marcada como inválida.
        try {
          const { db } = await import("@/db")
          const { users } = await import("@/db/schema")
          const { eq } = await import("drizzle-orm")
          const dbUser = await db.select({ isActive: users.isActive })
            .from(users)
            .where(eq(users.id, token.sub as string))
            .limit(1)

          // @ts-ignore
          session.user.isDisabled = dbUser.length === 0 || dbUser[0].isActive === false
        } catch {
          // Em caso de erro de DB, mantém a sessão como válida (fail-open)
          // @ts-ignore
          session.user.isDisabled = false
        }
      }
      return session
    }
  }
})
