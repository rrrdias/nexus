"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface AuditPaginationProps {
  currentPage: number
  totalPages: number
  totalRecords: number
  pageSize: number
}

export function AuditPagination({
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
}: AuditPaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(newPage))
    router.push(`${pathname}?${params.toString()}`)
  }

  const startRecord = (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, totalRecords)

  if (totalRecords === 0) return null

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white px-5 py-3.5 rounded-xl border border-gray-2 text-xs text-slate-500 shadow-sm select-none">
      <div>
        Exibindo <strong className="text-navy font-mono">{startRecord}</strong> a{" "}
        <strong className="text-navy font-mono">{endRecord}</strong> de{" "}
        <strong className="text-navy font-mono">{totalRecords}</strong> registros
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="h-8 px-2.5 text-xs rounded-lg border-gray-2 text-slate-600 disabled:opacity-40"
        >
          <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Anterior
        </Button>

        <span className="px-2 font-mono text-[11px] font-bold text-slate-700">
          Página {currentPage} de {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="h-8 px-2.5 text-xs rounded-lg border-gray-2 text-slate-600 disabled:opacity-40"
        >
          Próxima <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  )
}
