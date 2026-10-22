import { Suspense } from "react"
import type { Metadata } from "next"
import { cookies } from "next/headers"
import { StudentSchedulingClient } from "./StudentSchedulingClient"
import { RefreshCw } from "lucide-react"

export const metadata: Metadata = {
  title: "Agendamento de Provas Presenciais | UniEVANGÉLICA EaD",
  description:
    "Portal oficial para agendamento de provas presenciais dos estudantes da Graduação EaD da UniEVANGÉLICA.",
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-[#1C2B4A] flex items-center justify-center text-[#2DCE6C] shadow-xl">
        <RefreshCw className="w-7 h-7 animate-spin" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-slate-800">
          Carregando Portal de Agendamento...
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          UniEVANGÉLICA • Sistema Integrado de Provas EaD
        </p>
      </div>
    </div>
  )
}

export default async function AgendamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ matricula?: string; userid?: string }>
}) {
  const { matricula, userid } = await searchParams
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get("nexus_student_session")?.value

  const activeMatricula =
    matricula?.trim() || userid?.trim() || sessionCookie?.trim() || ""

  return (
    <Suspense fallback={<LoadingFallback />}>
      <StudentSchedulingClient initialMatricula={activeMatricula} />
    </Suspense>
  )
}
