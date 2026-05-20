import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { signIn } from "@/auth"
import { AuthError } from "next-auth"
import { redirect } from "next/navigation"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="space-y-3 text-center pb-8">
          <div className="mx-auto w-12 h-12 bg-green-brand rounded-xl flex items-center justify-center shadow-lg shadow-green-brand/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4.5" fill="#1C2B4A" opacity=".9"/>
              <circle cx="4" cy="4" r="2.5" fill="#1C2B4A" opacity=".6"/>
              <circle cx="20" cy="4" r="2.5" fill="#1C2B4A" opacity=".6"/>
              <circle cx="4" cy="20" r="2.5" fill="#1C2B4A" opacity=".6"/>
              <circle cx="20" cy="20" r="2.5" fill="#1C2B4A" opacity=".6"/>
              <line x1="8.5" y1="8.5" x2="4" y2="4" stroke="#1C2B4A" strokeWidth="1.5" opacity=".5"/>
              <line x1="15.5" y1="8.5" x2="20" y2="4" stroke="#1C2B4A" strokeWidth="1.5" opacity=".5"/>
              <line x1="8.5" y1="15.5" x2="4" y2="20" stroke="#1C2B4A" strokeWidth="1.5" opacity=".5"/>
              <line x1="15.5" y1="15.5" x2="20" y2="20" stroke="#1C2B4A" strokeWidth="1.5" opacity=".5"/>
            </svg>
          </div>
          <CardTitle className="text-2xl font-extrabold text-navy tracking-tight">Nexus<span className="text-green-brand font-normal">Hub</span></CardTitle>
          <CardDescription>Faça login para acessar o portal corporativo.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-sm font-medium text-center">
              {error === "CredentialsSignin" 
                ? "Usuário/Email ou senha incorretos." 
                : "Ocorreu um erro ao tentar acessar o sistema."}
            </div>
          )}
          <form action={async (formData) => {
            "use server"
            try {
              await signIn("credentials", formData)
            } catch (error) {
              if (error instanceof AuthError) {
                return redirect(`/login?error=${error.type}`)
              }
              // Auth.js utiliza erros para redirecionamento. 
              // Precisamos relançar o erro se não for um AuthError para o redirect funcionar.
              throw error
            }
          }} className="space-y-4">
            {/* Opcional: Mostrar erro se existir no searchParams */}
            {/* Nota: Em Next.js 15+, searchParams é uma Promise */}
            <div className="space-y-2">
              <label className="text-sm font-semibold leading-none text-[#5F6775]">Usuário ou Email</label>
              <Input name="login" type="text" placeholder="nome.sobrenome ou email" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold leading-none text-[#5F6775]">Senha</label>
              <Input name="password" type="password" required />
            </div>
            <Button type="submit" className="w-full bg-green-dark hover:bg-green-brand text-white mt-4 h-11 font-bold">
              Acessar Sistema
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-xs text-slate-500 pt-4 border-t mt-4">
          © 2026 Nexus Corporate Hub
        </CardFooter>
      </Card>
    </div>
  )
}
