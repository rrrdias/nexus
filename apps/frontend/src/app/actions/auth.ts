"use server"

import { signOut } from "@/auth"

export async function logoutAction() {
  const bp = process.env.NEXT_BASE_PATH || ""
  await signOut({ redirectTo: `${bp}/login` })
}
