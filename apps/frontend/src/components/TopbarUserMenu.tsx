"use client"

import { useState } from "react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { logoutAction } from "@/app/actions/auth"
import { LogOut, User, ShieldCheck, ChevronDown, Check } from "lucide-react"

interface TopbarUserMenuProps {
  session: any
  initials: string
  userGroup: string
}

export function TopbarUserMenu({ session, initials, userGroup }: TopbarUserMenuProps) {
  const userName = session?.user?.name || "Usuário"
  const userEmail = session?.user?.email || ""

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button 
          className="flex items-center gap-3 p-1.5 pr-2.5 rounded-xl hover:bg-slate-100/80 transition-all duration-200 border border-transparent hover:border-slate-200/80 focus:outline-none cursor-pointer group"
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

          <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-navy transition-colors shrink-0 ml-0.5" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 shadow-xl rounded-xl p-1.5 z-50">
        <DropdownMenuLabel className="px-2.5 py-2">
          <div className="text-xs font-bold text-navy truncate">{userName}</div>
          {userEmail && (
            <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">{userEmail}</div>
          )}
          <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-800 text-[10px] font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3 h-3 text-green-600 shrink-0" />
            <span className="truncate">{userGroup}</span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-slate-100 my-1" />

        <DropdownMenuItem
          onClick={() => logoutAction()}
          className="flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-lg cursor-pointer transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sair do sistema</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
