"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ConsolidatedPaginationProps {
  currentPage: number
  totalPages: number
  totalRecords: number
  pageSize: number
}

export function ConsolidatedPagination({ currentPage, totalPages, totalRecords, pageSize }: ConsolidatedPaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const from = Math.min((currentPage - 1) * pageSize + 1, totalRecords)
  const to = Math.min(currentPage * pageSize, totalRecords)

  const navigate = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(page))
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }))
  }

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
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-1 bg-white select-none ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Info */}
      <p className="text-xs text-gray-5">
        Mostrando <span className="font-bold text-navy">{from}–{to}</span> de{" "}
        <span className="font-bold text-navy">{totalRecords}</span> registros consolidados
      </p>

      {/* Paginação */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost" size="icon" className="h-8 w-8 text-gray-6 hover:bg-gray-1"
          onClick={() => navigate(1)} disabled={currentPage === 1}
          title="Primeira página"
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-8 w-8 text-gray-6 hover:bg-gray-1"
          onClick={() => navigate(currentPage - 1)} disabled={currentPage === 1}
          title="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {getPageNumbers().map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-gray-4">…</span>
          ) : (
            <button
              key={p}
              onClick={() => navigate(p as number)}
              className={`h-8 min-w-[32px] px-2.5 rounded-lg text-xs font-bold transition-all ${
                p === currentPage
                  ? "bg-navy text-white shadow-sm"
                  : "text-gray-6 hover:bg-gray-1"
              }`}
            >
              {p}
            </button>
          )
        )}

        <Button
          variant="ghost" size="icon" className="h-8 w-8 text-gray-6 hover:bg-gray-1"
          onClick={() => navigate(currentPage + 1)} disabled={currentPage === totalPages}
          title="Próxima página"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-8 w-8 text-gray-6 hover:bg-gray-1"
          onClick={() => navigate(totalPages)} disabled={currentPage === totalPages}
          title="Última página"
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
