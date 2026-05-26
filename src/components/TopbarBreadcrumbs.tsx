"use client"

import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

export function TopbarBreadcrumbs() {
  const pathname = usePathname()

  const getBreadcrumbs = () => {
    if (!pathname || pathname === "/" || pathname === "/login") {
      return (
        <div className="flex items-center gap-2">
          <span>Dashboard</span>
          <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
          <span className="text-gray-900 font-bold">Início</span>
        </div>
      )
    }

    const segments = pathname.split("/").filter(Boolean)
    
    // Custom mapping for friendly Portuguese names
    const segmentMap: Record<string, string> = {
      relatorios: "AVA Reports",
      progresso: "Progresso",
      notas: "Notas",
      eefn: "EEFN",
      raizes: "Raízes",
      uni: "UNI",
      uniego: "UNIEGO",
      admin: "Administração",
      users: "Usuários",
      groups: "Grupos",
    }

    return (
      <div className="flex items-center gap-2">
        {segments.map((seg, index) => {
          const friendlyName = segmentMap[seg] || seg.charAt(0).toUpperCase() + seg.slice(1)
          const isLast = index === segments.length - 1

          return (
            <div key={seg} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />}
              <span className={isLast ? "text-gray-900 font-bold" : "text-gray-400 font-medium"}>
                {friendlyName}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <h2 className="text-gray-500 font-medium text-sm flex items-center gap-2 select-none">
      {getBreadcrumbs()}
    </h2>
  )
}
