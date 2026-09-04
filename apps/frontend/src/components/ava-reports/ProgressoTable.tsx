"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, MoreHorizontal, ListTodo, MessageSquare } from "lucide-react"
import { ActivityListDialog } from "./ActivityListDialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"

import { splitCourseAndCode } from "@/lib/course-utils"

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
  // Formato esperado: "08/05/2026" (DD/MM/YYYY)
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

// ──────────────────────────────────────────
// Sub-componentes
// ──────────────────────────────────────────
function ProgressBadge({ value, listaRaw, faseLabel }: {
  value: string | null
  listaRaw: string | null
  faseLabel: string
}) {
  const [open, setOpen] = useState(false)
  const num = parseProgressNum(value)

  let cls = "text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer select-none transition-opacity hover:opacity-80 "
  if (num === null) return <span className="text-xs text-[#C9CDD4]">-</span>
  if (num === 0) cls += "bg-red-100 text-red-700"
  else if (num < 40) cls += "bg-orange-100 text-orange-700"
  else if (num < 100) cls += "bg-amber-100 text-amber-700"
  else cls += "bg-green-100 text-green-700"

  const hasActivities = listaRaw && listaRaw.trim().length > 0

  return (
    <>
      <span
        className={cls + (hasActivities ? " ring-1 ring-current ring-offset-1" : "")}
        title={hasActivities ? `Ver atividades da ${faseLabel}` : undefined}
        onClick={hasActivities ? () => setOpen(true) : undefined}
      >
        {num}%
      </span>
      {hasActivities && (
        <ActivityListDialog
          fase={faseLabel}
          faseLabel={faseLabel}
          listaRaw={listaRaw}
          fasePercent={String(num)}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function InativBadge({ lastaccess, diasSemAcessoDB }: { lastaccess: string | null, diasSemAcessoDB: string | null }) {
  // Preferir o valor do banco; caso vazio, calcular a partir do lastaccess
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
  const msg = encodeURIComponent(`Olá, ${aluno || "aluno"}! Entramos em contato referente ao seu progresso nas atividades.`)
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

// ──────────────────────────────────────────
// Ações da Linha (Dropdown Menu com Submenus)
// ──────────────────────────────────────────
function RowActions({ row, phoneFormatted, waUrl }: {
  row: any
  phoneFormatted: string | null
  waUrl: string | null
}) {
  const [activeDialog, setActiveDialog] = useState<"fase1" | "fase2" | "fase3" | null>(null)

  const hasFase1 = row.listaFase1 && row.listaFase1.trim().length > 0
  const hasFase2 = row.listaFase2 && row.listaFase2.trim().length > 0
  const hasFase3 = row.listaFase3 && row.listaFase3.trim().length > 0

  const moodleUrl = buildMoodleUrl(row.sourceInstitution, row.alunoId)

  return (
    <>
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

          <DropdownMenuSeparator className="my-1 border-t border-slate-100" />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className="flex items-center gap-2 text-[11px] text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer py-1.5 px-2 rounded-md"
            >
              <ListTodo className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Ver Atividades</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-40 bg-white border border-slate-200/80 shadow-md rounded-md p-1 z-50">
                <DropdownMenuItem
                  disabled={!hasFase1}
                  onClick={() => setActiveDialog("fase1")}
                  className="flex items-center justify-between text-[11px] text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer py-1.5 px-2 rounded-md disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>Fase 1</span>
                  {row.fase1 !== null && <span className="text-[10px] text-slate-400 font-bold">{row.fase1}%</span>}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!hasFase2}
                  onClick={() => setActiveDialog("fase2")}
                  className="flex items-center justify-between text-[11px] text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer py-1.5 px-2 rounded-md disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>Fase 2</span>
                  {row.fase2 !== null && <span className="text-[10px] text-slate-400 font-bold">{row.fase2}%</span>}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!hasFase3}
                  onClick={() => setActiveDialog("fase3")}
                  className="flex items-center justify-between text-[11px] text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer py-1.5 px-2 rounded-md disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>Fase 3</span>
                  {row.fase3 !== null && <span className="text-[10px] text-slate-400 font-bold">{row.fase3}%</span>}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs */}
      {activeDialog === "fase1" && hasFase1 && (
        <ActivityListDialog
          fase="Fase 1"
          faseLabel="Fase 1"
          listaRaw={row.listaFase1}
          fasePercent={String(parseProgressNum(row.fase1) || 0)}
          open={true}
          onClose={() => setActiveDialog(null)}
        />
      )}
      {activeDialog === "fase2" && hasFase2 && (
        <ActivityListDialog
          fase="Fase 2"
          faseLabel="Fase 2"
          listaRaw={row.listaFase2}
          fasePercent={String(parseProgressNum(row.fase2) || 0)}
          open={true}
          onClose={() => setActiveDialog(null)}
        />
      )}
      {activeDialog === "fase3" && hasFase3 && (
        <ActivityListDialog
          fase="Fase 3"
          faseLabel="Fase 3"
          listaRaw={row.listaFase3}
          fasePercent={String(parseProgressNum(row.fase3) || 0)}
          open={true}
          onClose={() => setActiveDialog(null)}
        />
      )}
    </>
  )
}

// ──────────────────────────────────────────
// Componente Principal
// ──────────────────────────────────────────
export function ProgressoTable({ data, institution }: { data: any[], institution?: string }) {
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
    "Status", "Fase 1", "Fase 2", "Fase 3", "Total", "Ações"
  ]

  return (
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
            const waUrl = buildWhatsAppUrl(phone, row.aluno)
            const phoneFormatted = formatPhone(phone)

            return (
              <tr
                key={row.id}
                className={`border-b border-gray-100 text-xs transition-colors hover:bg-blue-50/20 ${
                  idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"
                }`}
              >
                {/* Matrícula */}
                <td className="px-3 py-2 font-mono font-bold text-navy whitespace-nowrap">{row.matricula || "-"}</td>

                {/* Nome */}
                <td className="px-3 py-2 font-semibold text-gray-800 min-w-[160px]">{row.aluno || "-"}</td>

                {/* Telefone */}
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                  {phoneFormatted ? (
                    <span className="font-mono">{phoneFormatted}</span>
                  ) : (
                    <span className="text-[#C9CDD4]">-</span>
                  )}
                </td>

                {/* Disciplina */}
                <td className="px-3 py-2 min-w-[180px] max-w-[240px] whitespace-normal break-words leading-snug">
                  {(() => {
                    const parsed = splitCourseAndCode(row.curso)
                    return (
                      <div className="space-y-1">
                        <div className="text-[#1976D2] font-semibold">{parsed.name}</div>
                        {parsed.code && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/70 font-mono font-bold text-[10px]">
                            {parsed.code}
                          </span>
                        )}
                      </div>
                    )
                  })()}
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
                  <ProgressBadge value={row.fase1} listaRaw={row.listaFase1} faseLabel="Fase 1" />
                </td>

                {/* Fase 2 */}
                <td className="px-3 py-2 text-center">
                  <ProgressBadge value={row.fase2} listaRaw={row.listaFase2} faseLabel="Fase 2" />
                </td>

                {/* Fase 3 */}
                <td className="px-3 py-2 text-center">
                  <ProgressBadge value={row.fase3} listaRaw={row.listaFase3} faseLabel="Fase 3" />
                </td>

                {/* Total */}
                <td className="px-3 py-2 text-center">
                  <ProgressBadge value={row.progressoTotal} listaRaw={null} faseLabel="Progresso Total" />
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
  )
}
