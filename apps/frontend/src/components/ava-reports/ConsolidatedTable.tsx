"use client"

import { useState } from "react"
import { ActivityListDialog } from "./ActivityListDialog"
import { GradeDetailDialog } from "./GradeDetailDialog"
import { Badge } from "@/components/ui/badge"
import { 
  User, 
  GraduationCap, 
  MapPin, 
  Clock, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  Award
} from "lucide-react"

interface ConsolidatedRecord {
  id: string
  alunoId: string
  matricula: string
  usuario: string
  aluno: string
  email: string
  userPhone1: string
  periodo: string
  curso: string
  cursoPerfil: string
  periodoPerfil: string
  unidadeFisica: string
  enrolmentStatus: string
  lastaccess: string
  diasSemAcesso: string
  // Progresso
  progressoFase1: string
  progressoFase2: string
  progressoFase3: string
  progressoTotal: string
  listaFase1: string
  listaFase2: string
  listaFase3: string
  listaNotas?: string
  // Notas
  notaFase1: string
  notaFase2: string
  notaFase3: string
  mediaFinal: string
}


interface ConsolidatedTableProps {
  data: ConsolidatedRecord[]
  isLoading?: boolean
}

function parseVal(val: string | null | undefined): number {
  if (!val || val === "-" || val === "null") return 0
  const n = parseFloat(String(val).replace("%", "").replace(",", "."))
  return isNaN(n) ? 0 : n
}

function getProgressBadgeStyle(percent: number) {
  if (percent >= 70) {
    return "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
  }
  if (percent >= 40) {
    return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
  }
  return "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
}

function getGradeBadgeStyle(grade: number) {
  if (grade >= 60 || (grade >= 6.0 && grade <= 10.0)) {
    return "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
  }
  if (grade > 0) {
    return "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
  }
  return "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
}

