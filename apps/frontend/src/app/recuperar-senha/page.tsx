"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { forgotPasswordAction, resetPasswordAction } from "@/app/actions/auth"
import { 
  KeyRound, 
  Mail, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Lock 
} from "lucide-react"

function RecuperarSenhaContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  // Estados para o fluxo "Esqueci a senha" (sem token)
  const [loginInput, setLoginInput] = useState("")
  const [isForgotLoading, setIsForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)

  // Estados para o fluxo "Redefinir Senha" (com token)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isResetLoading, setIsResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError(null)
    if (!loginInput.trim()) {
      setForgotError("Informe seu usuário ou e-mail cadastrado.")
      return
    }

    setIsForgotLoading(true)
    try {
      const clientOrigin = typeof window !== "undefined" ? window.location.origin : undefined
      const res = await forgotPasswordAction(loginInput.trim(), clientOrigin)
      if (res.success) {
        setForgotSuccess(true)
      } else {
        setForgotError(res.error || "Não foi possível enviar o e-mail de recuperação.")
      }
    } catch (err: any) {
      setForgotError(err?.message || "Erro inesperado ao solicitar recuperação.")
    } finally {
      setIsForgotLoading(false)
    }
  }

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError(null)

    if (!newPassword || newPassword.length < 6) {
      setResetError("A nova senha deve ter no mínimo 6 caracteres.")
      return
    }

    if (newPassword !== confirmPassword) {
      setResetError("As senhas informadas não coincidem.")
      return
    }

    if (!token) {
      setResetError("Token de recuperação ausente ou inválido.")
      return
    }

    setIsResetLoading(true)
    try {
      const res = await resetPasswordAction(token, newPassword)
      if (res.success) {
        setResetSuccess(true)
      } else {
        setResetError(res.error || "Falha ao redefinir a senha. O token pode ter expirado.")
      }
    } catch (err: any) {
      setResetError(err?.message || "Erro inesperado ao redefinir a senha.")
    } finally {
      setIsResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50/50 p-4 sm:p-6 lg:p-8">
      {/* Background Decorativo Suave */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-green-brand/5 blur-3xl rounded-full" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal/5 blur-3xl rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-[460px] bg-white rounded-2xl border border-gray-100 shadow-xl p-6 sm:p-8 space-y-6">
        
        {/* Topo com Logo e Identidade */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-green-brand flex items-center justify-center shadow-md shadow-green-brand/20 mb-1">
            {token ? (
              <Lock className="w-6 h-6 text-navy" />
            ) : (
              <KeyRound className="w-6 h-6 text-navy" />
            )}
          </div>
          <span className="text-navy font-extrabold text-2xl tracking-tight">
            Nexus<span className="text-green-brand font-semibold">Hub</span>
          </span>
          <p className="text-xs uppercase tracking-widest text-gray-4 font-semibold">
            Sistemas Integrados • TED
          </p>
        </div>

        {/* FLUXO 1: Formulário de Redefinição com Token */}
        {token ? (
          <div>
            {resetSuccess ? (
              <div className="space-y-6 text-center animate-in fade-in duration-300">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-900">
                    Senha redefinida com sucesso!
                  </h3>
                  <p className="text-sm text-gray-600">
                    Sua nova credencial foi salva com sucesso. Você já pode acessar a plataforma NexusHub.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="block w-full text-center py-3 px-4 rounded-xl font-bold bg-green-brand hover:bg-green-brand/90 text-navy transition-all shadow-sm"
                >
                  Entrar no Sistema
                </Link>
              </div>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-5 animate-in fade-in duration-300">
                <div className="space-y-1 text-center">
                  <h2 className="text-xl font-bold text-navy">Criar Nova Senha</h2>
                  <p className="text-xs text-gray-500">
                    Digite sua nova senha de acesso e confirme abaixo.
                  </p>
                </div>

                {resetError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{resetError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-700 block">
                    Nova Senha
                  </label>
                  <Input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoFocus
                    className="h-11 rounded-xl bg-white border-gray-200 text-sm focus-visible:ring-green-brand/20 focus-visible:border-green-brand"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-700 block">
                    Confirmar Nova Senha
                  </label>
                  <Input
                    type="password"
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-11 rounded-xl bg-white border-gray-200 text-sm focus-visible:ring-green-brand/20 focus-visible:border-green-brand"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isResetLoading}
                  className="w-full h-11 rounded-xl font-bold bg-green-brand hover:bg-green-brand/90 text-navy transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  {isResetLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando nova senha...</span>
                    </>
                  ) : (
                    <span>Salvar Nova Senha</span>
                  )}
                </Button>

                <div className="text-center pt-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-navy transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar ao Login
                  </Link>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* FLUXO 2: Solicitação de Link de Recuperação */
          <div>
            {forgotSuccess ? (
              <div className="space-y-6 text-center animate-in fade-in duration-300">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Mail className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-900">
                    Verifique seu e-mail
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Se o usuário ou e-mail informado estiver ativo no NexusHub, você receberá um link com instruções para redefinir sua senha.
                  </p>
                  <p className="text-xs text-gray-400">
                    Não se esqueça de checar sua caixa de spam ou lixo eletrônico.
                  </p>
                </div>
                <div className="space-y-2 pt-2">
                  <Link
                    href="/login"
                    className="block w-full text-center py-2.5 px-4 rounded-xl font-bold bg-navy text-white hover:bg-navy/90 text-sm transition-all shadow-sm"
                  >
                    Voltar ao Login
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotSuccess(false)
                      setLoginInput("")
                    }}
                    className="text-xs text-gray-500 hover:text-green-brand transition-colors font-medium"
                  >
                    Tentar outro e-mail
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-5 animate-in fade-in duration-300">
                <div className="space-y-1 text-center">
                  <h2 className="text-xl font-bold text-navy">Recuperar Acesso</h2>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Informe seu usuário institucional ou endereço de e-mail para receber as instruções de recuperação.
                  </p>
                </div>

                {forgotError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-700 block">
                    Usuário ou E-mail
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="ex: nome.sobrenome ou email@aee.edu.br"
                      value={loginInput}
                      onChange={(e) => setLoginInput(e.target.value)}
                      required
                      autoFocus
                      className="h-11 rounded-xl bg-white border-gray-200 text-sm focus-visible:ring-green-brand/20 focus-visible:border-green-brand"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isForgotLoading}
                  className="w-full h-11 rounded-xl font-bold bg-green-brand hover:bg-green-brand/90 text-navy transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  {isForgotLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enviando instruções...</span>
                    </>
                  ) : (
                    <span>Enviar Link de Recuperação</span>
                  )}
                </Button>

                <div className="text-center pt-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-navy transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar ao Login
                  </Link>
                </div>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default function RecuperarSenhaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
          <Loader2 className="w-8 h-8 animate-spin text-green-brand" />
        </div>
      }
    >
      <RecuperarSenhaContent />
    </Suspense>
  )
}
