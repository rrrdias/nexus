"use client"

import React, { useState, useEffect, useRef } from "react"
import { 
  RefreshCw, 
  Play, 
  Trash2, 
  History, 
  Terminal, 
  Settings, 
  AlertCircle, 
  CheckCircle2, 
  Database, 
  BookOpen, 
  Users, 
  FolderOpen,
  ChevronRight,
  Activity
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  getIntegrationStatus, 
  getIntegrationProfiles, 
  getIntegrationHistory, 
  triggerIntegrationJob 
} from "@/app/actions/integrations"

export function IntegrationsDashboard() {
  const [loading, setLoading] = useState(false)
  const [syncStats, setSyncStats] = useState({ turmas: 0, usuarios: 0, matriculas: 0 })
  const [profiles, setProfiles] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [selectedProfile, setSelectedProfile] = useState("")
  const [selectedJob, setSelectedJob] = useState("")
  const [jobsList, setJobsList] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<"terminal" | "history">("terminal")
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | null }>({ message: "", type: null })
  
  // Terminal state
  const [terminalLogs, setTerminalLogs] = useState<string[]>(["[Nexus] Terminal de Integração AVA inicializado e aguardando ações..."])
  const [isRunning, setIsRunning] = useState(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  
  const terminalEndRef = useRef<HTMLDivElement>(null)

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast({ message: "", type: null }), 4000)
  }

  // Fetch all initial stats and data
  const fetchData = async () => {
    setLoading(true)
    try {
      const [statsRes, profilesRes, historyRes] = await Promise.all([
        getIntegrationStatus(),
        getIntegrationProfiles(),
        getIntegrationHistory()
      ])

      if (statsRes.success) {
        setSyncStats(statsRes.data)
      }
      if (profilesRes.success) {
        setProfiles(profilesRes.data)
        if (profilesRes.data.length > 0) {
          const defaultProf = profilesRes.data[0]
          setSelectedProfile(defaultProf.fileName)
          setJobsList(defaultProf.jobs || [])
          if (defaultProf.jobs?.length > 0) {
            setSelectedJob(defaultProf.jobs[0])
          }
        }
      }
      if (historyRes.success) {
        setHistory(historyRes.data)
      }
    } catch (e) {
      showToast("Falha ao se conectar com as APIs do backend.", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [terminalLogs])

  // Profile change handler
  const handleProfileChange = (fileName: string) => {
    setSelectedProfile(fileName)
    const prof = profiles.find(p => p.fileName === fileName)
    if (prof) {
      setJobsList(prof.jobs || [])
      if (prof.jobs?.length > 0) {
        setSelectedJob(prof.jobs[0])
      } else {
        setSelectedJob("")
      }
    }
  };

  // Poll for logs when a job is running
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRunning && activeJobId) {
      interval = setInterval(async () => {
        try {
          const res = await getIntegrationHistory()
          if (res.success) {
            setHistory(res.data)
            const currentJob = res.data.find((j: any) => j.id === activeJobId)
            if (currentJob) {
              if (currentJob.logs) {
                const logsArray = currentJob.logs.split('\n').filter((l: string) => l.trim() !== '')
                setTerminalLogs(logsArray)
              }
              if (currentJob.status !== 'running') {
                setIsRunning(false)
                setActiveJobId(null)
                // Refresh general stats
                const statsRes = await getIntegrationStatus()
                if (statsRes.success) setSyncStats(statsRes.data)
                
                if (currentJob.status === 'success') {
                  showToast("Integração AVA concluída com sucesso!", "success")
                } else {
                  showToast("Houve uma falha na execução do job Moodle.", "error")
                }
              }
            }
          }
        } catch (e) {
          // Silent fail
        }
      }, 2000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, activeJobId])

  // Execute Sync or Down Job
  const executeJob = async (type: 'sync' | 'down') => {
    if (!selectedProfile || !selectedJob) {
      showToast("Selecione um Perfil e um Job para executar.", "error")
      return
    }

    setIsRunning(true)
    setActiveTab("terminal")
    setTerminalLogs([
      `[Nexus] Iniciando execução do tipo "${type.toUpperCase()}"...`,
      `[Nexus] Perfil: ${selectedProfile} | Job: ${selectedJob}`,
      `[Nexus] Aguardando conexão do backend e stream de console...`
    ])

    try {
      const res = await triggerIntegrationJob(selectedProfile, selectedJob, type)
      if (res.success) {
        // Fetch history immediately to find the new running job ID
        const histRes = await getIntegrationHistory()
        if (histRes.success) {
          setHistory(histRes.data)
          const runningJob = histRes.data.find((j: any) => j.status === 'running')
          if (runningJob) {
            setActiveJobId(runningJob.id)
          } else {
            // If completed instantly
            setIsRunning(false)
            showToast("Integração concluída com sucesso.", "success")
          }
        }
      } else {
        setIsRunning(false)
        showToast(res.error || "Erro ao disparar job.", "error")
      }
    } catch (e) {
      setIsRunning(false)
      showToast("Falha na comunicação com o backend.", "error")
    }
  }

  // Load old log from history row click
  const viewHistoricalLogs = (job: any) => {
    setActiveTab("terminal")
    if (job.logs) {
      const logsArray = job.logs.split('\n').filter((l: string) => l.trim() !== '')
      setTerminalLogs([
        `--- LOG HISTÓRICO: ${job.name} (${new Date(job.startedAt).toLocaleString()}) ---`,
        ...logsArray
      ])
    } else {
      setTerminalLogs([`Sem logs gravados para este job (${job.id})`])
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast.message && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in fade-in slide-in-from-top-3 duration-300 ${
          toast.type === "success" 
            ? "bg-green-50 border-green-200 text-green-800" 
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-navy tracking-tight select-none">Sincronização AVA (Moodle)</h1>
          <p className="text-[#5F6775] text-xs mt-1 select-none">
            Migração completa de extração do Lyceum, diferencial local em Postgres e sincronismo com Moodle OpenLMS.
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchData} 
          disabled={loading || isRunning} 
          className="border-slate-200 text-navy hover:bg-slate-50 gap-2 focus:outline-none"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats Counters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-blue-500 shadow-sm flex flex-col justify-between select-none">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider block">Turmas Sincronizadas</span>
              <span className="text-2xl font-black text-navy font-mono leading-none">{syncStats.turmas.toLocaleString("pt-BR")}</span>
              <p className="text-[9px] text-[#5F6775] font-semibold mt-1">Salas virtuais mapeadas em Postgres</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <FolderOpen className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-[#27AE60] shadow-sm flex flex-col justify-between select-none">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider block">Usuários Ativos</span>
              <span className="text-2xl font-black text-navy font-mono leading-none">{syncStats.usuarios.toLocaleString("pt-BR")}</span>
              <p className="text-[9px] text-[#5F6775] font-semibold mt-1">Discentes e docentes integrados</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-purple-500 shadow-sm flex flex-col justify-between select-none">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider block">Inscrições Sincronizadas</span>
              <span className="text-2xl font-black text-navy font-mono leading-none">{syncStats.matriculas.toLocaleString("pt-BR")}</span>
              <p className="text-[9px] text-[#5F6775] font-semibold mt-1">Matrículas ativas no Moodle</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              <Database className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Card: Execution Setup */}
        <Card className="lg:col-span-4 shadow-sm h-fit">
          <CardHeader className="bg-[#F4F5F7] border-b py-4">
            <CardTitle className="text-sm font-extrabold text-navy flex items-center gap-2 select-none">
              <Settings className="w-4 h-4 text-navy" /> Configurar Execução
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            
            {/* Seletor de Perfil */}
            <div className="space-y-1.5 select-none">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Selecione o Perfil (YAML)</label>
              <select 
                value={selectedProfile}
                onChange={(e) => handleProfileChange(e.target.value)}
                disabled={isRunning}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-navy font-medium shadow-sm transition-colors focus:border-green-brand focus:outline-none disabled:opacity-50 cursor-pointer"
              >
                {profiles.map(p => (
                  <option key={p.fileName} value={p.fileName}>{p.name} ({p.fileName})</option>
                ))}
              </select>
            </div>

            {/* Seletor de Job */}
            <div className="space-y-1.5 select-none">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Selecione o Sub-Job</label>
              <select 
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
                disabled={isRunning || jobsList.length === 0}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-navy font-medium shadow-sm transition-colors focus:border-green-brand focus:outline-none disabled:opacity-50 cursor-pointer"
              >
                {jobsList.length === 0 && <option value="">Nenhum job disponível</option>}
                {jobsList.map(j => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
            </div>

            {/* Ações */}
            <div className="pt-2 space-y-3">
              <Button
                onClick={() => executeJob('sync')}
                disabled={isRunning || jobsList.length === 0}
                className="w-full h-9 bg-green-brand text-navy hover:bg-green-400 font-bold text-xs gap-2 flex items-center justify-center rounded-md border-0 focus:outline-none disabled:opacity-50"
              >
                {isRunning ? (
                  <Activity className="w-3.5 h-3.5 animate-pulse" />
                ) : (
                  <Play className="w-3.5 h-3.5 shrink-0" />
                )}
                Sincronizar (Sync)
              </Button>

              <Button
                onClick={() => executeJob('down')}
                disabled={isRunning || jobsList.length === 0}
                variant="outline"
                className="w-full h-9 border-red-200 text-red-700 hover:bg-red-50 font-bold text-xs gap-2 flex items-center justify-center rounded-md focus:outline-none disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                Desativar Inativos (Down)
              </Button>
            </div>

          </CardContent>
        </Card>

        {/* Right Card: Output Terminal & History */}
        <Card className="lg:col-span-8 shadow-sm flex flex-col justify-between overflow-hidden">
          <CardHeader className="bg-[#F4F5F7] border-b flex flex-row items-center justify-between py-2 px-4 shrink-0">
            {/* Tabs */}
            <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab("terminal")}
                className={`px-3 py-2 text-xs font-bold rounded-md transition-colors focus:outline-none cursor-pointer ${
                  activeTab === "terminal" ? "bg-white text-navy shadow-sm" : "text-[#5F6775] hover:bg-slate-100"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" /> Console Terminal
                </span>
              </button>
              <button 
                onClick={() => setActiveTab("history")}
                className={`px-3 py-2 text-xs font-bold rounded-md transition-colors focus:outline-none cursor-pointer ${
                  activeTab === "history" ? "bg-white text-navy shadow-sm" : "text-[#5F6775] hover:bg-slate-100"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" /> Histórico
                </span>
              </button>
            </div>
            
            {isRunning && (
              <Badge className="bg-amber-100 border border-amber-200 text-amber-800 font-bold flex gap-1.5 items-center select-none animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                Processando...
              </Badge>
            )}
          </CardHeader>
          
          <CardContent className="p-0 flex-1 min-h-[300px] flex flex-col justify-between bg-white overflow-hidden">
            
            {activeTab === "terminal" ? (
              /* Terminal Log View */
              <div className="flex-1 bg-slate-950 p-4 font-mono text-[10px] text-green-400 overflow-y-auto space-y-1.5 max-h-[320px] select-text">
                {terminalLogs.map((log, index) => (
                  <div key={index} className="leading-relaxed whitespace-pre-wrap">{log}</div>
                ))}
                <div ref={terminalEndRef} />
              </div>
            ) : (
              /* Execution History List */
              <div className="flex-1 overflow-auto max-h-[320px]">
                <Table>
                  <TableHeader className="bg-slate-50/50 font-bold">
                    <TableRow>
                      <TableHead className="text-[10px]">Data</TableHead>
                      <TableHead className="text-[10px]">Job</TableHead>
                      <TableHead className="text-[10px]">Unidade/Período</TableHead>
                      <TableHead className="text-[10px] text-center">Status</TableHead>
                      <TableHead className="text-[10px] text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-xs text-[#9AA0AC] py-8">
                          Nenhum job de sincronização executado.
                        </TableCell>
                      </TableRow>
                    )}
                    {history.map((job) => (
                      <TableRow key={job.id} className="hover:bg-slate-50/40">
                        <TableCell className="text-[10px] font-mono whitespace-nowrap">
                          {new Date(job.startedAt).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-[11px] font-bold text-navy">
                          {job.name}
                        </TableCell>
                        <TableCell className="text-[10px] text-[#5F6775]">
                          {job.unidade} ({job.periodo})
                        </TableCell>
                        <TableCell className="text-center select-none">
                          <Badge className={`text-[9px] font-black uppercase tracking-wider ${
                            job.status === 'success' ? 'bg-green-50 border border-green-200 text-green-700' :
                            job.status === 'failed' ? 'bg-red-50 border border-red-200 text-red-700' :
                            'bg-amber-50 border border-amber-200 text-amber-700'
                          }`}>
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right select-none">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => viewHistoricalLogs(job)}
                            className="text-[#1976D2] hover:text-[#1565C0] text-[10px] font-extrabold focus:outline-none"
                          >
                            Ver Log <ChevronRight className="w-3 h-3 ml-0.5 inline-block" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
