"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Box, LogOut, ShieldCheck, Users, ChevronLeft, ChevronRight } from "lucide-react"

interface SidebarClientProps {
  session: any
  modules: any[]
  initials: string
}

export function SidebarClient({ session, modules, initials }: SidebarClientProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isReportsOpen, setIsReportsOpen] = useState(false)
  const [isProgressOpen, setIsProgressOpen] = useState(false)
  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [justCollapsed, setJustCollapsed] = useState(false)
  // collapsedUIState atrasa a troca de accordion → floating até após a animação terminar,
  // evitando que o floating seja montado enquanto o cursor ainda está sobre a sidebar
  const [collapsedUIState, setCollapsedUIState] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved === "true") {
      setIsCollapsed(true)
      setCollapsedUIState(true)
    }
    if (pathname.startsWith('/relatorios')) {
      setIsReportsOpen(true)
      if (pathname.startsWith('/relatorios/progresso')) {
        setIsProgressOpen(true)
      }
      if (pathname.startsWith('/relatorios/notas')) {
        setIsNotesOpen(true)
      }
    }
  }, [pathname])

  const toggleSidebar = () => {
    setIsTransitioning(true)
    const nextState = !isCollapsed
    setIsCollapsed(nextState)
    localStorage.setItem("sidebar-collapsed", nextState ? "true" : "false")
    
    if (nextState) {
      // Recolhendo: fecha submenu imediatamente para evitar ghost hover
      setIsReportsOpen(false)
      setJustCollapsed(true)
      // collapsedUIState só ativa DEPOIS da animação (400ms)
      // para evitar que o floating seja montado com o cursor ainda sobre a sidebar
      setTimeout(() => {
        setCollapsedUIState(true)
      }, 400)
    } else {
      // Expandindo: reverte collapsedUIState imediatamente (o accordion pode aparecer logo)
      setCollapsedUIState(false)
      setJustCollapsed(false)
    }

    // 400ms cobre a animação CSS (300ms) + swap de render do React
    setTimeout(() => {
      setIsTransitioning(false)
    }, 400)
  }

  // Se não estiver montado no cliente, renderiza o estado padrão (expandido) 
  // para evitar divergências visuais (mismatch de hidratação)
  const collapsedState = mounted ? isCollapsed : false

  return (
    <aside 
      onMouseEnter={(e) => {
        if (justCollapsed && !isTransitioning && e.clientX <= 72) {
          setJustCollapsed(false)
        }
      }}
      onMouseMove={(e) => {
        if (justCollapsed && !isTransitioning && e.clientX <= 72) {
          setJustCollapsed(false)
        }
      }}
      className={`bg-navy flex flex-col h-full shadow-2xl z-30 transition-all duration-300 ease-in-out relative shrink-0 ${collapsedState ? "w-[72px] overflow-visible" : "w-[208px]"}`}
    >
      {/* Botão de Toggle Flutuante */}
      {mounted && (
        <button 
          onClick={toggleSidebar}
          className="absolute top-5 -right-3 w-6 h-6 rounded-full bg-green-brand border-2 border-navy text-navy flex items-center justify-center shadow-lg hover:scale-110 hover:bg-green-400 active:scale-95 transition-all z-40 focus:outline-none cursor-pointer"
          title={collapsedState ? "Expandir menu" : "Recolher menu"}
        >
          {collapsedState ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      )}

      {/* Header com Logotipo */}
      <div className={`h-16 shrink-0 flex items-center gap-3 border-b border-white/10 select-none transition-all duration-300 ${collapsedState ? "px-2 justify-center" : "px-4"}`}>
        <div className="w-7 h-7 rounded-[7px] bg-green-brand flex items-center justify-center shrink-0 shadow-inner">
          <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
            <circle cx="8.5" cy="8.5" r="3" fill="#1C2B4A" opacity=".9"/>
            <circle cx="2.5" cy="2.5" r="1.5" fill="#1C2B4A" opacity=".55"/>
            <circle cx="14.5" cy="2.5" r="1.5" fill="#1C2B4A" opacity=".55"/>
            <circle cx="2.5" cy="14.5" r="1.5" fill="#1C2B4A" opacity=".55"/>
            <circle cx="14.5" cy="14.5" r="1.5" fill="#1C2B4A" opacity=".55"/>
            <line x1="5.5" y1="5.5" x2="2.5" y2="2.5" stroke="#1C2B4A" strokeWidth="1.2" opacity=".4"/>
            <line x1="11.5" y1="5.5" x2="14.5" y2="2.5" stroke="#1C2B4A" strokeWidth="1.2" opacity=".4"/>
            <line x1="5.5" y1="11.5" x2="2.5" y2="14.5" stroke="#1C2B4A" strokeWidth="1.2" opacity=".4"/>
            <line x1="11.5" y1="11.5" x2="14.5" y2="14.5" stroke="#1C2B4A" strokeWidth="1.2" opacity=".4"/>
          </svg>
        </div>
        <div className={`transition-all duration-300 ease-in-out overflow-hidden flex flex-col ${collapsedState ? "w-0 h-0 opacity-0 pointer-events-none absolute" : "w-auto opacity-100 relative"}`}>
          <h1 className="text-white font-extrabold text-[15px] tracking-tight whitespace-nowrap">Nexus<span className="text-green-brand font-normal">Hub</span></h1>
          <p className="text-[8px] font-semibold text-white/35 uppercase tracking-widest font-mono whitespace-nowrap">NEXUS APPLICATION</p>
        </div>
      </div>

      {/* Perfil do Usuário */}
      {session?.user && (
        <div className={`transition-all duration-300 select-none flex items-center shrink-0 border ${
          collapsedState 
            ? "mt-4 mx-2 p-1 bg-white/0 border-white/0 justify-center" 
            : "p-3 mt-4 bg-white/5 border-white/10 mx-4 rounded-lg"
        }`}>
          <div className="w-10 h-10 rounded-full bg-green-brand text-navy flex items-center justify-center font-bold text-sm shrink-0 shadow-md border border-green-brand/20 transition-all duration-300">
            {initials}
          </div>
          <div className={`flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
            collapsedState ? "max-w-0 opacity-0 pointer-events-none ml-0" : "max-w-[165px] opacity-100 ml-3"
          }`}>
            <span className="text-white text-sm font-medium tracking-tight truncate whitespace-nowrap">{session.user.name}</span>
            <span className="text-green-dark text-[10px] font-bold uppercase tracking-wider mt-0.5 truncate whitespace-nowrap">
              {/* @ts-ignore */}
              {session.user.groups?.length > 0 ? session.user.groups.join(', ') : 'Sem Grupo'}
            </span>
          </div>
        </div>
      )}

      {/* Links de Navegação */}
      <nav className={`flex-1 px-4 py-6 space-y-2 ${collapsedState ? "overflow-visible" : "overflow-y-auto overflow-x-hidden"}`}>
        {/* Separador/Título da Seção Módulos */}
        <div className={`relative select-none transition-all duration-300 ${collapsedState ? "my-4 px-1" : "px-3 mb-2 mt-4"}`}>
          <div className={`border-t border-white/10 w-full transition-opacity duration-300 ${collapsedState ? "opacity-100" : "opacity-0 absolute h-0 pointer-events-none"}`} />
          <span className={`text-[9px] font-bold text-white/30 uppercase tracking-widest block transition-all duration-300 ease-in-out overflow-hidden ${collapsedState ? "max-h-0 opacity-0 pointer-events-none" : "max-h-4 opacity-100"}`}>
            Módulos
          </span>
        </div>

        {/* Dashboard Link */}
        <Link 
          href="/" 
          className={`flex items-center rounded-lg transition-all duration-300 ease-in-out group relative w-full h-10 px-2.5 justify-start focus:outline-none border-l-2 ${
            pathname === '/'
              ? 'bg-[rgba(45,206,108,0.12)] text-white font-semibold border-green-brand'
              : 'text-white/50 hover:bg-navy-light hover:text-white border-transparent'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 shrink-0 transition-transform duration-300 group-hover:scale-110" />
          <span className={`text-[12px] font-medium whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ${collapsedState ? "max-w-0 opacity-0 pointer-events-none ml-0" : "max-w-[180px] opacity-100 ml-3"}`}>
            Dashboard
          </span>

          {/* Balão Tooltip Lateral */}
          {collapsedState && (
            <span className={`absolute left-[48px] top-1/2 -translate-y-1/2 ml-2 bg-navy border border-white/10 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-md shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 pointer-events-none select-none after:content-[''] after:absolute after:right-full after:top-1/2 after:-translate-y-1/2 after:border-4 after:border-transparent after:border-r-navy ${
              isTransitioning || justCollapsed ? "!opacity-0 !invisible !pointer-events-none" : ""
            }`}>
              Dashboard
            </span>
          )}
        </Link>

        {/* Módulos do Usuário */}
        {modules.map((sys) => {
          const isActive = pathname.startsWith(sys.pathUrl) || (sys.name === 'AVA Reports' && pathname.startsWith('/relatorios'))
          
          if (sys.name === 'AVA Reports') {
            return (
              <div key={sys.id} className="group relative w-full">
                <button 
                  onClick={() => {
                    if (!collapsedState) {
                      setIsReportsOpen(!isReportsOpen)
                    }
                  }}
              className={`flex items-center justify-between rounded-lg transition-all duration-300 ease-in-out cursor-pointer w-full h-10 px-2.5 focus:outline-none border-l-2 ${
                isActive
                  ? 'bg-[rgba(45,206,108,0.12)] text-white font-medium border-green-brand'
                  : 'text-white/50 hover:bg-navy-light hover:text-white border-transparent'
              }`}
                >
                  <div className="flex items-center">
                    <Box className="w-5 h-5 shrink-0 transition-transform duration-300 group-hover:scale-110" />
                    <span className={`text-[12px] font-medium whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ${collapsedState ? "max-w-0 opacity-0 pointer-events-none ml-0" : "max-w-[180px] opacity-100 ml-3"}`}>
                      {sys.name}
                    </span>
                  </div>
                  <ChevronRight 
                    className={`w-4 h-4 transition-all duration-300 opacity-50 shrink-0 ${
                      collapsedState ? "w-0 opacity-0 pointer-events-none" : "w-4 opacity-50"
                    } ${isReportsOpen && !collapsedState ? "rotate-90" : ""}`} 
                  />
                </button>
                
                {/* Submenu Area - Dual rendering based on collapsedUIState com delay */}
                {collapsedUIState ? (
                  /* Collapsed state: Floating submenu on hover */
                  <div className={`absolute left-full top-0 ml-3 w-64 bg-navy border border-white/10 shadow-2xl rounded-lg py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none group-hover:pointer-events-auto before:content-[''] before:absolute before:-left-16 before:-top-8 before:-bottom-8 before:w-16 ${
                    isTransitioning || justCollapsed ? "!opacity-0 !invisible !pointer-events-none" : ""
                  }`}>
                    <div className="px-4 py-1.5 border-b border-white/5 text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2 select-none">
                      {sys.name}
                    </div>
                    <div className="px-2 py-1 space-y-1">
                      <div className="px-3 py-1 text-[9px] font-bold text-white/30 uppercase tracking-widest mt-1">
                        Progresso
                      </div>
                      <Link href="/relatorios/progresso" className={`block text-[11px] hover:text-white px-3 py-2 rounded-md transition-colors ${pathname === '/relatorios/progresso' ? 'bg-navy-light text-green-brand font-semibold' : 'text-white/60 hover:bg-navy-light/40'}`}>
                        EaD
                      </Link>
                      <Link href="/relatorios/progresso/uni" className={`block text-[11px] hover:text-white px-3 py-2 rounded-md transition-colors ${pathname === '/relatorios/progresso/uni' ? 'bg-navy-light text-green-brand font-semibold' : 'text-white/60 hover:bg-navy-light/40'}`}>
                        Online Uni
                      </Link>
                      <Link href="/relatorios/progresso/uniego" className={`block text-[11px] hover:text-white px-3 py-2 rounded-md transition-colors ${pathname === '/relatorios/progresso/uniego' ? 'bg-navy-light text-green-brand font-semibold' : 'text-white/60 hover:bg-navy-light/40'}`}>
                        Online UNIEGO
                      </Link>
                      <Link href="/relatorios/progresso/raizes" className={`block text-[11px] hover:text-white px-3 py-2 rounded-md transition-colors ${pathname === '/relatorios/progresso/raizes' ? 'bg-navy-light text-green-brand font-semibold' : 'text-white/60 hover:bg-navy-light/40'}`}>
                        Online Raízes
                      </Link>
                      <Link href="/relatorios/progresso/eefn" className={`block text-[11px] hover:text-white px-3 py-2 rounded-md transition-colors ${pathname === '/relatorios/progresso/eefn' ? 'bg-navy-light text-green-brand font-semibold' : 'text-white/60 hover:bg-navy-light/40'}`}>
                        Online EEFN
                      </Link>
                      
                      <div className="px-3 py-1 text-[9px] font-bold text-white/30 uppercase tracking-widest mt-2">
                        Notas
                      </div>
                      <Link href="/relatorios/notas" className={`block text-[11px] hover:text-white px-3 py-2 rounded-md transition-colors ${pathname === '/relatorios/notas' ? 'bg-navy-light text-green-brand font-semibold' : 'text-white/60 hover:bg-navy-light/40'}`}>
                        EaD
                      </Link>
                      <Link href="/relatorios/notas/uni" className={`block text-[11px] hover:text-white px-3 py-2 rounded-md transition-colors ${pathname === '/relatorios/notas/uni' ? 'bg-navy-light text-green-brand font-semibold' : 'text-white/60 hover:bg-navy-light/40'}`}>
                        Online Uni
                      </Link>
                      <Link href="/relatorios/notas/uniego" className={`block text-[11px] hover:text-white px-3 py-2 rounded-md transition-colors ${pathname === '/relatorios/notas/uniego' ? 'bg-navy-light text-green-brand font-semibold' : 'text-white/60 hover:bg-navy-light/40'}`}>
                        Online UNIEGO
                      </Link>
                      <Link href="/relatorios/notas/raizes" className={`block text-[11px] hover:text-white px-3 py-2 rounded-md transition-colors ${pathname === '/relatorios/notas/raizes' ? 'bg-navy-light text-green-brand font-semibold' : 'text-white/60 hover:bg-navy-light/40'}`}>
                        Online Raízes
                      </Link>
                      <Link href="/relatorios/notas/eefn" className={`block text-[11px] hover:text-white px-3 py-2 rounded-md transition-colors ${pathname === '/relatorios/notas/eefn' ? 'bg-navy-light text-green-brand font-semibold' : 'text-white/60 hover:bg-navy-light/40'}`}>
                        Online EEFN
                      </Link>
                    </div>
                  </div>
                ) : (
                  /* Expanded state: Accordion sub-list with smooth height/opacity transition */
                  <div 
                    className={`pl-11 pr-3 space-y-1 relative before:content-[''] before:absolute before:left-5 before:top-0 before:bottom-2 before:w-[1px] before:bg-white/10 overflow-hidden transition-all duration-300 ease-in-out ${
                      isReportsOpen && !isTransitioning ? "max-h-[500px] opacity-100 py-2" : "max-h-0 opacity-0 py-0 pointer-events-none"
                    }`}
                  >
                    {/* Grupo: Progresso */}
                    <div className="group/progress relative w-full">
                      <button 
                        onClick={(e) => { e.preventDefault(); setIsProgressOpen(!isProgressOpen); }}
                        className={`flex items-center justify-between rounded-md transition-all duration-300 ease-in-out cursor-pointer w-full h-8 px-2 focus:outline-none ${
                          pathname.startsWith('/relatorios/progresso')
                            ? 'text-white font-medium bg-white/5'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span className="text-[11px]">Progresso</span>
                        <ChevronRight className={`w-3.5 h-3.5 transition-all duration-300 opacity-50 ${isProgressOpen ? "rotate-90" : ""}`} />
                      </button>
                      
                      <div className={`pl-4 space-y-0.5 relative before:content-[''] before:absolute before:left-3 before:top-1 before:bottom-2 before:w-[1px] before:bg-white/5 overflow-hidden transition-all duration-300 ease-in-out ${
                        isProgressOpen ? "max-h-60 opacity-100 py-1" : "max-h-0 opacity-0 py-0 pointer-events-none"
                      }`}>
                        <Link href="/relatorios/progresso" className={`block text-[10px] hover:text-white py-1.5 px-2 rounded-md transition-colors ${pathname === '/relatorios/progresso' ? 'text-green-brand font-medium bg-navy-light' : 'text-white/40 hover:bg-navy-light/40'}`}>EaD</Link>
                        <Link href="/relatorios/progresso/uni" className={`block text-[10px] hover:text-white py-1.5 px-2 rounded-md transition-colors ${pathname === '/relatorios/progresso/uni' ? 'text-green-brand font-medium bg-navy-light' : 'text-white/40 hover:bg-navy-light/40'}`}>Online Uni</Link>
                        <Link href="/relatorios/progresso/uniego" className={`block text-[10px] hover:text-white py-1.5 px-2 rounded-md transition-colors ${pathname === '/relatorios/progresso/uniego' ? 'text-green-brand font-medium bg-navy-light' : 'text-white/40 hover:bg-navy-light/40'}`}>Online UNIEGO</Link>
                        <Link href="/relatorios/progresso/raizes" className={`block text-[10px] hover:text-white py-1.5 px-2 rounded-md transition-colors ${pathname === '/relatorios/progresso/raizes' ? 'text-green-brand font-medium bg-navy-light' : 'text-white/40 hover:bg-navy-light/40'}`}>Online Raízes</Link>
                        <Link href="/relatorios/progresso/eefn" className={`block text-[10px] hover:text-white py-1.5 px-2 rounded-md transition-colors ${pathname === '/relatorios/progresso/eefn' ? 'text-green-brand font-medium bg-navy-light' : 'text-white/40 hover:bg-navy-light/40'}`}>Online EEFN</Link>
                      </div>
                    </div>

                    {/* Grupo: Notas */}
                    <div className="group/notes relative w-full mt-1">
                      <button 
                        onClick={(e) => { e.preventDefault(); setIsNotesOpen(!isNotesOpen); }}
                        className={`flex items-center justify-between rounded-md transition-all duration-300 ease-in-out cursor-pointer w-full h-8 px-2 focus:outline-none ${
                          pathname.startsWith('/relatorios/notas')
                            ? 'text-white font-medium bg-white/5'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span className="text-[11px]">Notas</span>
                        <ChevronRight className={`w-3.5 h-3.5 transition-all duration-300 opacity-50 ${isNotesOpen ? "rotate-90" : ""}`} />
                      </button>
                      
                      <div className={`pl-4 space-y-0.5 relative before:content-[''] before:absolute before:left-3 before:top-1 before:bottom-2 before:w-[1px] before:bg-white/5 overflow-hidden transition-all duration-300 ease-in-out ${
                        isNotesOpen ? "max-h-60 opacity-100 py-1" : "max-h-0 opacity-0 py-0 pointer-events-none"
                      }`}>
                        <Link href="/relatorios/notas" className={`block text-[10px] hover:text-white py-1.5 px-2 rounded-md transition-colors ${pathname === '/relatorios/notas' ? 'text-green-brand font-medium bg-navy-light' : 'text-white/40 hover:bg-navy-light/40'}`}>EaD</Link>
                        <Link href="/relatorios/notas/uni" className={`block text-[10px] hover:text-white py-1.5 px-2 rounded-md transition-colors ${pathname === '/relatorios/notas/uni' ? 'text-green-brand font-medium bg-navy-light' : 'text-white/40 hover:bg-navy-light/40'}`}>Online Uni</Link>
                        <Link href="/relatorios/notas/uniego" className={`block text-[10px] hover:text-white py-1.5 px-2 rounded-md transition-colors ${pathname === '/relatorios/notas/uniego' ? 'text-green-brand font-medium bg-navy-light' : 'text-white/40 hover:bg-navy-light/40'}`}>Online UNIEGO</Link>
                        <Link href="/relatorios/notas/raizes" className={`block text-[10px] hover:text-white py-1.5 px-2 rounded-md transition-colors ${pathname === '/relatorios/notas/raizes' ? 'text-green-brand font-medium bg-navy-light' : 'text-white/40 hover:bg-navy-light/40'}`}>Online Raízes</Link>
                        <Link href="/relatorios/notas/eefn" className={`block text-[10px] hover:text-white py-1.5 px-2 rounded-md transition-colors ${pathname === '/relatorios/notas/eefn' ? 'text-green-brand font-medium bg-navy-light' : 'text-white/40 hover:bg-navy-light/40'}`}>Online EEFN</Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          }

          // Módulos normais sem filhos
          return (
            <Link 
              key={sys.id} 
              href={sys.pathUrl} 
              className={`flex items-center rounded-lg transition-all duration-300 ease-in-out group relative w-full h-10 px-2.5 justify-start focus:outline-none border-l-2 ${
                isActive
                  ? 'bg-[rgba(45,206,108,0.12)] text-white font-semibold border-green-brand'
                  : 'text-white/50 hover:bg-navy-light hover:text-white border-transparent'
              }`}
            >
              <Box className="w-5 h-5 shrink-0 transition-transform duration-300 group-hover:scale-110" />
              <span className={`text-[12px] font-medium whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ${collapsedState ? "max-w-0 opacity-0 pointer-events-none ml-0" : "max-w-[180px] opacity-100 ml-3"}`}>
                {sys.name}
              </span>

              {/* Balão Tooltip Lateral */}
              {collapsedState && (
                <span className={`absolute left-[48px] top-1/2 -translate-y-1/2 ml-2 bg-navy border border-white/10 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-md shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 pointer-events-none select-none after:content-[''] after:absolute after:right-full after:top-1/2 after:-translate-y-1/2 after:border-4 after:border-transparent after:border-r-navy ${
                  isTransitioning || justCollapsed ? "!opacity-0 !invisible !pointer-events-none" : ""
                }`}>
                  {sys.name}
                </span>
              )}
            </Link>
          )
        })}

        {/* Administração do SuperAdmin */}
        {/* @ts-ignore */}
        {session?.user?.isSuperAdmin && (
          <>
            {/* Separador/Título da Seção Administração */}
            <div className={`relative select-none transition-all duration-300 ${collapsedState ? "my-4 px-1" : "px-3 mb-2 mt-6"}`}>
              <div className={`border-t border-white/10 w-full transition-opacity duration-300 ${collapsedState ? "opacity-100" : "opacity-0 absolute h-0 pointer-events-none"}`} />
              <span className={`text-[9px] font-bold text-white/30 uppercase tracking-widest block transition-all duration-300 ease-in-out overflow-hidden ${collapsedState ? "max-h-0 opacity-0 pointer-events-none" : "max-h-4 opacity-100"}`}>
                Administração
              </span>
            </div>
            
            <Link 
              href="/admin/users" 
              className={`flex items-center rounded-lg transition-all duration-300 ease-in-out group relative w-full h-10 px-2.5 justify-start focus:outline-none border-l-2 ${
                pathname.startsWith('/admin/users')
                  ? 'bg-[rgba(45,206,108,0.12)] text-white font-semibold border-green-brand'
                  : 'text-white/50 hover:bg-navy-light hover:text-white border-transparent'
              }`}
            >
              <Users className="w-5 h-5 shrink-0 transition-transform duration-300 group-hover:scale-110" />
              <span className={`text-[12px] font-medium whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ${collapsedState ? "max-w-0 opacity-0 pointer-events-none ml-0" : "max-w-[180px] opacity-100 ml-3"}`}>
                Usuários e Acessos
              </span>

              {/* Balão Tooltip Lateral */}
              {collapsedState && (
                <span className={`absolute left-[48px] top-1/2 -translate-y-1/2 ml-2 bg-navy border border-white/10 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-md shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 pointer-events-none select-none after:content-[''] after:absolute after:right-full after:top-1/2 after:-translate-y-1/2 after:border-4 after:border-transparent after:border-r-navy ${
                  isTransitioning || justCollapsed ? "!opacity-0 !invisible !pointer-events-none" : ""
                }`}>
                  Usuários e Acessos
                </span>
              )}
            </Link>
            
            <Link 
              href="/admin/groups" 
              className={`flex items-center rounded-lg transition-all duration-300 ease-in-out group relative w-full h-10 px-2.5 justify-start focus:outline-none border-l-2 ${
                pathname.startsWith('/admin/groups')
                  ? 'bg-[rgba(45,206,108,0.12)] text-white font-semibold border-green-brand'
                  : 'text-white/50 hover:bg-navy-light hover:text-white border-transparent'
              }`}
            >
              <ShieldCheck className="w-5 h-5 shrink-0 transition-transform duration-300 group-hover:scale-110" />
              <span className={`text-[12px] font-medium whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ${collapsedState ? "max-w-0 opacity-0 pointer-events-none ml-0" : "max-w-[180px] opacity-100 ml-3"}`}>
                Grupos e Permissões
              </span>

              {/* Balão Tooltip Lateral */}
              {collapsedState && (
                <span className={`absolute left-[48px] top-1/2 -translate-y-1/2 ml-2 bg-navy border border-white/10 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-md shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 pointer-events-none select-none after:content-[''] after:absolute after:right-full after:top-1/2 after:-translate-y-1/2 after:border-4 after:border-transparent after:border-r-navy ${
                  isTransitioning || justCollapsed ? "!opacity-0 !invisible !pointer-events-none" : ""
                }`}>
                  Grupos e Permissões
                </span>
              )}
            </Link>
          </>
        )}
      </nav>

      {/* Rodapé com botão Sair */}
      <div className={`border-t border-white/10 transition-all duration-300 p-4 w-full shrink-0 ${collapsedState ? "px-2" : ""}`}>
        <div className="group relative flex justify-center w-full">
          <button 
            onClick={() => window.location.href = "/api/auth/signout"}
            className="flex items-center rounded-lg text-white/50 hover:text-white hover:bg-navy-light transition-all duration-300 ease-in-out cursor-pointer w-full h-10 px-2.5 justify-start focus:outline-none"
          >
            <LogOut className="w-5 h-5 shrink-0 text-red-400/80 hover:text-red-400 transition-transform duration-300 group-hover:scale-110" />
            <span className={`text-[12px] font-medium whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ${collapsedState ? "max-w-0 opacity-0 pointer-events-none ml-0" : "max-w-[180px] opacity-100 ml-3"}`}>
              Sair do sistema
            </span>
          </button>

          {/* Balão Tooltip Lateral */}
          {collapsedState && (
            <span className={`absolute left-[48px] top-1/2 -translate-y-1/2 ml-2 bg-navy border border-white/10 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-md shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 pointer-events-none select-none after:content-[''] after:absolute after:right-full after:top-1/2 after:-translate-y-1/2 after:border-4 after:border-transparent after:border-r-navy ${
              isTransitioning || justCollapsed ? "!opacity-0 !invisible !pointer-events-none" : ""
            }`}>
              Sair do sistema
            </span>
          )}
        </div>
      </div>
    </aside>
  )
}
