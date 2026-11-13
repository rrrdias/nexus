import React from "react"
import { Card, CardContent } from "@/components/ui/card"

export default function ConsolidatedLoading() {
  return (
    <div className="space-y-6">
      {/* Header + Sync Badge Skeleton */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-72 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-4 w-96 bg-slate-100 rounded-md animate-pulse" />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="h-11 w-56 bg-slate-100 border border-slate-200 rounded-lg animate-pulse" />
          <div className="h-10 w-36 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-10 w-36 bg-slate-100 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Top Charts Skeleton: Donut + Phase Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200 bg-white shadow-sm rounded-2xl">
          <CardContent className="p-6 space-y-4">
            <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="flex items-center gap-6 pt-2">
              <div className="w-36 h-36 rounded-full border-[14px] border-slate-100 animate-pulse shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                <div className="h-4 w-5/6 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 w-4/6 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm rounded-2xl">
          <CardContent className="p-6 space-y-4">
            <div className="h-4 w-52 bg-slate-200 rounded animate-pulse" />
            <div className="space-y-4 pt-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between">
                    <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
                    <div className="h-3 w-12 bg-slate-100 rounded animate-pulse" />
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Card Skeleton */}
      <Card className="border-slate-200 bg-white shadow-sm rounded-2xl">
        <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </CardContent>
      </Card>

      {/* Table Skeleton (8 simulated rows) */}
      <Card className="border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex gap-4">
          <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-36 bg-slate-200 rounded animate-pulse hidden md:block" />
          <div className="h-3 w-20 bg-slate-200 rounded animate-pulse ml-auto" />
        </div>
        <CardContent className="p-0 divide-y divide-slate-100">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
            <div key={row} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-56 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-36 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="h-4 w-28 bg-slate-100 rounded animate-pulse hidden md:block" />
              <div className="h-6 w-20 bg-slate-100 rounded-full animate-pulse" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
