import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { signIn } from "@/auth"
import { AuthError } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen w-full flex bg-white lg:bg-gray-1">
      {/* Lado Esquerdo - Branding Institucional (Desktop) */}
      <div className="hidden lg:flex w-1/2 bg-navy relative flex-col justify-between p-12 xl:p-16 overflow-hidden shadow-2xl z-10 select-none">
        {/* Elementos Decorativos de Fundo (Glow / Gradientes) */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-green-brand/10 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-[28rem] h-[28rem] bg-teal/10 blur-[150px] rounded-full pointer-events-none" />
        
        {/* Logo Topo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-green-brand flex items-center justify-center shadow-lg shadow-green-brand/20">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4.5" fill="#1C2B4A" opacity=".95"/>
              <circle cx="4" cy="4" r="2.5" fill="#1C2B4A" opacity=".65"/>
              <circle cx="20" cy="4" r="2.5" fill="#1C2B4A" opacity=".65"/>
              <circle cx="4" cy="20" r="2.5" fill="#1C2B4A" opacity=".65"/>
              <circle cx="20" cy="20" r="2.5" fill="#1C2B4A" opacity=".65"/>
              <line x1="8.5" y1="8.5" x2="4" y2="4" stroke="#1C2B4A" strokeWidth="1.5" opacity=".5"/>
              <line x1="15.5" y1="8.5" x2="20" y2="4" stroke="#1C2B4A" strokeWidth="1.5" opacity=".5"/>
              <line x1="8.5" y1="15.5" x2="4" y2="20" stroke="#1C2B4A" strokeWidth="1.5" opacity=".5"/>
              <line x1="15.5" y1="15.5" x2="20" y2="20" stroke="#1C2B4A" strokeWidth="1.5" opacity=".5"/>
            </svg>
          </div>
          <span className="text-white font-extrabold text-2xl tracking-tight">
            Nexus<span className="text-green-brand font-semibold">Hub</span>
          </span>
        </div>

        {/* Bloco Central - Tipografia e Proposta de Valor */}
        <div className="relative z-10 max-w-xl my-auto py-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-green-brand text-xs font-bold tracking-wider uppercase backdrop-blur-xs">
            <span className="w-2 h-2 rounded-full bg-green-brand animate-pulse" />
            Sistemas Integrados • Tecnologias Educacionais
          </div>
          
          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.15] tracking-tight">
            Inteligência de Dados &<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-brand via-teal to-teal">
              Soluções Educacionais
            </span>
          </h1>

          <p className="text-base xl:text-lg text-white/70 leading-relaxed font-normal max-w-md pt-1">
            Plataforma centralizada de inteligência acadêmica, acompanhamento pedagógico contínuo e gestão de permanência discente.
          </p>
        </div>

        {/* Rodapé Esquerdo */}
        <div className="relative z-10 text-[11px] text-white/40 font-medium tracking-widest uppercase">
          © 2026 NEXUS HUB • TECNOLOGIAS EDUCACIONAIS
        </div>
      </div>

      {/* Lado Direito - Formulário de Acesso */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 xl:p-16 relative bg-white">
        <div className="w-full max-w-[420px] space-y-8 animate-in fade-in duration-500">
          
          {/* Logo Mobile */}
          <div className="lg:hidden flex flex-col items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-green-brand flex items-center justify-center shadow-lg shadow-green-brand/20">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4.5" fill="#1C2B4A" opacity=".95"/>
                <circle cx="4" cy="4" r="2.5" fill="#1C2B4A" opacity=".65"/>
                <circle cx="20" cy="4" r="2.5" fill="#1C2B4A" opacity=".65"/>
                <circle cx="4" cy="20" r="2.5" fill="#1C2B4A" opacity=".65"/>
                <circle cx="20" cy="20" r="2.5" fill="#1C2B4A" opacity=".65"/>
                <line x1="8.5" y1="8.5" x2="4" y2="4" stroke="#1C2B4A" strokeWidth="1.5" opacity=".5"/>
                <line x1="15.5" y1="8.5" x2="20" y2="4" stroke="#1C2B4A" strokeWidth="1.5" opacity=".5"/>
                <line x1="8.5" y1="15.5" x2="4" y2="20" stroke="#1C2B4A" strokeWidth="1.5" opacity=".5"/>
                <line x1="15.5" y1="15.5" x2="20" y2="20" stroke="#1C2B4A" strokeWidth="1.5" opacity=".5"/>
              </svg>
            </div>
            <span className="text-navy font-extrabold text-2xl tracking-tight">
              Nexus<span className="text-green-brand font-semibold">Hub</span>
            </span>
          </div>

          {/* Cabeçalho do Formulário */}
          <div className="text-left space-y-2">
            <h2 className="text-3xl font-extrabold text-navy tracking-tight">Bem-vindo</h2>
            <p className="text-gray-4 text-sm font-normal">
              Insira suas credenciais para acessar o portal.
            </p>
          </div>

          {/* Alerta de Erro de Autenticação */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red/10 border border-red/20 text-red text-sm font-medium flex items-center gap-2.5 animate-in shake duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>
                {error === "CredentialsSignin" 
                  ? "Usuário ou senha incorretos. Tente novamente." 
                  : "Ocorreu um erro ao tentar acessar o sistema."}
              </span>
            </div>
          )}

          {/* Formulário de Login */}
          <form 
            action={async (formData) => {
              "use server"
              try {
                const formDataObj = Object.fromEntries(formData)
                await signIn("credentials", {
                  ...formDataObj,
                  redirectTo: "/nexus"
                })
              } catch (error) {
                if (error instanceof AuthError) {
                  return redirect(`/login?error=${error.type}`)
                }
                throw error
              }
            }} 
            className="space-y-5"
          >
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-9 block">
                Usuário ou Email
              </label>
              <Input 
                name="login" 
                type="text" 
                placeholder="ex: nome.sobrenome" 
                required 
                autoComplete="username"
                className="h-12 rounded-xl bg-white border-gray-2 text-gray-9 placeholder:text-gray-3 focus-visible:ring-green-brand/20 focus-visible:border-green-brand transition-all shadow-2xs text-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-9">
                  Senha
                </label>
                <Link 
                  href="/recuperar-senha" 
                  className="text-xs font-semibold text-green-dark hover:text-green-brand transition-colors"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <Input 
                name="password" 
                type="password" 
                required 
                placeholder="••••••••"
                autoComplete="current-password"
                className="h-12 rounded-xl bg-white border-gray-2 text-gray-9 placeholder:text-gray-3 focus-visible:ring-green-brand/20 focus-visible:border-green-brand transition-all shadow-2xs text-sm"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 mt-3 rounded-xl bg-green-dark hover:bg-green-brand text-white font-bold text-base transition-all shadow-md shadow-green-dark/20 hover:shadow-lg hover:shadow-green-brand/25 active:scale-[0.99] cursor-pointer"
            >
              Acessar Plataforma
            </Button>
          </form>

          {/* Rodapé Mobile */}
          <div className="lg:hidden text-center text-xs text-gray-4 font-medium pt-4">
            © 2026 Nexus Hub • Tecnologias Educacionais
          </div>
        </div>
      </div>
    </div>
  )
}
