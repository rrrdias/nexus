"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { getAttendanceList } from "@/app/actions/scheduling"
import { Printer, RefreshCw, FileText, AlertCircle } from "lucide-react"

interface AttendanceListDialogProps {
  isOpen: boolean
  onClose: () => void
  locals: any[]
  availablePeriods: string[]
  initialLocalId?: string
  initialDate?: string
  initialPeriod?: string
}

function generatePrintDocument(
  records: any[],
  localObj: any,
  dataProvaStr: string,
  periodoStr: string
): string {
  const formattedPeriod = periodoStr ? periodoStr.replace("-", "/") : ""
  const emitDate = new Date().toLocaleString("pt-BR")
  const localNome = localObj?.nome || "Polo Presencial"
  const localEndereco = localObj?.endereco || "Conforme cadastro da unidade"

  const rowsHtml = records
    .map((item, idx) => {
      const num = String(idx + 1).padStart(2, "0")
      const horario = item.horaInicio
        ? `${item.horaInicio}${item.horaFim ? ` às ${item.horaFim}` : ""}`
        : "—"
      const disciplinasHtml =
        item.disciplinas && item.disciplinas.length > 0
          ? `<ul style="margin: 0; padding-left: 14px; list-style-type: disc;">${item.disciplinas
              .map((d: string) => `<li style="margin-bottom: 2px;">${d}</li>`)
              .join("")}</ul>`
          : '<span style="color: #64748B; font-style: italic;">Prova semestral</span>'

      return `
        <tr style="page-break-inside: avoid; ${idx % 2 === 1 ? "background-color: #F8FAFC;" : "background-color: #ffffff;"}">
          <td style="border: 1px solid #CBD5E1; padding: 7px 6px; text-align: center; font-family: monospace; font-size: 10px; color: #64748B;">${num}</td>
          <td style="border: 1px solid #CBD5E1; padding: 7px 8px; text-align: center; font-weight: bold; color: #002B49; white-space: nowrap;">${horario}</td>
          <td style="border: 1px solid #CBD5E1; padding: 7px 8px; font-family: monospace; font-size: 11px; font-weight: bold; color: #1E293B;">${item.matricula}</td>
          <td style="border: 1px solid #CBD5E1; padding: 7px 8px;">
            <div style="font-weight: bold; color: #002B49; text-transform: uppercase; font-size: 11px;">${item.studentName}</div>
            ${item.studentEmail ? `<div style="font-size: 9.5px; color: #64748B;">${item.studentEmail}</div>` : ""}
          </td>
          <td style="border: 1px solid #CBD5E1; padding: 7px 8px; font-size: 9.5px; color: #334155;">
            ${disciplinasHtml}
          </td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; height: 44px; vertical-align: bottom;">
            <div style="border-bottom: 1px solid #94A3B8; width: 100%; margin-bottom: 2px;"></div>
          </td>
        </tr>
      `
    })
    .join("")

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Folha Oficial de Presença - ${localNome}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 10mm 12mm 10mm;
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
      background: #ffffff;
      color: #0b1a30;
      font-size: 11px;
      line-height: 1.35;
    }
    .header {
      border-bottom: 2.5px solid #002B49;
      padding-bottom: 10px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 3px;
    }
    .brand-icon {
      background-color: #00875A !important;
      color: #ffffff !important;
      font-weight: 800;
      font-size: 12px;
      width: 20px;
      height: 20px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .brand-text {
      font-weight: 800;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #002B49;
    }
    .doc-title {
      font-size: 15px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #002B49;
      margin: 2px 0 2px 0;
    }
    .doc-subtitle {
      font-size: 10.5px;
      color: #4B5563;
      margin: 0;
    }
    .meta {
      text-align: right;
      font-size: 10.5px;
      line-height: 1.4;
    }
    .meta-period {
      font-weight: 800;
      color: #00875A;
      font-family: monospace;
      font-size: 12px;
    }
    .banner {
      background-color: #F8FAFC !important;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    .banner-col {
      flex: 1;
    }
    .banner-label {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      color: #64748B;
      display: block;
      margin-bottom: 2px;
      letter-spacing: 0.3px;
    }
    .banner-value {
      font-weight: 800;
      color: #002B49;
      font-size: 12px;
    }
    .banner-total {
      font-weight: 900;
      color: #00875A;
      font-size: 12.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
    }
    thead {
      display: table-header-group;
    }
    th {
      background-color: #002B49 !important;
      color: #ffffff !important;
      border: 1px solid #002B49;
      padding: 7px 8px;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1.5px solid #CBD5E1;
      page-break-inside: avoid;
    }
    .declaration {
      font-size: 9.5px;
      font-style: italic;
      color: #64748B;
      margin-bottom: 28px;
      line-height: 1.4;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      gap: 40px;
      padding-top: 10px;
    }
    .sig-col {
      flex: 1;
      text-align: center;
    }
    .sig-line {
      border-bottom: 1.5px solid #1E293B;
      margin-bottom: 6px;
    }
    .sig-label {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: #002B49;
      letter-spacing: 0.3px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">
        <span class="brand-icon">N</span>
        <span class="brand-text">Nexus Hub — Tecnologias Educacionais</span>
      </div>
      <div class="doc-title">Folha Oficial de Presença — Avaliação Presencial</div>
      <div class="doc-subtitle">Controle de Acesso e Assinatura de Estudantes no Polo</div>
    </div>
    <div class="meta">
      <div>Período: <span class="meta-period">${formattedPeriod}</span></div>
      <div>Data: <strong>${dataProvaStr}</strong></div>
      <div style="font-size: 9.5px; color: #64748B; margin-top: 2px;">Emitido em: ${emitDate}</div>
    </div>
  </div>

  <div class="banner">
    <div class="banner-col">
      <span class="banner-label">Polo / Unidade</span>
      <div class="banner-value">${localNome}</div>
    </div>
    <div class="banner-col">
      <span class="banner-label">Endereço</span>
      <div style="color: #334155; font-size: 11px;">${localEndereco}</div>
    </div>
    <div style="text-align: right; min-width: 140px;">
      <span class="banner-label">Total de Alunos</span>
      <div class="banner-total">${records.length} aluno(s) agendado(s)</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 35px; text-align: center;">#</th>
        <th style="width: 100px; text-align: center;">Horário</th>
        <th style="width: 90px; text-align: left;">Matrícula</th>
        <th style="text-align: left;">Nome do Estudante</th>
        <th style="width: 220px; text-align: left;">Disciplinas a Realizar</th>
        <th style="width: 190px; text-align: center;">Assinatura do Aluno</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer">
    <div class="declaration">
      * Declaro que os estudantes acima assinaram a presente lista de presença no momento do ingresso na sala de aplicação, tendo suas identidades devidamente conferidas.
    </div>
    <div class="signatures">
      <div class="sig-col">
        <div class="sig-line"></div>
        <div class="sig-label">Nome Legível do Fiscal de Polo</div>
      </div>
      <div class="sig-col">
        <div class="sig-line"></div>
        <div class="sig-label">Assinatura do Fiscal / Responsável</div>
      </div>
    </div>
  </div>
</body>
</html>`
}

export function AttendanceListDialog({
  isOpen,
  onClose,
  locals,
  availablePeriods,
  initialLocalId = "",
  initialDate = "",
  initialPeriod = ""
}: AttendanceListDialogProps) {
  const [localId, setLocalId] = useState(initialLocalId === "all" ? "" : initialLocalId)
  const [dataProva, setDataProva] = useState(initialDate)
  const [periodo, setPeriodo] = useState(initialPeriod || availablePeriods[0] || "2026-1")
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const handleFetch = useCallback(
    async (lId = localId, dt = dataProva, per = periodo) => {
      if (!lId) return
      setLoading(true)
      try {
        const data = await getAttendanceList({
          localId: lId,
          data: dt || undefined,
          periodo: per || undefined,
        })
        setRecords(data)
        setHasLoaded(true)
      } catch (err) {
        console.error("Erro ao buscar lista de presença:", err)
        setRecords([])
      } finally {
        setLoading(false)
      }
    },
    [localId, dataProva, periodo]
  )

  // Sync with initial props whenever modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialLocalId && initialLocalId !== "all") setLocalId(initialLocalId)
      if (initialDate) setDataProva(initialDate)
      if (initialPeriod) setPeriodo(initialPeriod)
      if (initialLocalId && initialLocalId !== "all" && initialDate) {
        handleFetch(initialLocalId, initialDate, initialPeriod || availablePeriods[0])
      }
    }
  }, [isOpen, initialLocalId, initialDate, initialPeriod, availablePeriods, handleFetch])

  const selectedLocalObj = locals.find((l: any) => String(l.id) === String(localId))
  const formattedDate = dataProva ? new Date(dataProva + "T00:00:00").toLocaleDateString("pt-BR") : "Todas as datas"

  const handlePrint = () => {
    if (records.length === 0) return

    const htmlContent = generatePrintDocument(
      records,
      selectedLocalObj,
      formattedDate,
      periodo
    )

    let iframe = document.getElementById("attendance-print-frame") as HTMLIFrameElement
    if (!iframe) {
      iframe = document.createElement("iframe")
      iframe.id = "attendance-print-frame"
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
    doc.write(htmlContent)
    doc.close()

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch (err) {
        console.error("Print error in iframe, fallback to window.print:", err)
        window.print()
      }
    }, 250)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl bg-white border border-slate-200/90 rounded-2xl shadow-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Header - Screen only */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0 print:hidden select-none">
          <div className="flex items-center gap-3.5 pr-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-green-dark shrink-0 shadow-xs">
              <FileText className="w-5 h-5 text-green-dark" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-navy tracking-tight">
                Lista de Presença para Fiscais de Polo
              </DialogTitle>
              <p className="text-xs text-[#5F6775] mt-0.5">
                Gere e imprima folhas oficiais A4 para coleta de assinatura dos alunos.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              disabled={records.length === 0}
              className="bg-navy hover:bg-navy-light text-white font-bold px-4 h-9 rounded-xl gap-2 shadow-sm disabled:opacity-50 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-green-brand" /> Imprimir Folha A4
            </Button>
          </div>
        </div>

        {/* Filter Toolbar - Screen only */}
        <div className="p-4 bg-[#F8F9FA] border-b border-gray-200 grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0 print:hidden">
          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-navy uppercase">1. Polo / Campus *</Label>
            <select
              value={localId}
              onChange={(e) => setLocalId(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-1 focus:ring-navy"
            >
              <option value="">Selecione o Polo...</option>
              {locals.map((l: any) => (
                <option key={l.id} value={l.id}>{l.nome}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-navy uppercase">2. Data da Prova</Label>
            <Input
              type="date"
              value={dataProva}
              onChange={(e) => setDataProva(e.target.value)}
              className="text-xs border-gray-300 focus:border-navy h-8 bg-white"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-navy uppercase">3. Semestre / Período</Label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-1 focus:ring-navy"
            >
              {availablePeriods.map((p) => (
                <option key={p} value={p}>{p.includes("-") ? p.replace("-", "/") : p}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={() => handleFetch()}
              disabled={!localId || loading}
              className="w-full h-8 text-xs bg-green-dark hover:bg-green-brand text-white gap-1.5"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Gerar Lista"}
            </Button>
          </div>
        </div>

        {/* Document Body (Scrollable in modal, visible in print) */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 print:bg-white print:p-0 print:overflow-visible">
          {!hasLoaded ? (
            <div className="text-center py-16 text-[#5F6775] print:hidden">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-semibold">Selecione o polo e clique em &quot;Gerar Lista&quot;</p>
              <p className="text-xs text-[#9AA0AC] mt-1">A folha de presença será formatada para visualização e impressão imediata.</p>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-16 text-[#E53935] bg-white rounded-xl border border-gray-200 print:hidden">
              <AlertCircle className="w-12 h-12 mx-auto text-[#E53935]/60 mb-3" />
              <p className="text-sm font-bold">Nenhum agendamento encontrado</p>
              <p className="text-xs text-[#5F6775] mt-1">Não há provas ativas cadastradas para o polo e data selecionados.</p>
            </div>
          ) : (
            <div id="attendance-print-area" className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 print:border-none print:shadow-none print:p-0">
              {/* Official Document Header */}
              <div className="border-b-2 border-navy pb-4 mb-5 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded bg-green-dark text-white font-bold text-xs flex items-center justify-center">N</div>
                    <span className="font-extrabold text-navy tracking-tight text-sm uppercase">Nexus Hub — Tecnologias Educacionais</span>
                  </div>
                  <h2 className="text-lg font-black text-navy uppercase tracking-wide">
                    Folha Oficial de Presença — Avaliação Presencial
                  </h2>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Controle de Acesso e Assinatura de Estudantes no Polo
                  </p>
                </div>

                <div className="text-right text-xs space-y-0.5">
                  <p className="font-bold text-navy">Período: <span className="font-mono text-green-dark">{periodo?.replace("-", "/")}</span></p>
                  <p className="text-gray-600">Data: <span className="font-bold text-navy">{formattedDate}</span></p>
                  <p className="text-gray-500 text-[10px]">Emitido em: {new Date().toLocaleString("pt-BR")}</p>
                </div>
              </div>

              {/* Campus / Polo Info Banner */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5 mb-5 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs print:bg-white print:border-gray-300">
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-500 block">Polo / Unidade</span>
                  <span className="font-bold text-navy text-sm">{selectedLocalObj?.nome || "Polo Central"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-500 block">Endereço</span>
                  <span className="text-gray-700 text-xs">{selectedLocalObj?.endereco || "Conforme cadastro"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-500 block">Total de Alunos</span>
                  <span className="font-extrabold text-green-dark text-sm">{records.length} aluno(s) agendado(s)</span>
                </div>
              </div>

              {/* Attendance Table */}
              <table className="w-full text-left border-collapse border border-gray-300 text-xs">
                <thead>
                  <tr className="bg-navy text-white text-[11px] font-bold uppercase print:bg-gray-200 print:text-black">
                    <th className="p-2 border border-gray-300 w-10 text-center">#</th>
                    <th className="p-2 border border-gray-300 w-24 text-center">Horário</th>
                    <th className="p-2 border border-gray-300 w-28">Matrícula</th>
                    <th className="p-2 border border-gray-300">Nome do Estudante</th>
                    <th className="p-2 border border-gray-300 w-48">Disciplinas a Realizar</th>
                    <th className="p-2 border border-gray-300 w-56 text-center">Assinatura do Aluno</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((item, idx) => (
                    <tr 
                      key={item.id} 
                      className={`break-inside-avoid ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"} print:bg-white`}
                    >
                      <td className="p-2 border border-gray-300 text-center text-gray-500 font-mono text-[10px]">
                        {String(idx + 1).padStart(2, "0")}
                      </td>
                      <td className="p-2 border border-gray-300 text-center font-bold text-navy whitespace-nowrap">
                        {item.horaInicio} {item.horaFim ? `às ${item.horaFim}` : ""}
                      </td>
                      <td className="p-2 border border-gray-300 font-mono text-gray-800 font-semibold">
                        {item.matricula}
                      </td>
                      <td className="p-2 border border-gray-300">
                        <div className="font-bold text-navy uppercase text-[11px]">{item.studentName}</div>
                        {item.studentEmail && <div className="text-[10px] text-gray-500 truncate">{item.studentEmail}</div>}
                      </td>
                      <td className="p-2 border border-gray-300 text-[10px] text-gray-700">
                        {item.disciplinas && item.disciplinas.length > 0 ? (
                          <ul className="list-disc list-inside space-y-0.5">
                            {item.disciplinas.map((d: string, dIdx: number) => (
                              <li key={dIdx} className="truncate">{d}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="italic text-gray-400">Prova semestral</span>
                        )}
                      </td>
                      <td className="p-2 border border-gray-300 h-12 align-bottom">
                        <div className="border-b border-gray-400 w-full mb-1"></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Proctor Verification Footer */}
              <div className="mt-8 pt-4 border-t-2 border-gray-300 break-inside-avoid">
                <p className="text-[10px] text-gray-600 mb-6 italic">
                  * Declaro que os estudantes acima assinaram a presente lista de presença no momento do ingresso na sala de aplicação, tendo suas identidades devidamente conferidas.
                </p>
                <div className="grid grid-cols-2 gap-8 text-xs pt-4">
                  <div>
                    <div className="border-b border-gray-800 mb-1 w-full"></div>
                    <p className="font-bold text-navy text-[11px] uppercase">Nome Legível do Fiscal de Polo</p>
                  </div>
                  <div>
                    <div className="border-b border-gray-800 mb-1 w-full"></div>
                    <p className="font-bold text-navy text-[11px] uppercase">Assinatura do Fiscal / Responsável</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer (Screen only) */}
        <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0 print:hidden select-none">
          <Button 
            type="button"
            variant="outline" 
            onClick={onClose} 
            className="border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium px-4 h-9 rounded-xl transition-all cursor-pointer"
          >
            Fechar
          </Button>
          {records.length > 0 && (
            <Button 
              type="button"
              onClick={handlePrint} 
              className="bg-navy hover:bg-navy-light text-white font-bold px-5 h-9 rounded-xl shadow-sm gap-2 transition-all cursor-pointer active:scale-98"
            >
              <Printer className="w-4 h-4 text-green-brand" /> Imprimir Folha
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
