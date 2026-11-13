import React from "react"
import { Card, CardContent } from "@/components/ui/card"

export default function RelatoriosLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-64 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-4 w-96 bg-slate-100 rounded-md animate-pulse" />
        </div>
        <div className="h-9 w-40 bg-slate-200 rounded-xl animate-pulse" />
      </div>

      {/* 4 KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-slate-200 bg-white shadow-sm rounded-xl">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
                <div className="w-8 h-8 rounded-lg bg-slate-100 animate-pulse" />
              </div>
              <div className="h-8 w-20 bg-slate-200 rounded-lg animate-pulse" />
              <div className="h-3 w-36 bg-slate-100 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Institutions Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="border-slate-200 bg-white shadow-sm rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 animate-pulse" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
                    <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-6 w-16 bg-slate-100 rounded-full animate-pulse" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div className="h-12 bg-slate-50 rounded-lg animate-pulse" />
                <div className="h-12 bg-slate-50 rounded-lg animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
