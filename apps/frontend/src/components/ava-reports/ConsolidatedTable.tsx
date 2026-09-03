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
  Award,
  BookOpen,
  MessageCircle,
  MessageSquare,
  Copy,
  ExternalLink,
  Check
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
  progressoListaFase1?: string
  progressoListaFase2?: string
  progressoListaFase3?: string
  listaFase1: string
  listaFase2: string
  listaFase3: string
  // Notas
  notaFase1: string
  notaFase2: string
  notaFase3: string
  mediaFinal: string
  notasListaFase1?: string
  notasListaFase2?: string
  notasListaFase3?: string
  listaNotas?: string
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
    return "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
  }
  if (percent >= 40) {
    return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
  }
  return "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
}

function getGradeBadgeStyle(grade: number) {
  if (grade >= 60 || (grade >= 6.0 && grade <= 10.0)) {
    return "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
  }
  if (grade > 0) {
    return "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
  }
  return "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
}

function formatPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

function getWhatsAppLink(phone: string | null | undefined, studentName: string): string | null {
  if (!phone) return null
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length < 10) return null
  const fullNumber = cleaned.startsWith('55') ? cleaned : `55${cleaned}`
  const firstName = studentName.split(' ')[0] || studentName
  const msg = encodeURIComponent(`Olá, ${firstName}! Aqui é do suporte acadêmico UniEVANGÉLICA referente ao acompanhamento de suas disciplinas no AVA.`)
  return `https://wa.me/${fullNumber}?text=${msg}`
}

function buildMoodleUrl(institution: string | null | undefined, alunoId: string | null | undefined): string | null {
  if (!alunoId) return null
  const inst = String(institution || "ead").trim().toLowerCase()
  let baseUrl = "https://avaead.unievangelica.edu.br"
  
  if (inst === "uni" || inst.includes("uni")) {
    baseUrl = "https://avagrad.unievangelica.edu.br"
  } else if (inst === "uniego" || inst.includes("faceg")) {
    baseUrl = "https://ava.uniego.edu.br"
  } else if (inst === "raizes") {
    baseUrl = "https://ava.faculdaderaizes.edu.br"
  } else if (inst === "eefn" || inst.includes("aee")) {
    baseUrl = "https://ava.aee.edu.br"
  }
  
  return `${baseUrl}/message/index.php?id=${alunoId}`
}

function buildMoodleProfileUrl(institution: string | null | undefined, alunoId: string | null | undefined): string | null {
  if (!alunoId) return null
  const inst = String(institution || "ead").trim().toLowerCase()
  let baseUrl = "https://avaead.unievangelica.edu.br"
  
  if (inst === "uni" || inst.includes("uni")) {
    baseUrl = "https://avagrad.unievangelica.edu.br"
  } else if (inst === "uniego" || inst.includes("faceg")) {
    baseUrl = "https://ava.uniego.edu.br"
  } else if (inst === "raizes") {
    baseUrl = "https://ava.faculdaderaizes.edu.br"
  } else if (inst === "eefn" || inst.includes("aee")) {
    baseUrl = "https://ava.aee.edu.br"
  }
  
  return `${baseUrl}/user/view.php?id=${alunoId}`
}

function splitCourseAndCode(fullCourse: string | null | undefined) {
  if (!fullCourse) return { name: '-', code: null }
  const match = fullCourse.match(/^(.*?)\s*[-–—]\s*([A-Za-z0-9]+[A-Za-z0-9_-]*)$/)
  if (match) {
    return {
      name: match[1].trim(),
      code: match[2].trim()
    }
  }
  return { name: fullCourse.trim(), code: null }
}

