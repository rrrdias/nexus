import React from "react"
import { Card, CardContent } from "@/components/ui/card"

export default function TutoriaLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-64 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-4 w-96 bg-slate-100 rounded-md animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-32 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-9 w-36 bg-slate-100 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* 4 Risk Metrics Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-slate-200 bg-white shadow-sm rounded-xl">
            <CardContent className="p-5 space-y-2.5">
              <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
              <div className="h-7 w-16 bg-slate-200 rounded-lg animate-pulse" />
              <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter Bar Skeleton */}
      <Card className="border-slate-200 bg-white shadow-sm rounded-xl">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
        </CardContent>
      </Card>

      {/* Table Skeleton */}
      <Card className="border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex gap-4">
          <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-24 bg-slate-200 rounded animate-pulse hidden md:block" />
          <div className="h-3 w-24 bg-slate-200 rounded animate-pulse ml-auto" />
        </div>
        <CardContent className="p-0 divide-y divide-slate-100">
          {[1, 2, 3, 4, 5, 6].map((row) => (
            <div key={row} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-52 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-36 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="h-6 w-20 bg-slate-100 rounded-full animate-pulse" />
              <div className="h-8 w-24 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
