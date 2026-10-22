"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, X, CheckCircle2, MapPin, Calendar, Clock, BookOpen, AlertCircle } from "lucide-react"
import { StudentBooking, StudentProfile } from "@/app/actions/student-scheduling"
import { getExamEndTime, normalizeDateStr } from "@/lib/scheduling-utils"

interface StudentVoucherDialogProps {
  isOpen: boolean
  onClose: () => void
  student: StudentProfile
  booking: StudentBooking
}

function formatDatePtBr(dateVal: string | Date): string {
  const norm = normalizeDateStr(dateVal)
  if (!norm) return "—"
  const [y, m, d] = norm.split("-")
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d))
  return dateObj.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function generateVoucherHtml(student: StudentProfile, booking: StudentBooking): string {
  const dataExtenso = formatDatePtBr(booking.data)
  const horaInicio = booking.hora.slice(0, 5)
  const disciplinas = booking.disciplinasSnapshot?.length
    ? booking.disciplinasSnapshot
    : student.disciplinas || []
  const horaFim = getExamEndTime(horaInicio, disciplinas.length)
  const emitDate = new Date().toLocaleString("pt-BR")
  const protocolo = booking.protocolo || booking.id.slice(0, 8).toUpperCase()
  const isOnlinePolo = booking.localNome.toLowerCase().includes("belo horizonte")

  const disciplinasHtml = disciplinas
    .map(
      (disc, idx) =>
        `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; width: 40px; text-align: center; font-weight: bold; color: #1E293B;">${idx + 1}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; color: #1E293B;">${disc}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; width: 90px; text-align: center; color: #64748B;">30 min</td>
        </tr>`
    )
    .join("")

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante de Agendamento - ${student.matricula}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 15mm 14mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #0b1a30;
      font-size: 12px;
      line-height: 1.4;
      background: #ffffff;
    }
    .header {
      border-bottom: 2.5px solid #1C2B4A;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .institution-name {
      font-size: 16px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1C2B4A;
      margin: 0 0 3px 0;
    }
    .institution-sub {
      font-size: 11px;
      color: #475569;
      margin: 0;
    }
    .voucher-title {
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #00875A;
      margin-top: 6px;
    }
    .protocol-box {
      text-align: right;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 8px 14px;
    }
    .protocol-label {
      font-size: 9px;
      font-weight: bold;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .protocol-code {
      font-size: 14px;
      font-weight: 800;
      color: #1C2B4A;
      font-family: monospace;
      letter-spacing: 1px;
    }
    .status-badge {
      display: inline-block;
      margin-top: 4px;
      padding: 2px 8px;
      background-color: #DEF7EC;
      color: #03543F;
      font-size: 10px;
      font-weight: 700;
      border-radius: 9999px;
      text-transform: uppercase;
    }
    .section {
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      color: #1C2B4A;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #CBD5E1;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px 16px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 12px 14px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-size: 9.5px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
    }
    .info-value {
      font-size: 12px;
      font-weight: 600;
      color: #1E293B;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-top: 4px;
    }
    th {
      background: #F1F5F9;
      color: #334155;
      text-transform: uppercase;
      font-size: 9.5px;
      font-weight: 700;
      padding: 8px 12px;
      border-bottom: 1.5px solid #CBD5E1;
    }
    .instructions-box {
      background: #FFFBEB;
      border: 1px solid #FCD34D;
      border-radius: 6px;
      padding: 10px 14px;
      margin-top: 14px;
    }
    .instructions-title {
      font-size: 10.5px;
      font-weight: 800;
      color: #92400E;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .instructions-list {
      margin: 0;
      padding-left: 18px;
      color: #78350F;
      font-size: 10.5px;
      line-height: 1.45;
    }
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px dashed #CBD5E1;
      display: flex;
      justify-content: space-between;
      color: #94A3B8;
      font-size: 9.5px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="institution-name">UniEVANGÉLICA</h1>
      <p class="institution-sub">Pró-Reitoria de Graduação • Coordenação Geral EaD</p>
      <div class="voucher-title">Comprovante de Agendamento de Prova Presencial</div>
    </div>
    <div class="protocol-box">
      <div class="protocol-label">Protocolo</div>
      <div class="protocol-code">#${protocolo}</div>
      <span class="status-badge">Confirmado</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Dados do Estudante</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Nome Completo</span>
        <span class="info-value">${student.nome}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Matrícula</span>
        <span class="info-value">${student.matricula}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Modalidade / Curso</span>
        <span class="info-value">Graduação EaD • Disciplinas Regulares</span>
      </div>
      <div class="info-item">
        <span class="info-label">Período Letivo</span>
        <span class="info-value">${booking.periodo.replace("-", "/")}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Local e Horário da Avaliação</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Polo / Unidade</span>
        <span class="info-value">${booking.localNome}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Data da Prova</span>
        <span class="info-value" style="color: #00875A; font-weight: 700;">${dataExtenso}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Horário de Realização</span>
        <span class="info-value" style="color: #1C2B4A; font-weight: 700;">${horaInicio}${horaFim ? ` às ${horaFim}` : ""}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Endereço do Polo</span>
        <span class="info-value">${booking.localEndereco || "Conforme cadastro da unidade"}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Disciplinas Avaliadas (${disciplinas.length})</div>
    <table>
      <thead>
        <tr>
          <th style="width: 40px; text-align: center;">#</th>
          <th style="text-align: left;">Disciplina</th>
          <th style="width: 90px; text-align: center;">Duração</th>
        </tr>
      </thead>
      <tbody>
        ${disciplinasHtml}
      </tbody>
    </table>
  </div>

  <div class="instructions-box">
    <div class="instructions-title">Instruções Obrigatórias para o Estudante:</div>
    <ul class="instructions-list">
      ${
        isOnlinePolo
          ? `<li><strong>Polo Belo Horizonte (Online):</strong> As avaliações deste polo são realizadas diretamente no AVA. Verifique sua conexão e os horários de liberação da prova na plataforma.</li>`
          : `<li><strong>Pontualidade:</strong> Compareça ao polo com antecedência mínima de 15 minutos em relação ao horário agendado.</li>
             <li><strong>Identificação:</strong> É obrigatória a apresentação de documento oficial de identificação com foto (RG, CNH, Passaporte ou CTPS Digital).</li>
             <li><strong>Material:</strong> Traga caneta esferográfica de tinta azul ou preta em tubo transparente.</li>
             <li><strong>Dispositivos eletrônicos:</strong> Aparelhos celulares, smartwatches e outros eletrônicos devem permanecer desligados durante todo o período de aplicação.</li>`
      }
    </ul>
  </div>

  <div class="footer">
    <div>Emissão: ${emitDate} • Nexus Core</div>
    <div>UniEVANGÉLICA • Sistema Integrado de Agendamento EaD</div>
  </div>
</body>
</html>`
}

export function StudentVoucherDialog({
  isOpen,
  onClose,
  student,
  booking,
}: StudentVoucherDialogProps) {
  const handlePrint = () => {
    const html = generateVoucherHtml(student, booking)

    let iframe = document.getElementById(
      "student-voucher-frame"
    ) as HTMLIFrameElement
    if (!iframe) {
      iframe = document.createElement("iframe")
      iframe.id = "student-voucher-frame"
      iframe.style.position = "fixed"
      iframe.style.right = "0"
      iframe.style.bottom = "0"
      iframe.style.width = "0"
      iframe.style.height = "0"
      iframe.style.border = "0"
      iframe.style.visibility = "hidden"
      document.body.appendChild(iframe)
    }

    const doc = iframe.contentWindow?.document
    if (!doc) {
      window.print()
      return
    }

    doc.open()
    doc.write(html)
    doc.close()

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch {
        window.print()
      }
    }, 250)
  }

  const dataExtenso = formatDatePtBr(booking.data)
  const horaInicio = booking.hora.slice(0, 5)
  const disciplinas = booking.disciplinasSnapshot?.length
    ? booking.disciplinasSnapshot
    : student.disciplinas || []
  const horaFim = getExamEndTime(horaInicio, disciplinas.length)
  const protocolo = booking.protocolo || booking.id.slice(0, 8).toUpperCase()
  const isOnlinePolo = booking.localNome.toLowerCase().includes("belo horizonte")

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-[#1C2B4A] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2DCE6C]/20 border border-[#2DCE6C]/30 flex items-center justify-center text-[#2DCE6C]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                Comprovante de Agendamento
              </DialogTitle>
              <p className="text-xs text-slate-300 mt-0.5">
                Protocolo #{protocolo} • Período {booking.periodo.replace("-", "/")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Scrollable */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Card Resumo do Local e Horário */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Polo Selecionado
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                Confirmado
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-900">
                    {booking.localNome}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    {booking.localEndereco || "Conforme cadastro da unidade"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-700">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-900 capitalize">
                    {dataExtenso}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-emerald-700">
                    {horaInicio}
                    {horaFim ? ` às ${horaFim}` : ""}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({disciplinas.length * 30} min total)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dados do Estudante */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-white border border-slate-200 rounded-xl p-3.5">
            <div>
              <span className="text-slate-400 block font-medium uppercase text-[10px]">
                Estudante
              </span>
              <span className="font-semibold text-slate-800 text-sm">
                {student.nome}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium uppercase text-[10px]">
                Matrícula
              </span>
              <span className="font-semibold text-slate-800 text-sm">
                {student.matricula}
              </span>
            </div>
          </div>

          {/* Disciplinas Avaliadas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-slate-400" />
                Disciplinas Avaliadas ({disciplinas.length})
              </span>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {disciplinas.map((disc, idx) => (
                <div
                  key={idx}
                  className="px-3.5 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors"
                >
                  <span className="text-slate-800 font-medium">
                    {idx + 1}. {disc}
                  </span>
                  <span className="text-slate-400 shrink-0 text-[11px] bg-slate-100 px-2 py-0.5 rounded-full">
                    30 minutos
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerta de Instruções */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-amber-900">
                Informações Importantes:
              </div>
              {isOnlinePolo ? (
                <div>
                  Para o Polo Belo Horizonte, as provas são realizadas no
                  Ambiente Virtual de Aprendizagem (AVA).
                </div>
              ) : (
                <div className="space-y-0.5 text-amber-800/90 text-[11.5px]">
                  <div>• Chegue com 15 minutos de antecedência.</div>
                  <div>• Apresente documento oficial original com foto.</div>
                  <div>• Traga caneta azul ou preta em tubo transparente.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-800"
          >
            Fechar
          </Button>
          <Button
            type="button"
            onClick={handlePrint}
            className="bg-[#2DCE6C] hover:bg-[#22A857] text-[#0A192F] font-semibold gap-2 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Imprimir Comprovante
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
