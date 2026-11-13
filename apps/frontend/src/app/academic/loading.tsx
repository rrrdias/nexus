import React from "react"
import { Card, CardContent } from "@/components/ui/card"

export default function AcademicLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-72 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-4 w-96 bg-slate-100 rounded-md animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-40 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-8 w-32 bg-slate-100 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* 4 Tabs Skeleton */}
      <div className="flex border-b border-gray-200 gap-4 pb-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-5 w-36 bg-slate-200 rounded animate-pulse" />
        ))}
      </div>

      {/* Search Card Skeleton */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-5 flex gap-3">
          <div className="h-11 flex-1 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-11 w-28 bg-slate-200 rounded-lg animate-pulse" />
        </CardContent>
      </Card>

      {/* Table Skeleton */}
      <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-[#F4F5F7] border-b border-gray-200 px-5 py-3.5 flex gap-4">
          <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-28 bg-slate-200 rounded animate-pulse hidden md:block" />
          <div className="h-3 w-20 bg-slate-200 rounded animate-pulse ml-auto" />
        </div>
        <CardContent className="p-0 divide-y divide-gray-100">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-8.5 h-8.5 rounded-full bg-slate-200 animate-pulse shrink-0" />
                <div className="space-y-1.5">
                  <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-8 w-24 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
