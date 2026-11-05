import React from "react"
import { RefreshCw, Shield } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function AdminLoading() {
  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-4 w-72 bg-slate-100 rounded-md animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
          <span className="text-xs text-slate-500">Carregando módulo administrativo...</span>
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
            <div className="h-7 w-16 bg-slate-200 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>

      {/* Content Table Skeleton */}
      <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="h-9 w-32 bg-slate-100 rounded-xl animate-pulse" />
        </div>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-4 flex items-center justify-between">
                <div className="space-y-1.5">
                  <div className="h-4 w-52 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="h-6 w-20 bg-slate-100 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
