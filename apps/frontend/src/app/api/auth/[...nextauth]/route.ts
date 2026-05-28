import { handlers } from "@/auth"
import { NextRequest } from "next/server"

const bp = process.env.NEXT_BASE_PATH || ""

const wrapRequest = (req: NextRequest) => {
  if (bp && !req.nextUrl.pathname.startsWith(bp)) {
    const url = req.nextUrl.clone()
    url.pathname = `${bp}${url.pathname}`
    
    // Usamos um Proxy para sobrescrever a URL de forma 100% segura
    // sem clonar ou consumir o stream do body (evita bugs no Next.js com requisições POST)
    return new Proxy(req, {
      get(target, prop) {
        if (prop === 'url') return url.toString()
        if (prop === 'nextUrl') return url
        const value = target[prop as keyof NextRequest]
        if (typeof value === 'function') {
          return value.bind(target)
        }
        return value
      }
    }) as NextRequest
  }
  return req
}

export const GET = (req: NextRequest) => handlers.GET(wrapRequest(req))
export const POST = (req: NextRequest) => handlers.POST(wrapRequest(req))
