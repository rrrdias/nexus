import React from "react"
import { Card, CardContent } from "@/components/ui/card"

export default function AcademicGradesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-80 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-4 w-96 bg-slate-100 rounded-md animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-32 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-9 w-52 bg-slate-200 rounded-lg animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4 space-y-2">
              <div className="h-3 w-28 bg-slate-200 rounded animate-pulse" />
              <div className="h-7 w-16 bg-slate-100 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-4 flex gap-3">
          <div className="h-10 flex-1 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-10 w-36 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-slate-200 rounded-lg animate-pulse" />
        </CardContent>
      </Card>

      <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
        <CardContent className="p-0 divide-y divide-gray-100">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-64 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-40 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="h-8 w-28 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
