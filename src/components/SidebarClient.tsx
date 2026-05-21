"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Box, LogOut, ShieldCheck, Users, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SidebarClientProps {
  session: any
  modules: any[]
  initials: string
}

export function SidebarClient({ session, modules, initials }: SidebarClientProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved === "true") {
      setIsCollapsed(true)
    }
  }, [])

  const toggleSidebar = () => {
    const nextState = !isCollapsed
    setIsCollapsed(nextState)
    localStorage.setItem("sidebar-collapsed", nextState ? "true" : "false")
  }

  // Se não estiver montado no cliente, renderiza o estado padrão (expandido) 
  // para evitar divergências visuais (mismatch de hidratação)
  const collapsedState = mounted ? isCollapsed : false

  return (
    <aside className={`bg-navy flex flex-col h-full shadow-2xl z-30 transition-all duration-300 ease-in-out relative shrink-0 ${collapsedState ? "w-[72px]" : "w-64"}`}>
      {/* Botão de Toggle Flutuante */}
      {mounted && (
        <button 
          onClick={toggleSidebar}
          className="absolute top-6 -right-3 w-6 h-6 rounded-full bg-green-brand border-2 border-navy text-navy flex items-center justify-center shadow-lg hover:scale-110 hover:bg-green-400 active:scale-95 transition-all z-40 focus:outline-none cursor-pointer"
          title={collapsedState ? "Expandir menu" : "Recolher menu"}
        >
          {collapsedState ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      )}

      {/* Header com Logotipo */}
      <div className={`p-6 flex items-center gap-3 border-b border-white/10 select-none ${collapsedState ? "justify-center" : ""}`}>
        <div className="w-8 h-8 rounded-md bg-green-brand flex items-center justify-center shrink-0 shadow-inner">
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
        {!collapsedState && (
          <div className="animate-fade-in duration-300">
            <h1 className="text-white font-extrabold text-[15px] tracking-tight">Nexus<span className="text-green-brand font-normal">Hub</span></h1>
            <p className="text-[8px] font-semibold text-white/35 uppercase tracking-widest font-mono">NEXUS APPLICATION</p>
          </div>
        )}
      </div>

      {/* Perfil do Usuário */}
      {session?.user && (
        <div className={`p-4 mt-4 bg-slate-800/40 rounded-lg flex items-center gap-3 border border-slate-700/30 transition-all duration-300 select-none ${collapsedState ? "mx-2 px-2 justify-center" : "mx-4"}`}>
          <div className="w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center font-bold text-sm shrink-0 shadow-md border border-slate-600">
            {initials}
          </div>
          {!collapsedState && (
            <div className="flex flex-col overflow-hidden animate-fade-in duration-300">
              <span className="text-white text-sm font-medium tracking-tight truncate">{session.user.name}</span>
              <span className="text-green-400 text-[10px] font-bold uppercase tracking-wider mt-0.5 truncate">
                {/* @ts-ignore */}
                {session.user.groups?.length > 0 ? session.user.groups.join(', ') : 'Sem Grupo'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Links de Navegação */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {!collapsedState ? (
          <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest px-3 mb-2 mt-4 select-none">Módulos</div>
        ) : (
          <div className="border-t border-white/10 my-4 mx-1 select-none" />
        )}

        {/* Dashboard Link */}
        <Link 
          href="/" 
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/50 hover:bg-navy-light hover:text-white transition-all duration-200 group relative ${pathname === '/' ? 'bg-navy-light text-white font-semibold' : ''} ${collapsedState ? "justify-center" : ""}`}
        >
          <LayoutDashboard className="w-5 h-5 shrink-0" />
          {!collapsedState && <span className="text-[12px] font-medium">Dashboard</span>}

          {/* Balão Tooltip Premium (Expandido & Retraído) */}
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-950 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-md shadow-2xl opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 whitespace-nowrap z-50 pointer-events-none select-none after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-slate-950">
            Dashboard
          </span>
        </Link>

        {/* Módulos do Usuário */}
        {modules.map((sys) => {
          const isActive = pathname.startsWith(sys.pathUrl) || (sys.name === 'AVA Reports' && pathname.startsWith('/relatorios'))
          
          if (sys.name === 'AVA Reports') {
            if (!collapsedState) {
              // Modo Expandido: Acordeão Detalhado com Tooltip na Summary
              return (
                <details key={sys.id} className="group relative" open={pathname.startsWith('/relatorios')}>
                  <summary className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-white/50 hover:bg-navy-light hover:text-white transition-colors cursor-pointer list-none [&::-webkit-details-marker]:hidden group/sum relative ${isActive ? 'bg-navy-light/40 text-white font-medium' : ''}`}>
                    <div className="flex items-center gap-3">
                      <Box className="w-5 h-5 shrink-0" />
                      <span className="text-[12px] font-medium">{sys.name}</span>
                    </div>
                    <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>

                    {/* Balão Tooltip Premium no hover da summary */}
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-955 bg-slate-955/95 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-md shadow-2xl opacity-0 group-hover/sum:opacity-100 translate-y-1 group-hover/sum:translate-y-0 transition-all duration-200 whitespace-nowrap z-50 pointer-events-none select-none after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-slate-955">
                      {sys.name}
                    </span>
                  </summary>
                  <div className="pl-11 pr-3 py-2 space-y-2 relative before:content-[''] before:absolute before:left-5 before:top-0 before:bottom-2 before:w-[1px] before:bg-white/10">
                    <Link href="/relatorios/progresso" className={`block text-[11px] hover:text-white py-1 transition-colors ${pathname === '/relatorios/progresso' ? 'text-green-brand font-medium' : 'text-white/40'}`}>Progresso EaD</Link>
                    <Link href="/relatorios/progresso/uni" className={`block text-[11px] hover:text-white py-1 transition-colors ${pathname === '/relatorios/progresso/uni' ? 'text-green-brand font-medium' : 'text-white/40'}`}>Progresso Disciplinas Online Uni</Link>
                    <Link href="/relatorios/progresso/uniego" className={`block text-[11px] hover:text-white py-1 transition-colors ${pathname === '/relatorios/progresso/uniego' ? 'text-green-brand font-medium' : 'text-white/40'}`}>Progresso Disciplinas Online UNIEGO</Link>
                    <Link href="/relatorios/progresso/raizes" className={`block text-[11px] hover:text-white py-1 transition-colors ${pathname === '/relatorios/progresso/raizes' ? 'text-green-brand font-medium' : 'text-white/40'}`}>Progresso Disciplinas Online Raizes</Link>
                    <Link href="/relatorios/progresso/eefn" className={`block text-[11px] hover:text-white py-1 transition-colors ${pathname === '/relatorios/progresso/eefn' ? 'text-green-brand font-medium' : 'text-white/40'}`}>Progresso Disciplinas Online EEFN</Link>
                  </div>
                </details>
              )
            } else {
              // Modo Retraído: Dropdown/Submenu Flutuante (Estilo Adianti) com cabeçalho identificador
              return (
                <div key={sys.id} className="group relative flex justify-center">
                  <button className={`flex items-center justify-center w-10 h-10 rounded-lg text-white/50 hover:bg-navy-light hover:text-white transition-all duration-200 ${isActive ? 'bg-navy-light text-white' : ''}`}>
                    <Box className="w-5 h-5 shrink-0" />
                  </button>
                  
                  {/* Submenu Flutuante Lateral */}
                  <div className="absolute left-[56px] top-0 ml-2 w-64 bg-navy border border-slate-700/60 shadow-2xl rounded-lg py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-250 z-50 pointer-events-none group-hover:pointer-events-auto">
                    <div className="px-4 py-1.5 border-b border-white/5 text-[11px] font-bold text-white/40 uppercase tracking-wider mb-1 select-none">
                      {sys.name}
                    </div>
                    <div className="px-2 py-1 space-y-1">
                      <Link href="/relatorios/progresso" className={`block text-[11px] hover:text-white px-3 py-2 rounded-md transition-colors ${pathname === '/relatorios/progresso' ? 'bg-navy-light text-green-brand font-semibold' : 'text-white/60 hover:bg-navy-light/40'}`}>
                        Progresso EaD
                      </Link>
                      <Link href="/relatorios/progresso/uni" className={`block text-[11px] hover:text-white px-3 py-2 rounded-md transition-colors ${pathname === '/relatorios/progresso/uni' ? 'bg-navy-light text-green-brand font-semibold' : 'text-white/60 hover:bg-navy-light/40'}`}>
                        Progresso Online Uni
                      </Link>
                      <Link href="/relatorios/progresso/uniego" className={`block text-[11px] hover:text-white px-3 py-2 rounded-md transition-colors ${pathname === '/relatorios/progresso/uniego' ? 'bg-navy-light text-green-brand font-semibold' : 'text-white/60 hover:bg-navy-light/40'}`}>
                        Progresso Online UNIEGO
                      </Link>
                      <Link href="/relatorios/progresso/raizes" className={`block text-[11px] hover:text-white px-3 py-2 rounded-md transition-colors ${pathname === '/relatorios/progresso/raizes' ? 'bg-navy-light text-green-brand font-semibold' : 'text-white/60 hover:bg-navy-light/40'}`}>
                        Progresso Online Raízes
                      </Link>
                      <Link href="/relatorios/progresso/eefn" className={`block text-[11px] hover:text-white px-3 py-2 rounded-md transition-colors ${pathname === '/relatorios/progresso/eefn' ? 'bg-navy-light text-green-brand font-semibold' : 'text-white/60 hover:bg-navy-light/40'}`}>
                        Progresso Online EEFN
                      </Link>
                    </div>
                  </div>
                </div>
              )
            }
          }

          // Módulos normais sem filhos
          return (
            <Link 
              key={sys.id} 
              href={sys.pathUrl} 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/50 hover:bg-navy-light hover:text-white transition-all duration-200 group relative ${isActive ? 'bg-navy-light text-white font-semibold' : ''} ${collapsedState ? "justify-center" : ""}`}
            >
              <Box className="w-5 h-5 shrink-0" />
              {!collapsedState && <span className="text-[12px] font-medium">{sys.name}</span>}

              {/* Balão Tooltip Premium (Expandido & Retraído) */}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-955 bg-slate-955/95 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-md shadow-2xl opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 whitespace-nowrap z-50 pointer-events-none select-none after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-slate-955">
                {sys.name}
              </span>
            </Link>
          )
        })}

        {/* Administração do SuperAdmin */}
        {/* @ts-ignore */}
        {session?.user?.isSuperAdmin && (
          <>
            {!collapsedState ? (
              <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest px-3 mb-2 mt-6 select-none animate-fade-in">Administração</div>
            ) : (
              <div className="border-t border-white/10 my-4 mx-1 select-none" />
            )}
            
            <Link 
              href="/admin/users" 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/50 hover:bg-navy-light hover:text-white transition-all duration-200 group relative ${pathname.startsWith('/admin/users') ? 'bg-navy-light text-white font-semibold' : ''} ${collapsedState ? "justify-center" : ""}`}
            >
              <Users className="w-5 h-5 shrink-0" />
              {!collapsedState && <span className="text-[12px] font-medium">Usuários e Acessos</span>}

              {/* Balão Tooltip Premium (Expandido & Retraído) */}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-955 bg-slate-955/95 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-md shadow-2xl opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 whitespace-nowrap z-50 pointer-events-none select-none after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-slate-955">
                Usuários e Acessos
              </span>
            </Link>
            
            <Link 
              href="/admin/groups" 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/50 hover:bg-navy-light hover:text-white transition-all duration-200 group relative ${pathname.startsWith('/admin/groups') ? 'bg-navy-light text-white font-semibold' : ''} ${collapsedState ? "justify-center" : ""}`}
            >
              <ShieldCheck className="w-5 h-5 shrink-0" />
              {!collapsedState && <span className="text-[12px] font-medium">Grupos e Permissões</span>}

              {/* Balão Tooltip Premium (Expandido & Retraído) */}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-955 bg-slate-955/95 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-md shadow-2xl opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 whitespace-nowrap z-50 pointer-events-none select-none after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-slate-955">
                Grupos e Permissões
              </span>
            </Link>
          </>
        )}
      </nav>

      {/* Rodapé com botão Sair */}
      <div className={`p-4 border-t border-white/10 ${collapsedState ? "flex justify-center" : ""}`}>
        {collapsedState ? (
          <div className="group relative">
            <button 
              onClick={() => window.location.href = "/api/auth/signout"}
              className="flex items-center justify-center w-10 h-10 rounded-lg text-white/50 hover:text-white hover:bg-navy-light hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              title="Sair do sistema"
            >
              <LogOut className="w-5 h-5 shrink-0 text-red-400/80 hover:text-red-400" />
            </button>

            {/* Balão Tooltip Premium (Retraído) */}
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-955 bg-slate-955/95 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-md shadow-2xl opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 whitespace-nowrap z-50 pointer-events-none select-none after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-slate-955">
              Sair do sistema
            </span>
          </div>
        ) : (
          <div className="group relative">
            <Button 
              variant="ghost" 
              onClick={() => window.location.href = "/api/auth/signout"}
              className="w-full justify-start text-white/50 hover:text-white hover:bg-navy-light text-[12px] transition-all duration-200 cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2 text-red-400/80" />
              Sair do sistema
            </Button>

            {/* Balão Tooltip Premium (Expandido) */}
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-955 bg-slate-955/95 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-md shadow-2xl opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 whitespace-nowrap z-50 pointer-events-none select-none after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-slate-955">
              Sair do sistema
            </span>
          </div>
        )}
      </div>
    </aside>
  )
}
