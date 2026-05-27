import type { Metadata } from "next"
import { Plus_Jakarta_Sans, DM_Mono } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/Sidebar"
import { Topbar } from "@/components/Topbar"
import { auth } from "@/auth"
import { IdleTimeoutProvider } from "@/components/IdleTimeoutProvider"
import { SessionProvider } from "next-auth/react"

const fontSans = Plus_Jakarta_Sans({ 
  subsets: ["latin"], 
  variable: "--font-sans" 
})

const fontMono = DM_Mono({ 
  subsets: ["latin"], 
  weight: ["400", "500"], 
  variable: "--font-mono" 
})

export const metadata: Metadata = {
  title: "Nexus - Painel Corporativo",
  description: "Portal Hub de Sistemas",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await auth()
  const authBasePath = process.env.NEXT_BASE_PATH ? `${process.env.NEXT_BASE_PATH}/api/auth` : "/api/auth"

  return (
    <html lang="pt-BR" className="h-screen overflow-hidden">
      <body className={`${fontSans.variable} ${fontMono.variable} font-sans flex h-screen bg-[#F4F5F7] antialiased overflow-hidden`}>
        <SessionProvider basePath={authBasePath}>
          {session ? <Sidebar /> : null}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-full w-full">
            {session ? <Topbar /> : null}
            <main className={`flex-1 overflow-y-auto ${session ? "p-6 lg:p-8" : ""}`}>
              {session ? (
                <IdleTimeoutProvider basePath={process.env.NEXT_BASE_PATH || ""}>
                  {children}
                </IdleTimeoutProvider>
              ) : (
                children
              )}
            </main>
          </div>
        </SessionProvider>
      </body>
    </html>
  )
}