export function ConsolidatedTable({ data, isLoading }: ConsolidatedTableProps) {
  const [dialogState, setDialogState] = useState<{
    open: boolean
    fase: string
    faseLabel: string
    listaRaw: string | null
    fasePercent: string | null
  }>({
    open: false,
    fase: "",
    faseLabel: "",
    listaRaw: null,
    fasePercent: null,
  })

  const [gradeDialogState, setGradeDialogState] = useState<{
    open: boolean
    studentName: string
    matricula: string
    curso: string
    polo: string
    lastaccess: string
    diasSemAcesso: string
    faseActive: "fase1" | "fase2" | "fase3" | "media" | "all"
    fase1Nota: string
    fase2Nota: string
    fase3Nota: string
    mediaFinal: string
    fase1Prog: string
    fase2Prog: string
    fase3Prog: string
    progTotal: string
    listaFase1?: string | null
    listaFase2?: string | null
    listaFase3?: string | null
  }>({
    open: false,
    studentName: "",
    matricula: "",
    curso: "",
    polo: "",
    lastaccess: "",
    diasSemAcesso: "",
    faseActive: "all",
    fase1Nota: "",
    fase2Nota: "",
    fase3Nota: "",
    mediaFinal: "",
    fase1Prog: "",
    fase2Prog: "",
    fase3Prog: "",
    progTotal: "",
    listaFase1: null as string | null,
    listaFase2: null as string | null,
    listaFase3: null as string | null,
    listaNotas: null as string | null | undefined,
  })

  const openActivityDialog = (fase: string, label: string, listaRaw: string | null, percent: string | null) => {
    setDialogState({
      open: true,
      fase,
      faseLabel: label,
      listaRaw,
      fasePercent: percent,
    })
  }

  const openGradeDialog = (row: ConsolidatedRecord, faseActive: "fase1" | "fase2" | "fase3" | "media" | "all" = "all") => {
    setGradeDialogState({
      open: true,
      studentName: row.aluno,
      matricula: row.matricula || row.usuario || "-",
      curso: row.curso,
      polo: row.unidadeFisica || "Polo Principal",
      lastaccess: row.lastaccess,
      diasSemAcesso: row.diasSemAcesso,
      faseActive,
      fase1Nota: row.notaFase1,
      fase2Nota: row.notaFase2,
      fase3Nota: row.notaFase3,
      mediaFinal: row.mediaFinal,
      fase1Prog: row.progressoFase1,
      fase2Prog: row.progressoFase2,
      fase3Prog: row.progressoFase3,
      progTotal: row.progressoTotal,
      listaFase1: row.listaFase1,
      listaFase2: row.listaFase2,
      listaFase3: row.listaFase3,
      listaNotas: row.listaNotas,
    })
  }




  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-2 p-12 text-center shadow-sm">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-navy border-r-transparent mb-3" />
        <p className="text-sm font-semibold text-gray-5">Carregando relatório consolidado...</p>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-2 p-12 text-center shadow-sm select-none">
        <AlertCircle className="w-10 h-10 text-gray-3 mx-auto mb-3" />
        <h3 className="text-base font-extrabold text-navy">Nenhum registro encontrado</h3>
        <p className="text-xs text-gray-4 mt-1">Ajuste os filtros de busca ou período letivo acima.</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-2 shadow-sm overflow-hidden select-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-gray-2 text-[11px] font-extrabold text-navy uppercase tracking-wider">
                <th className="py-3.5 px-4 min-w-[240px]">Aluno / Matrícula</th>
                <th className="py-3.5 px-4 min-w-[200px]">Curso / Polo</th>
                <th className="py-3.5 px-4 min-w-[150px] text-center bg-blue-50/40 border-x border-gray-2">
                  <div className="text-blue-900 font-black">Fase 1</div>
                  <div className="text-[9px] font-medium text-blue-600 lowercase tracking-normal">progresso | nota</div>
                </th>
                <th className="py-3.5 px-4 min-w-[150px] text-center bg-indigo-50/40 border-r border-gray-2">
                  <div className="text-indigo-900 font-black">Fase 2</div>
                  <div className="text-[9px] font-medium text-indigo-600 lowercase tracking-normal">progresso | nota</div>
                </th>
                <th className="py-3.5 px-4 min-w-[150px] text-center bg-purple-50/40 border-r border-gray-2">
                  <div className="text-purple-900 font-black">Fase 3</div>
                  <div className="text-[9px] font-medium text-purple-600 lowercase tracking-normal">progresso | nota</div>
                </th>
                <th className="py-3.5 px-4 min-w-[170px] text-center bg-emerald-50/50">
                  <div className="text-emerald-900 font-black">Consolidado</div>
                  <div className="text-[9px] font-medium text-emerald-700 lowercase tracking-normal">total | média</div>
                </th>
                <th className="py-3.5 px-4 text-center">Status / Acesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-1">
              {data.map((row) => {
                const progF1 = parseVal(row.progressoFase1)
                const progF2 = parseVal(row.progressoFase2)
                const progF3 = parseVal(row.progressoFase3)
                const progTot = parseVal(row.progressoTotal)

                const notaF1 = parseVal(row.notaFase1)
                const notaF2 = parseVal(row.notaFase2)
                const notaF3 = parseVal(row.notaFase3)
                const mediaTot = parseVal(row.mediaFinal)

                const isAtivo = String(row.enrolmentStatus).toLowerCase().includes("ativo")

                return (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Aluno / Matrícula */}
                    <td className="py-3 px-4">
                      <div className="font-extrabold text-navy text-[13px] leading-tight flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-navy/40 shrink-0" />
                        <span>{row.aluno}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5 flex items-center gap-2">
                        <span>Matrícula: <strong>{row.matricula || row.usuario || '-'}</strong></span>
                        {row.userPhone1 && (
                          <span className="text-gray-400">· 📞 {row.userPhone1}</span>
                        )}
                      </div>
                    </td>

                    {/* Curso / Polo */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-8 text-xs flex items-center gap-1.5 leading-tight" title={row.curso}>
                        <GraduationCap className="w-3.5 h-3.5 text-navy/40 shrink-0" />
                        <span className="truncate max-w-[220px]">{row.curso}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{row.unidadeFisica || 'Polo Principal'}</span>
                      </div>
                    </td>

                    {/* Fase 1: Progresso + Nota */}
                    <td className="py-3 px-3 text-center bg-blue-50/15 border-x border-gray-1">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openActivityDialog("fase1", "Atividades - Fase 1", row.listaFase1, row.progressoFase1)}
                          className={`px-2 py-0.5 rounded-md border text-[11px] font-bold cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${getProgressBadgeStyle(progF1)}`}
                          title="Clique para ver as atividades da Fase 1"
                        >
                          {row.progressoFase1 || '0'}%
                        </button>
                        <span className="text-gray-300 font-light">|</span>
                        <button
                          onClick={() => openGradeDialog(row, "fase1")}
                          className={`px-2 py-0.5 rounded-md border text-[11px] font-mono font-bold cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${getGradeBadgeStyle(notaF1)}`}
                          title="Clique para ver o extrato de notas do aluno"
                        >
                          {row.notaFase1 || '-'}
                        </button>
                      </div>
                    </td>

                    {/* Fase 2: Progresso + Nota */}
                    <td className="py-3 px-3 text-center bg-indigo-50/15 border-r border-gray-1">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openActivityDialog("fase2", "Atividades - Fase 2", row.listaFase2, row.progressoFase2)}
                          className={`px-2 py-0.5 rounded-md border text-[11px] font-bold cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${getProgressBadgeStyle(progF2)}`}
                          title="Clique para ver as atividades da Fase 2"
                        >
                          {row.progressoFase2 || '0'}%
                        </button>
                        <span className="text-gray-300 font-light">|</span>
                        <button
                          onClick={() => openGradeDialog(row, "fase2")}
                          className={`px-2 py-0.5 rounded-md border text-[11px] font-mono font-bold cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${getGradeBadgeStyle(notaF2)}`}
                          title="Clique para ver o extrato de notas do aluno"
                        >
                          {row.notaFase2 || '-'}
                        </button>
                      </div>
                    </td>

                    {/* Fase 3: Progresso + Nota */}
                    <td className="py-3 px-3 text-center bg-purple-50/15 border-r border-gray-1">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openActivityDialog("fase3", "Atividades - Fase 3", row.listaFase3, row.progressoFase3)}
                          className={`px-2 py-0.5 rounded-md border text-[11px] font-bold cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${getProgressBadgeStyle(progF3)}`}
                          title="Clique para ver as atividades da Fase 3"
                        >
                          {row.progressoFase3 || '0'}%
                        </button>
                        <span className="text-gray-300 font-light">|</span>
                        <button
                          onClick={() => openGradeDialog(row, "fase3")}
                          className={`px-2 py-0.5 rounded-md border text-[11px] font-mono font-bold cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${getGradeBadgeStyle(notaF3)}`}
                          title="Clique para ver o extrato de notas do aluno"
                        >
                          {row.notaFase3 || '-'}
                        </button>
                      </div>
                    </td>

                    {/* Consolidado: Progresso Total + Média Final */}
                    <td className="py-3 px-3 text-center bg-emerald-50/20">
                      <div className="flex items-center justify-center gap-2">
                        <div className={`px-2.5 py-0.5 rounded-md border text-xs font-black ${getProgressBadgeStyle(progTot)}`}>
                          {row.progressoTotal || '0'}%
                        </div>
                        <span className="text-emerald-300 font-bold">|</span>
                        <button
                          onClick={() => openGradeDialog(row, "media")}
                          className={`px-2.5 py-0.5 rounded-md border text-xs font-mono font-black cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${getGradeBadgeStyle(mediaTot)}`}
                          title="Clique para ver o extrato completo de notas"
                        >
                          {row.mediaFinal || '-'}
                        </button>
                      </div>
                    </td>

                    {/* Status & Acesso */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          isAtivo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}>
                          {row.enrolmentStatus || 'Ativo'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {row.diasSemAcesso === "-" ? "Sem acesso" : `${row.diasSemAcesso}d atrás`}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhamento de Atividades */}
      <ActivityListDialog
        fase={dialogState.fase}
        faseLabel={dialogState.faseLabel}
        listaRaw={dialogState.listaRaw}
        fasePercent={dialogState.fasePercent}
        open={dialogState.open}
        onClose={() => setDialogState(prev => ({ ...prev, open: false }))}
      />

      {/* Modal de Detalhamento de Notas */}
      <GradeDetailDialog
        open={gradeDialogState.open}
        onClose={() => setGradeDialogState(prev => ({ ...prev, open: false }))}
        studentName={gradeDialogState.studentName}
        matricula={gradeDialogState.matricula}
        curso={gradeDialogState.curso}
        polo={gradeDialogState.polo}
        lastaccess={gradeDialogState.lastaccess}
        diasSemAcesso={gradeDialogState.diasSemAcesso}
        faseActive={gradeDialogState.faseActive}
        fase1Nota={gradeDialogState.fase1Nota}
        fase2Nota={gradeDialogState.fase2Nota}
        fase3Nota={gradeDialogState.fase3Nota}
        mediaFinal={gradeDialogState.mediaFinal}
        fase1Prog={gradeDialogState.fase1Prog}
        fase2Prog={gradeDialogState.fase2Prog}
        fase3Prog={gradeDialogState.fase3Prog}
        progTotal={gradeDialogState.progTotal}
        listaFase1={gradeDialogState.listaFase1}
        listaFase2={gradeDialogState.listaFase2}
        listaFase3={gradeDialogState.listaFase3}
        listaNotas={gradeDialogState.listaNotas}
      />

    </>
  )
}