function getInitials(name: string): string {
  if (!name) return "AL"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function ConsolidatedTable({ data, isLoading }: ConsolidatedTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

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
    listaNotas?: string | null
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

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

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
      listaFase1: row.notasListaFase1 || row.progressoListaFase1 || row.listaFase1,
      listaFase2: row.notasListaFase2 || row.progressoListaFase2 || row.listaFase2,
      listaFase3: row.notasListaFase3 || row.progressoListaFase3 || row.listaFase3,
      listaNotas: row.listaNotas,
    })
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 p-16 text-center shadow-sm">
        <div className="inline-block animate-spin rounded-full h-9 w-9 border-4 border-navy border-r-transparent mb-3.5" />
        <p className="text-sm font-bold text-navy">Carregando relatório consolidado...</p>
        <p className="text-xs text-slate-400 mt-1">Sincronizando métricas e notas em tempo real</p>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 p-16 text-center shadow-sm select-none">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-extrabold text-navy">Nenhum registro encontrado</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Não localizamos matrículas para os filtros selecionados. Tente ajustar o período letivo, polo ou termo de busca.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden select-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-extrabold text-navy uppercase tracking-wider">
                <th className="py-4 px-4 min-w-[280px]">Aluno / Contato</th>
                <th className="py-4 px-4 min-w-[340px]">Disciplina / Curso / Polo</th>
                <th className="py-4 px-3 min-w-[145px] text-center bg-blue-50/50 border-x border-slate-200/80">
                  <div className="text-blue-950 font-black">Fase 1</div>
                  <div className="text-[10px] font-semibold text-blue-700/80 tracking-normal capitalize">Progresso | Nota</div>
                </th>
                <th className="py-4 px-3 min-w-[145px] text-center bg-indigo-50/50 border-r border-slate-200/80">
                  <div className="text-indigo-950 font-black">Fase 2</div>
                  <div className="text-[10px] font-semibold text-indigo-700/80 tracking-normal capitalize">Progresso | Nota</div>
                </th>
                <th className="py-4 px-3 min-w-[145px] text-center bg-purple-50/50 border-r border-slate-200/80">
                  <div className="text-purple-950 font-black">Fase 3</div>
                  <div className="text-[10px] font-semibold text-purple-700/80 tracking-normal capitalize">Progresso | Nota</div>
                </th>
                <th className="py-4 px-3 min-w-[160px] text-center bg-emerald-50/60 border-r border-slate-200/80">
                  <div className="text-emerald-950 font-black">Consolidado</div>
                  <div className="text-[10px] font-semibold text-emerald-700/80 tracking-normal capitalize">Total | Média</div>
                </th>
                <th className="py-4 px-4 text-center min-w-[120px]">Status / Acesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
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
                const parsedCourse = splitCourseAndCode(row.curso)
                const phoneFormatted = formatPhone(row.userPhone1)
                const waLink = getWhatsAppLink(row.userPhone1, row.aluno)
                const moodleMessageUrl = buildMoodleUrl(row.sourceInstitution, row.alunoId)
                const moodleProfileUrl = buildMoodleProfileUrl(row.sourceInstitution, row.alunoId)
                const initials = getInitials(row.aluno)

                return (
                  <tr key={row.id} className="hover:bg-slate-50/90 transition-colors group">
                    
                    {/* Aluno / Contato & Atendimento do Tutor */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-navy/5 text-navy border border-navy/10 flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5 shadow-2xs">
                          {initials}
                        </div>
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-navy text-[13px] leading-snug break-words">
                              {row.aluno}
                            </span>
                            {moodleProfileUrl && (
                              <a
                                href={moodleProfileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-400 hover:text-blue-600 transition-colors p-0.5"
                                title="Ver perfil do aluno no AVA (Moodle)"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-slate-500">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80 text-slate-700 font-bold">
                              ID: {row.matricula || row.usuario || '-'}
                            </span>
                            
                            {phoneFormatted && (
                              <span className="text-slate-600 font-medium">📞 {phoneFormatted}</span>
                            )}
                          </div>

                          {/* Botões de Ação Direta para o Tutor / Atendimento */}
                          <div className="flex items-center gap-1.5 pt-0.5">
                            {moodleMessageUrl && (
                              <a
                                href={moodleMessageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 text-[10px] font-bold hover:bg-blue-100 transition-all shadow-2xs cursor-pointer"
                                title="Abrir chat de mensagens privadas / atendimento com o aluno no AVA Moodle"
                              >
                                <MessageSquare className="w-3 h-3 text-blue-600" />
                                <span>Mensagem no AVA</span>
                              </a>
                            )}

                            {waLink && (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-bold hover:bg-emerald-100 transition-all shadow-2xs cursor-pointer"
                                title="Iniciar conversa no WhatsApp com o aluno"
                              >
                                <MessageCircle className="w-3 h-3 text-emerald-600" />
                                <span>WhatsApp</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Disciplina / Curso / Polo */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="space-y-1.5 min-w-0">
                        {/* Linha 1: Nome da Disciplina Limpo */}
                        <div className="font-bold text-slate-900 text-xs leading-snug break-words flex items-start gap-1.5">
                          <GraduationCap className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <span className="break-words">{parsedCourse.name}</span>
                        </div>

                        {/* Linha 2: Código da Turma + Graduação */}
                        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-600">
                          {parsedCourse.code && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50/80 text-blue-700 border border-blue-200/70 font-mono font-bold text-[10px]">
                              {parsedCourse.code}
                            </span>
                          )}
                          {row.cursoPerfil && (
                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                              <BookOpen className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="break-words">{row.cursoPerfil}</span>
                            </span>
                          )}
                        </div>

                        {/* Linha 3: Polo / Unidade Física */}
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="break-words">{row.unidadeFisica || 'Polo Principal'}</span>
                        </div>
                      </div>
                    </td>

                    {/* Fase 1: Progresso + Nota (Pill Unificada) */}
                    <td className="py-3.5 px-3 text-center align-middle bg-blue-50/20 border-x border-slate-200/60">
                      <div className="inline-flex items-center rounded-xl bg-white border border-slate-200 p-1 shadow-2xs gap-1.5">
                        <button
                          onClick={() => openActivityDialog("fase1", "Progresso das Atividades - Fase 1", row.progressoListaFase1 || row.listaFase1, row.progressoFase1)}
                          className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${getProgressBadgeStyle(progF1)}`}
                          title="Clique para ver as atividades da Fase 1"
                        >
                          {row.progressoFase1 || '0'}%
                        </button>
                        <span className="w-px h-3.5 bg-slate-200" />
                        <button
                          onClick={() => openGradeDialog(row, "fase1")}
                          className={`px-2 py-0.5 rounded-lg border text-[11px] font-mono font-bold cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${getGradeBadgeStyle(notaF1)}`}
                          title="Clique para ver o extrato de notas da Fase 1"
                        >
                          {row.notaFase1 || '-'}
                        </button>
                      </div>
                    </td>

                    {/* Fase 2: Progresso + Nota (Pill Unificada) */}
                    <td className="py-3.5 px-3 text-center align-middle bg-indigo-50/20 border-r border-slate-200/60">
                      <div className="inline-flex items-center rounded-xl bg-white border border-slate-200 p-1 shadow-2xs gap-1.5">
                        <button
                          onClick={() => openActivityDialog("fase2", "Progresso das Atividades - Fase 2", row.progressoListaFase2 || row.listaFase2, row.progressoFase2)}
                          className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${getProgressBadgeStyle(progF2)}`}
                          title="Clique para ver as atividades da Fase 2"
                        >
                          {row.progressoFase2 || '0'}%
                        </button>
                        <span className="w-px h-3.5 bg-slate-200" />
                        <button
                          onClick={() => openGradeDialog(row, "fase2")}
                          className={`px-2 py-0.5 rounded-lg border text-[11px] font-mono font-bold cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${getGradeBadgeStyle(notaF2)}`}
                          title="Clique para ver o extrato de notas da Fase 2"
                        >
                          {row.notaFase2 || '-'}
                        </button>
                      </div>
                    </td>

                    {/* Fase 3: Progresso + Nota (Pill Unificada) */}
                    <td className="py-3.5 px-3 text-center align-middle bg-purple-50/20 border-r border-slate-200/60">
                      <div className="inline-flex items-center rounded-xl bg-white border border-slate-200 p-1 shadow-2xs gap-1.5">
                        <button
                          onClick={() => openActivityDialog("fase3", "Progresso das Atividades - Fase 3", row.progressoListaFase3 || row.listaFase3, row.progressoFase3)}
                          className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${getProgressBadgeStyle(progF3)}`}
                          title="Clique para ver as atividades da Fase 3"
                        >
                          {row.progressoFase3 || '0'}%
                        </button>
                        <span className="w-px h-3.5 bg-slate-200" />
                        <button
                          onClick={() => openGradeDialog(row, "fase3")}
                          className={`px-2 py-0.5 rounded-lg border text-[11px] font-mono font-bold cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${getGradeBadgeStyle(notaF3)}`}
                          title="Clique para ver o extrato de notas da Fase 3"
                        >
                          {row.notaFase3 || '-'}
                        </button>
                      </div>
                    </td>

                    {/* Consolidado: Progresso Total + Média Final (Pill Destacada) */}
                    <td className="py-3.5 px-3 text-center align-middle bg-emerald-50/30 border-r border-slate-200/60">
                      <div className="inline-flex items-center rounded-xl bg-white border border-emerald-200 p-1 shadow-2xs gap-1.5">
                        <div className={`px-2.5 py-0.5 rounded-lg border text-xs font-black ${getProgressBadgeStyle(progTot)}`}>
                          {row.progressoTotal || '0'}%
                        </div>
                        <span className="w-px h-3.5 bg-emerald-200" />
                        <button
                          onClick={() => openGradeDialog(row, "media")}
                          className={`px-2.5 py-0.5 rounded-lg border text-xs font-mono font-black cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${getGradeBadgeStyle(mediaTot)}`}
                          title="Clique para ver o extrato completo de notas e atividades"
                        >
                          {row.mediaFinal || '-'}
                        </button>
                      </div>
                    </td>

                    {/* Status & Acesso */}
                    <td className="py-3.5 px-4 text-center align-middle">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                          isAtivo 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                          {row.enrolmentStatus || 'Ativo'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
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
        open={dialogState.open}
        onClose={() => setDialogState({ open: false, fase: "", faseLabel: "", listaRaw: null, fasePercent: null })}
        faseLabel={dialogState.faseLabel}
        listaRaw={dialogState.listaRaw}
        fasePercent={dialogState.fasePercent}
      />

      {/* Modal de Detalhamento de Notas e Extrato Completo */}
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
