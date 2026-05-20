import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"


export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        login: { label: "Usuário ou Email", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        console.log("Authorize called with:", { login: credentials?.login })
        if (!credentials?.login || !credentials?.password) {
          console.log("Missing login or password")
          return null
        }

        // Lazy import to prevent Edge Runtime from attempting to bundle Postgres
        const { db } = await import("@/db")
        const { users, userGroups, groups } = await import("@/db/schema")
        const { eq, or } = await import("drizzle-orm")

        try {
          const user = await db.select().from(users).where(
            or(
              eq(users.userid, credentials.login as string),
              eq(users.email, credentials.login as string)
            )
          ).limit(1)

          console.log("User query result:", user.length > 0 ? { id: user[0].id, userid: user[0].userid, email: user[0].email, isActive: user[0].isActive } : "Usuário não encontrado")
          
          if (user.length === 0) return null

          // Bloqueia login de usuários inativos
          if (user[0].isActive === false) {
            console.log("User is inactive")
            return null
          }

          // Em produção, use bcrypt.compare(credentials.password, user[0].password)
          if (user[0].password !== credentials.password) {
            console.log("Password mismatch")
            return null
          }

          const groupsData = await db.select({
            id: groups.id,
            name: groups.name
          })
          .from(userGroups)
          .innerJoin(groups, eq(userGroups.groupId, groups.id))
          .where(eq(userGroups.userId, user[0].id))

          console.log("User groups:", groupsData.map(g => g.name))

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
