import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap, AlertCircle } from "lucide-react"

export default function NotasPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-navy tracking-tight">Notas dos Alunos</h1>
        <p className="text-[#5F6775] text-sm mt-1">Módulo AVA Reports - Consulta e consolidação de notas.</p>
      </div>

      <Card className="border-t-4 border-[#1976D2] shadow-sm max-w-2xl">
        <CardHeader className="bg-[#F4F5F7] border-b py-3">
          <CardTitle className="text-base font-extrabold text-navy flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-navy shrink-0" />
            Módulo em Desenvolvimento
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start gap-3 p-4 bg-blue-50/50 border border-blue-100 rounded-lg text-xs text-blue-800">
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Informação da Migração:</span>
              <p className="mt-1 leading-relaxed">
                Este módulo está atualmente sendo migrado para a nova stack Nexus Core (Next.js 16 / PostgreSQL / Drizzle ORM).
                A sincronização de notas do Moodle já está implementada no backend, e a interface gerencial será reescrita em breve utilizando os padrões de design premium do Nexus.
              </p>
            </div>
          </div>
          <p className="text-xs text-[#5F6775] leading-relaxed">
            As notas são coletadas diretamente da API de sincronização do AVA e consolidadas no banco de dados local da aplicação, permitindo exportações rápidas em Excel e geração de relatórios de desempenho por polo, disciplina e período.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
