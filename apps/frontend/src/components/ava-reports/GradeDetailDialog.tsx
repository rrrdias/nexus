"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  GraduationCap, 
  MapPin, 
  Clock, 
  TrendingUp, 
  Layers
} from "lucide-react"

interface GradeDetailDialogProps {
  open: boolean
  onClose: () => void
  studentName: string
  matricula: string
  curso: string
  polo: string
  lastaccess: string
  diasSemAcesso: string
  faseActive?: "fase1" | "fase2" | "fase3" | "media" | "all"
  fase1Nota: string
  fase2Nota: string
  fase3Nota: string
  mediaFinal: string
  fase1Prog: string
  fase2Prog: string
  fase3Prog: string
  progTotal: string
}

function parseNum(val: string | null | undefined): number {
  if (!val || val === "-" || val === "null") return 0
  const n = parseFloat(String(val).replace("%", "").replace(",", "."))
  return isNaN(n) ? 0 : n
}

export function GradeDetailDialog({
  open,
  onClose,
  studentName,
  matricula,
  curso,
  polo,
  lastaccess,
  diasSemAcesso,
  faseActive = "all",
  fase1Nota,
  fase2Nota,
  fase3Nota,
  mediaFinal,
  fase1Prog,
  fase2Prog,
  fase3Prog,
  progTotal,
}: GradeDetailDialogProps) {
  const nF1 = parseNum(fase1Nota)
  const nF2 = parseNum(fase2Nota)
  const nF3 = parseNum(fase3Nota)
  const nMedia = parseNum(mediaFinal)

  const isAprovado = nMedia >= 6.0 || nMedia >= 60

  const getStatusBadge = (grade: number) => {
    if (grade >= 60 || (grade >= 6.0 && grade <= 10.0)) {
      return {
        label: "Apto / Aprovado",
        color: "bg-green-50 text-green-700 border-green-200",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
      }
    }
    if (grade > 0) {
      return {
        label: "Abaixo da Média",
        color: "bg-red-50 text-red-700 border-red-200",
        icon: <AlertCircle className="w-3.5 h-3.5 text-red-600" />
      }
    }
    return {
      label: "Não Avaliado",
      color: "bg-gray-50 text-gray-500 border-gray-200",
      icon: <Clock className="w-3.5 h-3.5 text-gray-400" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-0 border-0 shadow-2xl rounded-2xl overflow-hidden bg-white select-none">
        <div className="p-6 max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] space-y-6">
          
          {/* Header */}
          <DialogHeader className="border-b border-gray-1 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider">
                Extrato Acadêmico
              </span>
              <span className="text-[11px] text-gray-4 font-mono">Moodle EaD</span>
            </div>
            <DialogTitle className="text-xl font-extrabold text-navy flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              Detalhamento de Notas do Aluno
            </DialogTitle>
          </DialogHeader>

          {/* Card de Identificação do Aluno */}
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-navy flex items-center gap-1.5">
                  <User className="w-4 h-4 text-navy/40" />
                  <span>{studentName}</span>
                </div>
                <div className="text-xs text-gray-5 font-mono mt-0.5">
                  Matrícula: <strong className="text-navy">{matricula || "-"}</strong>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold ${
                  isAprovado ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                }`}>
                  {isAprovado ? "Média Aprovada" : "Abaixo da Média"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs text-gray-6">
              <div className="flex items-center gap-1.5 truncate">
                <GraduationCap className="w-3.5 h-3.5 text-gray-4 shrink-0" />
                <span className="truncate" title={curso}>{curso}</span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-gray-4 shrink-0" />
                <span className="truncate">{polo || "Polo Principal"}</span>
              </div>
            </div>
          </div>

          {/* Cards das Fases Individuais */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-4 uppercase tracking-wider">Desempenho por Etapas</h4>
            
            <div className="grid grid-cols-3 gap-3">
              {/* Fase 1 */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                faseActive === "fase1" ? "border-blue-500 bg-blue-50/30 ring-2 ring-blue-200" : "border-gray-2 bg-white"
              }`}>
                <div className="text-[10px] font-extrabold text-blue-900 uppercase">Fase 1</div>
                <div className="text-2xl font-black text-navy font-mono mt-1 leading-none">{fase1Nota || "-"}</div>
                <div className="mt-2.5 pt-2 border-t border-gray-1 flex flex-col gap-1 text-[10px] text-gray-5">
                  <div className="flex justify-between items-center">
                    <span>Progresso:</span>
                    <strong className="text-navy">{fase1Prog || "0"}%</strong>
                  </div>
                </div>
              </div>

              {/* Fase 2 */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                faseActive === "fase2" ? "border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-200" : "border-gray-2 bg-white"
              }`}>
                <div className="text-[10px] font-extrabold text-indigo-900 uppercase">Fase 2</div>
                <div className="text-2xl font-black text-navy font-mono mt-1 leading-none">{fase2Nota || "-"}</div>
                <div className="mt-2.5 pt-2 border-t border-gray-1 flex flex-col gap-1 text-[10px] text-gray-5">
                  <div className="flex justify-between items-center">
                    <span>Progresso:</span>
                    <strong className="text-navy">{fase2Prog || "0"}%</strong>
                  </div>
                </div>
              </div>

              {/* Fase 3 */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                faseActive === "fase3" ? "border-purple-500 bg-purple-50/30 ring-2 ring-purple-200" : "border-gray-2 bg-white"
              }`}>
                <div className="text-[10px] font-extrabold text-purple-900 uppercase">Fase 3</div>
                <div className="text-2xl font-black text-navy font-mono mt-1 leading-none">{fase3Nota || "-"}</div>
                <div className="mt-2.5 pt-2 border-t border-gray-1 flex flex-col gap-1 text-[10px] text-gray-5">
                  <div className="flex justify-between items-center">
                    <span>Progresso:</span>
                    <strong className="text-navy">{fase3Prog || "0"}%</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card Consolidado Geral */}
          <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-xl flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[11px] font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-700" />
                Média Final Consolidada
              </div>
              <div className="text-3xl font-black text-emerald-950 font-mono">
                {mediaFinal || "-"}
                <span className="text-sm font-sans font-normal text-emerald-700 ml-1">/ 10</span>
              </div>
            </div>

            <div className="text-right space-y-1">
              <div className="text-[10px] font-bold text-emerald-800 uppercase">Progresso Total</div>
              <div className="text-xl font-black text-navy font-mono">{progTotal || "0"}%</div>
              <div className="text-[10px] text-emerald-700 font-medium">Todas as fases</div>
            </div>
          </div>

          {/* Informações de Acesso */}
          <div className="text-xs text-gray-4 flex items-center justify-between border-t border-gray-1 pt-3">
            <span>Último Acesso ao AVA: <strong className="text-gray-7">{lastaccess || "Nunca acessou"}</strong></span>
            <span>Dias sem acesso: <strong className="text-gray-7">{diasSemAcesso === "-" ? "Sem acesso" : `${diasSemAcesso} dias`}</strong></span>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
