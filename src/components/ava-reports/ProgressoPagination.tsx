"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ProgressoPaginationProps {
  currentPage: number
  totalPages: number
  totalRecords: number
  pageSize: number
}

export function ProgressoPagination({ currentPage, totalPages, totalRecords, pageSize }: ProgressoPaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const from = Math.min((currentPage - 1) * pageSize + 1, totalRecords)
  const to = Math.min(currentPage * pageSize, totalRecords)

  const navigate = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(page))
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  // Gera os números de páginas visíveis (janela de 5)
  const getPageNumbers = () => {
    const pages: (number | "...")[] = []
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    pages.push(1)
    if (currentPage > 3) pages.push("...")
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i)
    }
    if (currentPage < totalPages - 2) pages.push("...")
    pages.push(totalPages)
    return pages
  }

  if (totalPages <= 1) return null

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-white ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Info */}
      <p className="text-xs text-[#9AA0AC]">
        Mostrando <span className="font-bold text-navy">{from}–{to}</span> de{" "}
        <span className="font-bold text-navy">{totalRecords}</span> resultados
      </p>

      {/* Paginação */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => navigate(1)} disabled={currentPage === 1}
          title="Primeira página"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => navigate(currentPage - 1)} disabled={currentPage === 1}
          title="Página anterior"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>

        {getPageNumbers().map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-[#9AA0AC]">…</span>
          ) : (
            <button
              key={p}
              onClick={() => navigate(p as number)}
              className={`h-7 min-w-[28px] px-2 rounded text-xs font-bold transition-colors ${
                p === currentPage
                  ? "bg-navy text-white"
                  : "text-[#5F6775] hover:bg-[#F4F5F7]"
              }`}
            >
              {p}
            </button>
          )
        )}

        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => navigate(currentPage + 1)} disabled={currentPage === totalPages}
          title="Próxima página"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => navigate(totalPages)} disabled={currentPage === totalPages}
          title="Última página"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
