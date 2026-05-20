import { ReactNode } from "react"

export default function RelatorioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full overflow-hidden bg-[#F8F9FA]">
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}
