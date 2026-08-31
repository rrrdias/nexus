"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, MoreHorizontal, MessageSquare } from "lucide-react"
import { GradeDetailDialog } from "./GradeDetailDialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────
function parseProgressNum(value: any): number | null {
  if (value === null || value === undefined || value === "" || value === "-") return null
  const parsed = parseFloat(String(value).replace("%", "").replace(",", "."))
  return isNaN(parsed) ? null : parsed
}

function calcDiasSemAcesso(lastaccess: string | null): number | null {
  if (!lastaccess || lastaccess.trim() === "" || lastaccess.toLowerCase() === "nunca acessou") return null
  const parts = lastaccess.split("/")
  if (parts.length !== 3) return null
  const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2])
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null
  const dt = new Date(y, m, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((today.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24))
  return diff >= 0 ? diff : null
}

function InativBadge({ lastaccess, diasSemAcessoDB }: { lastaccess: string | null, diasSemAcessoDB: string | null }) {
  let dias: number | null = null
  if (diasSemAcessoDB && diasSemAcessoDB !== "" && diasSemAcessoDB !== "-") {
    const n = parseInt(diasSemAcessoDB)
    if (!isNaN(n)) dias = n
  }
  if (dias === null) dias = calcDiasSemAcesso(lastaccess)

  if (dias === null) return <span className="text-[10px] text-[#C9CDD4]">-</span>

  let cls = "text-[10px] font-bold px-1.5 py-0.5 rounded-full "
  if (dias <= 7) cls += "bg-green-100 text-green-700"
  else if (dias <= 14) cls += "bg-amber-100 text-amber-700"
  else if (dias <= 20) cls += "bg-orange-100 text-orange-700"
  else cls += "bg-red-100 text-red-700 animate-pulse"

  return <span className={cls}>{dias}d</span>
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[10px] text-[#C9CDD4]">-</span>
  const lower = status.toLowerCase()
  if (lower.includes("ativo") || lower === "active")
    return <Badge className="bg-green-brand text-navy hover:bg-green-dark text-[10px] px-2 py-0">Ativo</Badge>
  if (lower.includes("suspenso") || lower.includes("suspended"))
    return <Badge variant="destructive" className="text-[10px] px-2 py-0">{status}</Badge>
  return <Badge variant="secondary" className="text-[10px] px-2 py-0">{status}</Badge>
}

function formatPhone(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 11) return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`
  return digits
}

function buildWhatsAppUrl(phone: string | null, aluno: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 10) return null
  const num = digits.startsWith("55") ? digits : `55${digits}`
  const msg = encodeURIComponent(`Olá, ${aluno || "aluno"}! Entramos em contato referente ao seu desempenho acadêmico no AVA.`)
  return `https://wa.me/${num}?text=${msg}`
}

function buildMoodleUrl(institution: string | null, alunoId: string | null): string | null {
  if (!alunoId) return null
  const inst = String(institution || "").trim().toLowerCase()
  let baseUrl = ""
  
  if (inst === "ead") {
    baseUrl = "https://avaead.unievangelica.edu.br"
  } else if (inst === "uni") {
    baseUrl = "https://avagrad.unievangelica.edu.br"
  } else if (inst === "uniego") {
    baseUrl = "https://ava.uniego.edu.br"
  } else if (inst === "raizes") {
    baseUrl = "https://ava.faculdaderaizes.edu.br"
  } else if (inst === "eefn") {
    baseUrl = "https://ava.aee.edu.br"
  } else {
    return null
  }
  
  return `${baseUrl}/message/index.php?id=${alunoId}`
}

