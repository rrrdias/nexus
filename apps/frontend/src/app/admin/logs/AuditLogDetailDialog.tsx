"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Eye, Shield, Globe, Clock, User, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"

interface AuditLogDetailDialogProps {
  log: any
}

export function AuditLogDetailDialog({ log }: AuditLogDetailDialogProps) {
  const [open, setOpen] = useState(false)

  let formattedDetails: any = null
  let isJson = false

  if (log.details) {
    try {
      formattedDetails = JSON.parse(log.details)
      isJson = true
    } catch {
      formattedDetails = log.details
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 gap-1 font-semibold text-xs py-0.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Sucesso
          </Badge>
        )
      case "FAILURE":
        return (
          <Badge className="bg-rose-50 text-rose-700 border border-rose-200 gap-1 font-semibold text-xs py-0.5">
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Falha / Bloqueado
          </Badge>
        )
      default:
        return (
          <Badge className="bg-amber-50 text-amber-700 border border-amber-200 gap-1 font-semibold text-xs py-0.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> {status}
          </Badge>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-slate-500 hover:text-navy gap-1.5 text-xs"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Detalhes</span>
          </Button>
        }
      />
      <DialogContent className="max-w-2xl bg-white p-6 rounded-2xl shadow-2xl border border-slate-200">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold text-navy flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-dark" />
              Detalhes do Registro de Auditoria
            </DialogTitle>
            {getStatusBadge(log.status)}
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">ID: {log.id}</p>
        </DialogHeader>

        <div className="space-y-4 pt-4 text-xs">
          {/* Informações Básicas em Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Ação Executada</span>
              <p className="font-semibold text-navy text-sm font-mono">{log.action}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Categoria</span>
              <Badge variant="outline" className="border-slate-300 text-slate-700 font-bold text-[11px]">
                {log.category}
              </Badge>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" /> Data e Horário
              </span>
              <p className="text-slate-700 font-medium">
                {log.timestamp ? new Date(log.timestamp).toLocaleString("pt-BR") : "-"}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" /> Usuário Responsável
              </span>
              <p className="text-slate-800 font-semibold">{log.userName || "Sistema / Anônimo"}</p>
              <p className="text-slate-500 text-[11px] font-mono">{log.userEmail || "-"}</p>
            </div>
          </div>

          {/* Origem da Conexão */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
              <Globe className="w-3 h-3 text-slate-400" /> Origem da Conexão
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <span className="text-[11px] text-slate-500">Endereço IP:</span>
                <p className="font-mono text-slate-800 font-semibold">{log.ipAddress || "Não informado"}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[11px] text-slate-500">User-Agent:</span>
                <p className="font-mono text-[11px] text-slate-600 break-all bg-white p-2 rounded-lg border border-slate-200 mt-1">
                  {log.userAgent || "Não informado"}
                </p>
              </div>
            </div>
          </div>

          {/* Dados e Detalhes da Ação */}
          {log.details && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Metadados & Detalhes da Operação
              </span>
              <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-[11px] overflow-x-auto max-h-56 border border-slate-800">
                {isJson ? (
                  <pre>{JSON.stringify(formattedDetails, null, 2)}</pre>
                ) : (
                  <p className="text-slate-200 whitespace-pre-wrap">{log.details}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
