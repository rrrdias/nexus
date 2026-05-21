import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
    <div className="min-h-screen w-full flex bg-gray-1">
      {/* Lado Esquerdo - Branding (Desktop apenas) */}
      <div className="hidden lg:flex w-1/2 bg-navy relative flex-col justify-between p-12 overflow-hidden shadow-2xl z-10">
        {/* Elementos Decorativos de Fundo */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-green-brand/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-blue/10 blur-[150px] rounded-full pointer-events-none" />
        
        {/* Logo Topo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-green-brand flex items-center justify-center shadow-lg">
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
          <span className="text-white font-extrabold text-2xl tracking-tight">Nexus<span className="text-green-brand font-normal">Hub</span></span>
        </div>

        {/* Texto Central */}
        <div className="relative z-10 max-w-lg mt-[-10%]">
          <div className="inline-block px-3 py-1 mb-6 rounded-full bg-white/5 border border-white/10 text-green-brand text-xs font-bold tracking-wider uppercase">
            Plataforma Unificada
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight mb-6">
            Sistemas Acadêmicos <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-brand to-teal">Integrados</span>
          </h1>
          <p className="text-white/70 text-lg leading-relaxed">
            Centralize a gestão de progresso, relatórios e permissões corporativas em uma única plataforma de alta performance e segurança.
          </p>
        </div>

        {/* Rodapé Esquerdo */}
        <div className="relative z-10 text-[11px] text-white/30 font-semibold tracking-widest">
          © 2026 NEXUS CORPORATE HUB. TODOS OS DIREITOS RESERVADOS.
        </div>
      </div>

      {/* Lado Direito - Form de Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-[420px] space-y-8">
          
          {/* Logo Mobile */}
          <div className="lg:hidden flex flex-col items-center justify-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-green-brand flex items-center justify-center shadow-lg shadow-green-brand/20">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
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
            <span className="text-navy font-extrabold text-3xl tracking-tight">Nexus<span className="text-green-brand font-normal">Hub</span></span>
          </div>

          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-3xl font-bold text-gray-9 tracking-tight">Bem-vindo</h2>
            <p className="text-gray-4 text-sm font-medium">Insira suas credenciais para acessar o portal.</p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red/10 border border-red/20 text-red text-sm font-medium flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error === "CredentialsSignin" 
                ? "Usuário ou senha incorretos. Tente novamente." 
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
              throw error
            }
          }} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-9">Usuário ou Email</label>
              <Input 
                name="login" 
                type="text" 
                placeholder="ex: nome.sobrenome" 
                required 
                className="h-12 bg-white border-gray-2 text-gray-9 focus-visible:ring-green-brand focus-visible:border-green-brand transition-all shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-9">Senha</label>
                <a href="#" className="text-xs font-bold text-green-dark hover:text-green-brand transition-colors">Esqueceu a senha?</a>
              </div>
              <Input 
                name="password" 
                type="password" 
                required 
                placeholder="••••••••"
                className="h-12 bg-white border-gray-2 text-gray-9 focus-visible:ring-green-brand focus-visible:border-green-brand transition-all shadow-sm"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 mt-4 bg-green-dark hover:bg-green-brand text-white font-bold text-[15px] transition-all hover:shadow-lg hover:shadow-green-brand/20 active:scale-[0.98]"
            >
              Acessar Plataforma
            </Button>
          </form>

          <div className="lg:hidden text-center text-xs text-gray-4 font-medium pt-8">
            © 2026 Nexus Corporate Hub
          </div>
        </div>
      </div>
    </div>
  )
}
