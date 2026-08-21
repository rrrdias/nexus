import { DefaultSession, DefaultUser } from "next-auth"
import { DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface User extends DefaultUser {
    isSuperAdmin?: boolean
    groups?: string[]
    accessToken?: string
    isDisabled?: boolean
  }

  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      isSuperAdmin?: boolean
      groups?: string[]
      accessToken?: string
      isDisabled?: boolean
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    isSuperAdmin?: boolean
    groups?: string[]
    accessToken?: string
    isDisabled?: boolean
  }
}
