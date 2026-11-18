import type { Metadata } from "next"
import { headers } from "next/headers"
import "./globals.css"
import { Sidebar } from "@/components/Sidebar"
import { Topbar } from "@/components/Topbar"
import { auth } from "@/auth"
import { IdleTimeoutProvider } from "@/components/IdleTimeoutProvider"
import { SessionProvider } from "next-auth/react"

export async function generateMetadata(): Promise<Metadata> {
  const basePath = process.env.NEXT_BASE_PATH || ""
  let isLocalOrDev = process.env.NODE_ENV === "development"
  try {
    const reqHeaders = await headers()
    const host = (
      reqHeaders.get("x-forwarded-host") ||
      reqHeaders.get("host") ||
      ""
    ).toLowerCase()
    if (host.includes("localhost") || host.includes("127.0.0.1")) {
      isLocalOrDev = true
    }
  } catch {
    // Fallback para NODE_ENV fora de request
  }

  return {
    title: isLocalOrDev ? "Nexus Hub Dev" : "Nexus Hub",
    description: "Portal Hub de Sistemas",
    icons: {
      icon: [
        {
          url: `${basePath}/favicon.svg`,
          type: "image/svg+xml",
        },
      ],
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  let session = null
  try {
    session = await auth()
  } catch (err) {
    console.error("[RootLayout] Erro ao recuperar sessão:", err)
  }

  return (
    <html lang="pt-BR" className="h-screen overflow-hidden">
      <body className="font-sans flex h-screen bg-[#F4F5F7] antialiased overflow-hidden">
        <SessionProvider basePath="/nexus/api/auth">
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
