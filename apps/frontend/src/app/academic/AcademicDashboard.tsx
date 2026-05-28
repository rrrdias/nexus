"use client"

import React, { useState, useEffect } from "react"
import { 
  Search, 
  User, 
  GraduationCap, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Layers,
  X,
  FileSpreadsheet,
  CheckCircle2,
  Bookmark
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getStudents, getStudentDisciplines, getTeachers, getTeacherDisciplines, getClasses, getMatriculas } from "@/app/actions/academic"

type TabType = "discentes" | "docentes" | "turmas" | "matriculas"

export function AcademicDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("discentes")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | null }>({ message: "", type: null })
  const [hasSearched, setHasSearched] = useState(false)

  // Data states
  const [listData, setListData] = useState<any[]>([])
  const [meta, setMeta] = useState({ total: 0, page: 1, size: 15, totalPages: 1 })

  // Drawer/Linked disciplines state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerTitle, setDrawerTitle] = useState("")
  const [drawerSubtitle, setDrawerSubtitle] = useState("")
  const [drawerData, setDrawerData] = useState<any[]>([])

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast({ message: "", type: null }), 4000)
  }

  // Fetch data dynamically on tab or query change
  const fetchData = async () => {
    setLoading(true)
    try {
      let res: any
      if (activeTab === "discentes") {
        res = await getStudents({ search, page, size: 15 })
      } else if (activeTab === "docentes") {
        res = await getTeachers({ search, page, size: 15 })
      } else if (activeTab === "turmas") {
        res = await getClasses({ search, page, size: 15 })
      } else {
        res = await getMatriculas({ search, page, size: 15 })
      }

      if (res.success && res.data) {
        setListData(res.data.data || [])
        setMeta({
          total: res.data.total || 0,
          page: res.data.page || 1,
          size: res.data.size || 15,
          totalPages: res.data.totalPages || 1
        })
      } else {
        showToast(res.error || "Falha ao buscar registros do Lyceum.", "error")
      }
    } catch (err: any) {
      showToast("Ocorreu um erro na requisição.", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hasSearched) {
      fetchData()
    } else {
      setListData([])
      setMeta({ total: 0, page: 1, size: 15, totalPages: 1 })
    }
  }, [activeTab, page])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setHasSearched(true)
    if (page !== 1) {
      setPage(1)
    } else {
      fetchData()
    }
  }

  // Row resolvers to elegantly map dynamic view column names case-insensitively
  const resolveStudentRow = (row: any) => {
    const nomeBase = row.NOME_SOCIAL || row.NOME || row.Nome || row.nome || row.ALUNO || row.aluno || "Não Identificado"
    const sobrenomeBase = row.SOBRENOME_SOCIAL || row.SOBRENOME || row.Sobrenome || row.sobrenome || ""
    const nomeCompleto = `${nomeBase} ${sobrenomeBase}`.trim()
    const matricula = row.ID || row.MATRICULA || row.Matricula || row.matricula || row.COD_ALUNO || row.cod_aluno || "---"
    const email = row.EMAIL || row.Email || row.email || "---"
    const cpf = row.CPF || row.Cpf || row.cpf || "---"
    const periodo = row.SERIE || row.Serie || row.serie || "---"
    const unidadeFisica = row.UNIDADE_FISICA || row.UnidadeFisica || row.unidade_fisica || "---"
    const curso = row.CURSO_NOME || row.CURSO || row.Curso || "---"
    const cursoInstituicao = row.CURSO_INSTITUICAO || "---"
    const telefone = row.TELEFONE || row.Telefone || row.telefone || "---"
    const local = row.CIDADE && row.PAIS ? `${row.CIDADE} / ${row.PAIS}` : row.CIDADE || row.PAIS || "---"
    return { nome: nomeCompleto, matricula, email, cpf, periodo, unidadeFisica, curso, cursoInstituicao, telefone, local }
  }

  const resolveTeacherRow = (row: any) => {
    const nomeBase = row.NOME || row.Nome || "Não Identificado"
    const sobrenomeBase = row.SOBRENOME || row.Sobrenome || ""
    const nomeCompleto = `${nomeBase} ${sobrenomeBase}`.trim()
    const docenteId = row.ID || row.Id || row.id || row.COD_DOCENTE || row.cod_docente || "---"
    const email = row.EMAIL || row.Email || row.email || "---"
    const cpf = row.CPF || row.Cpf || row.cpf || "---"
    const telefone = row.TELEFONE || row.Telefone || row.telefone || "---"
    const local = row.CIDADE && row.PAIS ? `${row.CIDADE} / ${row.PAIS}` : row.CIDADE || row.PAIS || "---"
    return { nome: nomeCompleto, docenteId, email, cpf, telefone, local }
  }

  const resolveClassRow = (row: any) => {
    const codigo = row.TURMA || row.Turma || row.turma || row.COD_TURMA || row.cod_turma || "---"
    const disciplina = row.NOME_DISCIPLINA || row.DISCIPLINA || row.disciplina || "---"
    const disciplinaCod = row.DISCIPLINA || "---"
    const curso = row.CURSO_NOME || row.CURSO || "---"
    const instituicao = row.CURSO_INSTITUICAO || "---"
    const periodo = row.PERIODO || row.Periodo || row.periodo || "---"
    const serie = row.SERIE || row.Serie || row.serie || "---"
    const modelagem = row.MODELAGEM || row.Modelagem || row.modelagem || "---"
    return { codigo, disciplina, disciplinaCod, curso, instituicao, periodo, serie, modelagem }
  }

  const resolveMatriculaRow = (row: any) => {
    const username = row.USUARIO || row.Usuario || row.usuario || "---"
    const turma = row.TURMA || row.Turma || row.turma || "---"
    
    // Resolve Nível: 1 -> Docente, 2 -> Aluno
    const rawNivel = row.NIVEL || row.Nivel || row.nivel || ""
    let nivel = "---"
    if (rawNivel === 1 || rawNivel === '1') {
      nivel = "Docente"
    } else if (rawNivel === 2 || rawNivel === '2') {
      nivel = "Aluno"
    } else if (rawNivel) {
      nivel = String(rawNivel)
    }

    const situacao = row.SITUACAO || row.Situacao || row.situacao || "---"
    const ativo = row.ATIVO === 1 || row.ATIVO === '1' || row.ATIVO === true || row.ATIVO === 'S' ? 'Ativo' : 'Inativo'
    const cpf = row.USUARIO_CPF || row.UsuarioCpf || "---"
    const nomeDisciplina = row.NOME_DISCIPLINA || row.NomeDisciplina || row.nome_disciplina || "---"
    
    // Resolve name
    const nomeBase = row.NOME || "Não Identificado"
    const sobrenomeBase = row.SOBRENOME || ""
    const nomeCompleto = `${nomeBase} ${sobrenomeBase}`.trim()
    
    return { username, turma, nivel, situacao, ativo, cpf, nomeDisciplina, nome: nomeCompleto }
  }

  // Load detailed disciplines in drawer
  const handleOpenDetail = async (item: any) => {
    setDrawerData([])
    setIsDrawerOpen(true)
    setDrawerLoading(true)

    try {
      if (activeTab === "discentes") {
        const student = resolveStudentRow(item)
        setDrawerTitle(student.nome)
        setDrawerSubtitle(`Matrícula: ${student.matricula} • Aluno EaD / Online`)
        const res = await getStudentDisciplines(student.matricula)
        if (res.success && res.data) {
          setDrawerData(res.data)
        } else {
          showToast(res.error || "Erro ao consultar disciplinas.", "error")
        }
      } else if (activeTab === "docentes") {
        const teacher = resolveTeacherRow(item)
        setDrawerTitle(teacher.nome)
        setDrawerSubtitle(`Cód. Docente: ${teacher.docenteId} • Corpo Docente`)
        const res = await getTeacherDisciplines(teacher.docenteId)
        if (res.success && res.data) {
          setDrawerData(res.data)
        } else {
          showToast(res.error || "Erro ao consultar disciplinas do professor.", "error")
        }
      }
    } catch (err: any) {
      showToast("Falha ao se conectar com o servidor.", "error")
    } finally {
      setDrawerLoading(false)
    }
  }

  return (
    <div className="space-y-6 relative">
      {/* Toast Warning banner */}
      {toast.type && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border text-white transition-all flex items-center gap-3 ${
          toast.type === "success" ? "bg-green-dark border-green-brand" : "bg-[#E53935] border-[#D32F2F]"
        }`}>
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
        <div>
          <h1 className="text-2xl font-extrabold text-navy tracking-tight flex items-center gap-2.5">
            <GraduationCap className="w-7 h-7 text-[#5E35B1]" /> Módulo Acadêmico (Lyceum)
          </h1>
          <p className="text-sm text-[#5F6775] mt-1">
            Consulta consolidada de discentes, docentes, turmas e matrículas integradas.
          </p>
        </div>
        
        {/* Connection status indicator */}
        <Badge className="bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] hover:bg-[#C8E6C9] py-1 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 self-start md:self-auto shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5" /> Lyceum Online
        </Badge>
      </div>

      {/* Interactive Tabs */}
      <div className="flex border-b border-gray-200 select-none overflow-x-auto">
        <button
          onClick={() => { setActiveTab("discentes"); setSearch(""); setPage(1); setHasSearched(false); setListData([]); }}
          className={`pb-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 focus:outline-none shrink-0 ${
            activeTab === "discentes"
              ? "border-[#5E35B1] text-[#5E35B1]"
              : "border-transparent text-[#5F6775] hover:text-navy hover:border-gray-300"
          }`}
        >
          <User className="w-4 h-4" /> Discentes (Alunos)
        </button>
        <button
          onClick={() => { setActiveTab("docentes"); setSearch(""); setPage(1); setHasSearched(false); setListData([]); }}
          className={`pb-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 focus:outline-none shrink-0 ${
            activeTab === "docentes"
              ? "border-[#5E35B1] text-[#5E35B1]"
              : "border-transparent text-[#5F6775] hover:text-navy hover:border-gray-300"
          }`}
        >
          <GraduationCap className="w-4 h-4" /> Docentes (Professores)
        </button>
        <button
          onClick={() => { setActiveTab("turmas"); setSearch(""); setPage(1); setHasSearched(false); setListData([]); }}
          className={`pb-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 focus:outline-none shrink-0 ${
            activeTab === "turmas"
              ? "border-[#5E35B1] text-[#5E35B1]"
              : "border-transparent text-[#5F6775] hover:text-navy hover:border-gray-300"
          }`}
        >
          <Layers className="w-4 h-4" /> Turmas (Disciplinas)
        </button>
        <button
          onClick={() => { setActiveTab("matriculas"); setSearch(""); setPage(1); setHasSearched(false); setListData([]); }}
          className={`pb-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 focus:outline-none shrink-0 ${
            activeTab === "matriculas"
              ? "border-[#5E35B1] text-[#5E35B1]"
              : "border-transparent text-[#5F6775] hover:text-navy hover:border-gray-300"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" /> Matrículas (Vínculos)
        </button>
      </div>

      {/* Filter and Search Card */}
      <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
        <CardContent className="p-5">
          <form onSubmit={handleSearchSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <Input 
                placeholder={`Pesquise na base do Lyceum por Nome, Matrícula ou código...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11 text-xs border-gray-300 focus:border-[#5E35B1] focus:ring-[#5E35B1] rounded-lg"
              />
              <Search className="w-4 h-4 text-[#9AA0AC] absolute left-3 top-3.5" />
            </div>
            <Button 
              type="submit" 
              className="bg-[#5E35B1] hover:bg-[#4E2A96] text-white font-semibold text-xs h-11 px-6 rounded-lg shadow-sm"
            >
              Consultar
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Main Table Listing */}
      <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="bg-[#F4F5F7] border-b border-gray-200 select-none">
                {activeTab === "discentes" && (
                  <>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left">Aluno / Discente</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left">Matrícula</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left">Curso / Instituição</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-center">Período</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left hidden lg:table-cell">Unidade Física</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left hidden md:table-cell">Contato</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-right">Disciplinas</TableHead>
                  </>
                )}
                {activeTab === "docentes" && (
                  <>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left">Docente / Professor</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left">Código Docente</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left hidden md:table-cell">Contato</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left hidden lg:table-cell">Localidade</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left hidden lg:table-cell">CPF</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-right">Encargo</TableHead>
                  </>
                )}
                {activeTab === "turmas" && (
                  <>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left">Código Turma</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left">Disciplina Vinculada</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left hidden md:table-cell">Curso / Unidade Ens.</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-center">Período / Série</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-right">Modelagem</TableHead>
                  </>
                )}
                {activeTab === "matriculas" && (
                  <>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left">Usuário / CPF</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left">Turma / Disciplina</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left">Nível</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-left hidden md:table-cell">Situação</TableHead>
                    <TableHead className="px-5 py-3.5 text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wider text-right">Status</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx} className="animate-pulse">
                    <TableCell colSpan={7} className="py-5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8.5 h-8.5 rounded-full bg-gray-200 shrink-0" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-4 bg-gray-200 rounded w-1/4" />
                          <div className="h-3 bg-gray-200 rounded w-1/6" />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : !hasSearched ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-20 px-5">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-4 select-none">
                      <div className="w-16 h-16 rounded-full bg-[#5E35B1]/10 text-[#5E35B1] flex items-center justify-center shadow-inner">
                        <Search className="w-8 h-8 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-navy">Pesquisa no Lyceum</h3>
                        <p className="text-xs text-[#5F6775] leading-relaxed">
                          Digite um termo de pesquisa e clique em <strong className="text-[#5E35B1]">"Consultar"</strong> para pesquisar registros no Lyceum.
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : listData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-[#9AA0AC] italic">
                    Nenhum registro encontrado no Lyceum. Ajuste a busca acima.
                  </TableCell>
                </TableRow>
              ) : (
                listData.map((row, idx) => {
                  if (activeTab === "discentes") {
                    const student = resolveStudentRow(row)
                    return (
                      <TableRow key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <TableCell className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8.5 h-8.5 rounded-full bg-[#5E35B1]/10 text-[#5E35B1] flex items-center justify-center font-bold text-xs shrink-0 select-none">
                              {student.nome.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-navy text-xs leading-none">{student.nome}</p>
                              <span className="text-[10px] text-[#9AA0AC] mt-1 block font-mono">{student.cpf}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-3.5 text-xs font-bold font-mono text-navy">{student.matricula}</TableCell>
                        <TableCell className="px-5 py-3.5 text-xs text-[#5F6775]">
                          <p className="font-semibold text-navy text-xs">{student.curso}</p>
                          <span className="text-[10px] text-[#9AA0AC] block font-mono">{student.cursoInstituicao}</span>
                        </TableCell>
                        <TableCell className="px-5 py-3.5 text-xs text-navy font-bold text-center">{student.periodo}</TableCell>
                        <TableCell className="px-5 py-3.5 text-xs text-[#5F6775] hidden lg:table-cell">{student.unidadeFisica}</TableCell>
                        <TableCell className="px-5 py-3.5 text-xs text-[#5F6775] hidden md:table-cell">
                          <p className="font-semibold text-navy text-xs">{student.email}</p>
                          <span className="text-[10px] text-[#9AA0AC] block font-mono">{student.telefone}</span>
                        </TableCell>
                        <TableCell className="px-5 py-3.5 text-right">
                          <Button 
                            onClick={() => handleOpenDetail(row)}
                            variant="ghost" 
                            size="sm" 
                            className="text-xs text-[#5E35B1] hover:bg-[#5E35B1]/10 hover:text-[#5E35B1] font-semibold gap-1.5 h-8 rounded-lg"
                          >
                            <BookOpen className="w-3.5 h-3.5" /> Ver Grade
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  } else if (activeTab === "docentes") {
                    const teacher = resolveTeacherRow(row)
                    return (
                      <TableRow key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <TableCell className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8.5 h-8.5 rounded-full bg-[#0097A7]/10 text-[#0097A7] flex items-center justify-center font-bold text-xs shrink-0 select-none">
                              {teacher.nome.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-navy text-xs leading-none">{teacher.nome}</p>
                              <span className="text-[10px] text-[#9AA0AC] mt-1 block font-mono">Prof. EA / Presencial</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-3.5 text-xs font-bold font-mono text-navy">{teacher.docenteId}</TableCell>
                        <TableCell className="px-5 py-3.5 text-xs text-[#5F6775] hidden md:table-cell">
                          <p className="font-semibold text-navy text-xs">{teacher.email}</p>
                          <span className="text-[10px] text-[#9AA0AC] block font-mono">{teacher.telefone}</span>
                        </TableCell>
                        <TableCell className="px-5 py-3.5 text-xs text-[#5F6775] hidden lg:table-cell">{teacher.localidade || teacher.local}</TableCell>
                        <TableCell className="px-5 py-3.5 text-xs text-[#5F6775] hidden lg:table-cell font-mono">{teacher.cpf}</TableCell>
                        <TableCell className="px-5 py-3.5 text-right">
                          <Button 
                            onClick={() => handleOpenDetail(row)}
                            variant="ghost" 
                            size="sm" 
                            className="text-xs text-[#0097A7] hover:bg-[#0097A7]/10 hover:text-[#0097A7] font-semibold gap-1.5 h-8 rounded-lg"
                          >
                            <BookOpen className="w-3.5 h-3.5" /> Ver Turmas
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  } else if (activeTab === "turmas") {
                    const cRow = resolveClassRow(row)
                    return (
                      <TableRow key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <TableCell className="px-5 py-3.5 text-xs font-bold text-[#5E35B1] font-mono">{cRow.codigo}</TableCell>
                        <TableCell className="px-5 py-3.5">
                          <p className="font-bold text-navy text-xs">{cRow.disciplina}</p>
                          <span className="text-[10px] text-[#9AA0AC] block font-mono mt-0.5">ID: {cRow.disciplinaCod}</span>
                        </TableCell>
                        <TableCell className="px-5 py-3.5 text-xs text-[#5F6775] hidden md:table-cell">
                          <p className="font-semibold text-navy text-xs">{cRow.curso}</p>
                          <span className="text-[10px] text-[#9AA0AC] block font-mono">{cRow.instituicao}</span>
                        </TableCell>
                        <TableCell className="px-5 py-3.5 text-xs text-navy font-semibold text-center">
                          <p className="font-bold text-navy text-xs">{cRow.periodo}</p>
                          <span className="text-[10px] text-[#9AA0AC] block font-mono">Série: {cRow.serie}</span>
                        </TableCell>
                        <TableCell className="px-5 py-3.5 text-xs text-right font-medium text-[#5F6775]">{cRow.modelagem}</TableCell>
                      </TableRow>
                    )
                  } else {
                    const mRow = resolveMatriculaRow(row)
                    return (
                      <TableRow key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <TableCell className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8.5 h-8.5 rounded-full bg-[#5E35B1]/10 text-[#5E35B1] flex items-center justify-center font-bold text-xs shrink-0 select-none">
                              {mRow.nome ? mRow.nome.slice(0, 2).toUpperCase() : "---"}
                            </div>
                            <div>
                              <p className="font-semibold text-navy text-xs leading-none">{mRow.nome}</p>
                              <span className="text-[10px] text-[#9AA0AC] mt-1.5 block font-mono">
                                Usuário: <span className="font-bold text-navy">{mRow.username}</span> • CPF: {mRow.cpf}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-3.5 text-xs">
                          <p className="font-bold text-[#5E35B1] font-mono leading-none">{mRow.turma}</p>
                          <span className="text-[10px] text-[#9AA0AC] block mt-1 leading-tight">{mRow.nomeDisciplina}</span>
                        </TableCell>
                        <TableCell className="px-5 py-3.5 text-xs text-navy font-bold">{mRow.nivel}</TableCell>
                        <TableCell className="px-5 py-3.5 text-xs text-[#5F6775] hidden md:table-cell">{mRow.situacao}</TableCell>
                        <TableCell className="px-5 py-3.5 text-right">
                          <Badge className={
                            mRow.ativo === 'Ativo'
                              ? "bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#C8E6C9] border border-[#A5D6A7]"
                              : "bg-[#FFEBEE] text-[#C62828] hover:bg-[#FFCDD2] border border-[#EF9A9A]"
                          }>
                            {mRow.ativo}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  }
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Dynamic Pagination Bar */}
        {meta.totalPages > 1 && (
          <div className="bg-[#F4F5F7] border-t border-gray-200 px-5 py-3.5 flex items-center justify-between select-none">
            <p className="text-xs text-[#5F6775]">
              Mostrando página <span className="font-semibold">{meta.page}</span> de <span className="font-semibold">{meta.totalPages}</span> ({meta.total} registros total)
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page <= 1 || loading}
                onClick={() => setPage(meta.page - 1)}
                className="h-8.5 px-3 border-gray-300 text-navy text-xs rounded-lg"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page >= meta.totalPages || loading}
                onClick={() => setPage(meta.page + 1)}
                className="h-8.5 px-3 border-gray-300 text-navy text-xs rounded-lg"
              >
                Próximo <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* --- PREMIUM SLIDE-OVER DRAWER FOR LINKED DISCIPLINES --- */}
      <div className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ease-in-out ${
        isDrawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}>
        {/* Backdrop Backdrop-blur */}
        <div 
          onClick={() => setIsDrawerOpen(false)}
          className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        />

        {/* Right side slide-over panel */}
        <div className={`relative w-full max-w-lg bg-white shadow-2xl h-full flex flex-col transition-transform duration-300 ease-in-out p-6 border-l border-gray-100 rounded-l-2xl ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}>
          {/* Header */}
          <div className="flex items-start justify-between border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-navy leading-6 flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-[#5E35B1]" /> Disciplinas Vinculadas
              </h3>
              <p className="text-xs font-semibold text-[#5F6775] mt-1.5 select-none">
                {drawerTitle}
              </p>
              <p className="text-[10px] text-[#9AA0AC] font-mono mt-0.5 uppercase tracking-wider select-none">
                {drawerSubtitle}
              </p>
            </div>
            <button 
              onClick={() => setIsDrawerOpen(false)}
              className="text-[#9AA0AC] hover:text-[#5F6775] p-1.5 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Linked listing contents */}
          <div className="flex-1 overflow-y-auto py-5 space-y-3">
            {drawerLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="p-4 bg-[#F4F5F7]/60 border border-gray-100 rounded-xl space-y-2 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
              ))
            ) : drawerData.length === 0 ? (
              <div className="text-center py-12 text-[#9AA0AC] italic text-xs">
                Nenhuma disciplina vinculada encontrada para este perfil no Lyceum.
              </div>
            ) : (
              drawerData.map((item, idx) => {
                // Resolvers to dynamically map discipline view fields in upper/lowercase
                const codDisc = item.COD_DISCIPLINA || item.CodDisciplina || item.cod_disciplina || item.DISCIPLINA || "---"
                const nomeDisc = item.NOME_DISCIPLINA || item.NomeDisciplina || item.nome_disciplina || item.DISCIPLINA || "Disciplina Não Nomeada"
                const codTurma = item.TURMA || item.Turma || item.turma || item.COD_TURMA || "---"
                const periodo = item.PERIODO || item.Periodo || item.periodo || item.SEMESTRE || "---"
                
                return (
                  <div 
                    key={idx} 
                    className="p-4 rounded-xl border border-gray-200/80 bg-white shadow-xs hover:border-[#5E35B1]/30 transition-all flex items-start gap-3.5 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#5E35B1]/10 text-[#5E35B1] flex items-center justify-center font-bold text-xs shrink-0 select-none group-hover:scale-105 transition-transform">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-navy text-xs leading-snug">{nomeDisc}</h4>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[#5F6775]">
                        <span className="font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-semibold">Cód: {codDisc}</span>
                        <span>•</span>
                        <span>Turma: <strong className="text-navy">{codTurma}</strong></span>
                        <span>•</span>
                        <span>Período: <strong className="text-navy">{periodo}</strong></span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer of Drawer */}
          <div className="border-t border-gray-100 pt-4 flex justify-end">
            <Button 
              onClick={() => setIsDrawerOpen(false)}
              className="bg-navy hover:bg-navy-light text-white text-xs font-semibold px-5 h-9 rounded-lg"
            >
              Fechar Painel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
