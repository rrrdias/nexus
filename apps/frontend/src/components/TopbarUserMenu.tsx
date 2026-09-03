"use client"

import { useState, useRef, useEffect } from "react"
import { logoutAction } from "@/app/actions/auth"
import { LogOut, ShieldCheck, ChevronDown, User, Mail } from "lucide-react"

interface TopbarUserMenuProps {
  session: any
  initials: string
  userGroup: string
}

export function TopbarUserMenu({ session, initials, userGroup }: TopbarUserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const userName = session?.user?.name || "Usuário"
  const userEmail = session?.user?.email || ""

  // Fecha o menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Fecha ao pressionar ESC
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="relative select-none" ref={menuRef}>
      {/* Botão de Trigger no Topo */}
      <button 
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center gap-3 p-1.5 pr-3 rounded-xl transition-all duration-200 border focus:outline-none cursor-pointer group ${
          isOpen 
            ? "bg-slate-100 border-slate-300 shadow-2xs" 
            : "border-transparent hover:bg-slate-100/80 hover:border-slate-200/80"
        }`}
        title={`${userName} (${userGroup})`}
      >
        {/* Avatar com Badge de Iniciais */}
        <div className="w-9 h-9 rounded-full bg-green-brand text-navy flex items-center justify-center font-black text-xs shadow-xs border border-green-brand/30 shrink-0 group-hover:scale-105 transition-transform">
          {initials}
        </div>

        {/* Nome e Função em Destaque */}
        <div className="flex flex-col text-left overflow-hidden">
          <span className="text-xs font-extrabold text-navy truncate max-w-[170px] leading-tight" title={userName}>
            {userName}
          </span>
          <span className="text-[10px] font-bold text-green-dark uppercase tracking-wider truncate max-w-[170px] mt-0.5">
            {userGroup}
          </span>
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-navy transition-transform duration-200 shrink-0 ml-0.5 ${
          isOpen ? "rotate-180 text-navy" : ""
        }`} />
      </button>

      {/* Popover / Dropdown Menu Customizado */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header do Menu */}
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-navy text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-navy truncate" title={userName}>
                  {userName}
                </div>
                <div className="text-[10px] text-slate-500 font-mono truncate" title={userEmail}>
                  {userEmail}
                </div>
              </div>
            </div>

            <div className="pt-1.5 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-100/70 border border-green-200 text-green-800 text-[10px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3 text-green-700 shrink-0" />
                <span className="truncate">{userGroup}</span>
              </span>
            </div>
          </div>

          <div className="my-1.5 border-t border-slate-100" />

          {/* Botão Sair */}
          <button
            type="button"
            onClick={async () => {
              setIsOpen(false)
              await logoutAction()
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl cursor-pointer transition-colors text-left focus:outline-none"
          >
            <LogOut className="w-4 h-4 shrink-0 text-rose-500" />
            <span>Sair do sistema</span>
          </button>
        </div>
      )}
    </div>
  )
}