function RowActions({ row, phoneFormatted, waUrl }: {
  row: any
  phoneFormatted: string | null
  waUrl: string | null
}) {
  const moodleUrl = buildMoodleUrl(row.sourceInstitution, row.userId || row.alunoId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="w-8 h-8 p-0 rounded-full hover:bg-slate-100/80 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors focus:outline-none cursor-pointer"
      >
        <MoreHorizontal className="w-4 h-4" />
        <span className="sr-only">Ações</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-white border border-slate-200/80 shadow-md rounded-md p-1 z-50">
        <DropdownMenuItem
          disabled={!waUrl}
          onClick={() => waUrl && window.open(waUrl, "_blank")}
          className="flex items-center gap-2 text-[11px] text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer py-1.5 px-2 rounded-md disabled:opacity-50 disabled:pointer-events-none"
        >
          <MessageCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
          <span>Enviar WhatsApp</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={!moodleUrl}
          onClick={() => moodleUrl && window.open(moodleUrl, "_blank")}
          className="flex items-center gap-2 text-[11px] text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer py-1.5 px-2 rounded-md disabled:opacity-50 disabled:pointer-events-none"
        >
          <MessageSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Mensagem no AVA</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ──────────────────────────────────────────
// Componente Principal
// ──────────────────────────────────────────
export function NotasTable({ data, institution }: { data: any[], institution?: string }) {
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
    listaFase1: null,
    listaFase2: null,
    listaFase3: null,
    listaNotas: null,
  })

  const openGradeDialog = (row: any, faseActive: "fase1" | "fase2" | "fase3" | "media" | "all" = "all") => {
    setGradeDialogState({
      open: true,
      studentName: row.studentName || row.aluno || "Aluno",
      matricula: row.userIdentification || row.matricula || "-",
      curso: row.courseFullname || row.curso || "-",
      polo: row.unidadeFisica || "Polo Principal",
      lastaccess: row.lastaccess || "-",
      diasSemAcesso: row.diasSemAcesso || "-",
      faseActive,
      fase1Nota: row.fase1 || "-",
      fase2Nota: row.fase2 || "-",
      fase3Nota: row.fase3 || "-",
      mediaFinal: row.media || "-",
      fase1Prog: row.progressoFase1 || "0",
      fase2Prog: row.progressoFase2 || "0",
      fase3Prog: row.progressoFase3 || "0",
      progTotal: row.progressoTotal || "0",
      listaFase1: row.listaFase1 || null,
      listaFase2: row.listaFase2 || null,
      listaFase3: row.listaFase3 || null,
      listaNotas: row.listaNotas || null,
    })
  }


  if (!data || data.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-[#9AA0AC] text-sm italic">Nenhum aluno encontrado para os filtros selecionados.</p>
      </div>
    )
  }

  const showPolo = institution === "ead" || institution === "uni"

  const headers = [
    "Matrícula", "Nome Completo", "Telefone", "Disciplina",
    "Curso", "Período",
    ...(showPolo ? ["Polo"] : []),
    "Último Acesso", "Inativ.",
    "Status", "Fase 1", "Fase 2", "Fase 3", "Média Final", "Ações"
  ]

  const getGradeStyle = (val: any) => {
    const num = parseProgressNum(val)
    if (num === null) return "text-gray-400 bg-gray-50 border-gray-200"
    if (num >= 60 || (num >= 6.0 && num <= 10.0)) return "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
    if (num > 0) return "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
    return "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
  }

  return (
    <>
      <div className="overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F4F5F7] border-b border-gray-200">
              {headers.map(h => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-[9px] font-bold text-[#9AA0AC] uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => {
              const phone = row.userPhone1 || null
              const waUrl = buildWhatsAppUrl(phone, row.studentName || row.aluno)
              const phoneFormatted = formatPhone(phone)

              return (
                <tr
                  key={row.id}
                  className={`border-b border-gray-100 text-xs transition-colors hover:bg-blue-50/20 ${
                    idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"
                  }`}
                >
                  {/* Matrícula */}
                  <td className="px-3 py-2 font-mono font-bold text-navy whitespace-nowrap">{row.userIdentification || row.matricula || "-"}</td>

                  {/* Nome */}
                  <td className="px-3 py-2 font-semibold text-gray-800 min-w-[160px]">{row.studentName || row.aluno || "-"}</td>

                  {/* Telefone */}
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                    {phoneFormatted ? (
                      <span className="font-mono">{phoneFormatted}</span>
                    ) : (
                      <span className="text-[#C9CDD4]">-</span>
                    )}
                  </td>

                  {/* Disciplina */}
                  <td className="px-3 py-2 text-[#1976D2] font-medium min-w-[180px] max-w-[240px] whitespace-normal break-words leading-snug">
                    {row.courseFullname || row.curso || "-"}
                  </td>

                  {/* Curso */}
                  <td className="px-3 py-2 text-gray-600 min-w-[140px] max-w-[200px] whitespace-normal break-words leading-snug">
                    {row.cursoPerfil || "-"}
                  </td>

                  {/* Período */}
                  <td className="px-3 py-2 text-gray-600 text-center whitespace-nowrap">{row.periodoPerfil || row.periodo || "-"}</td>

                  {/* Polo */}
                  {showPolo && (
                    <td className="px-3 py-2 text-gray-600 min-w-[150px] max-w-[220px] whitespace-normal break-words leading-snug">
                      {row.unidadeFisica || "-"}
                    </td>
                  )}

                  {/* Último Acesso */}
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.lastaccess || "-"}</td>

                  {/* Inatividade */}
                  <td className="px-3 py-2 text-center">
                    <InativBadge lastaccess={row.lastaccess} diasSemAcessoDB={row.diasSemAcesso} />
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2"><StatusBadge status={row.enrolmentStatus} /></td>

                  {/* Fase 1 */}
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => openGradeDialog(row, "fase1")}
                      className={`px-2.5 py-0.5 rounded-md border text-[11px] font-mono font-bold cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${getGradeStyle(row.fase1)}`}
                      title="Clique para ver o extrato de atividades e notas da Fase 1"
                    >
                      {row.fase1 || '-'}
                    </button>
                  </td>

                  {/* Fase 2 */}
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => openGradeDialog(row, "fase2")}
                      className={`px-2.5 py-0.5 rounded-md border text-[11px] font-mono font-bold cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${getGradeStyle(row.fase2)}`}
                      title="Clique para ver o extrato de atividades e notas da Fase 2"
                    >
                      {row.fase2 || '-'}
                    </button>
                  </td>

                  {/* Fase 3 */}
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => openGradeDialog(row, "fase3")}
                      className={`px-2.5 py-0.5 rounded-md border text-[11px] font-mono font-bold cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${getGradeStyle(row.fase3)}`}
                      title="Clique para ver o extrato de atividades e notas da Fase 3"
                    >
                      {row.fase3 || '-'}
                    </button>
                  </td>

                  {/* Total */}
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => openGradeDialog(row, "media")}
                      className={`px-2.5 py-0.5 rounded-md border text-[11px] font-mono font-black cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95 ${getGradeStyle(row.media)}`}
                      title="Clique para ver o extrato completo de atividades e notas"
                    >
                      {row.media || '-'}
                    </button>
                  </td>

                  {/* Ações */}
                  <td className="px-3 py-2 text-center">
                    <RowActions row={row} phoneFormatted={phoneFormatted} waUrl={waUrl} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalhamento de Notas e Atividades */}
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
