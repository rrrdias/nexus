import { redirect } from "next/navigation"

export default function RelatoriosPage() {
  // Redireciona o usuário para o dashboard principal de Progresso
  redirect("/relatorios/progresso")
}
