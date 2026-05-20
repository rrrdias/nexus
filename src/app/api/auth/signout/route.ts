import { signOut } from "@/auth"

export async function GET() {
  // signOut com redirectTo limpa o cookie da sessão antes de redirecionar
  await signOut({ redirectTo: '/login' })
}
