"use client"

import { useState, useTransition } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { createUser, updateUser } from "@/app/actions/users"
import { 
  Loader2, 
  UserPlus, 
  UserCog, 
  ShieldCheck, 
  Users, 
  Layers, 
  AlertCircle, 
  Check,
  Mail,
  KeyRound,
  Fingerprint,
  User
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Group { id: string; name: string }
interface Module { id: string; name: string }

interface Props {
  children: React.ReactNode
  allGroups: Group[]
  allModules: Module[]
  mode: "create" | "edit"
  userId?: string
  defaultName?: string
  defaultEmail?: string
  defaultUserid?: string
  defaultIsActive?: boolean
  defaultGroupIds?: string[]
  defaultModuleIds?: string[]
}

export function UserFormDialog({
  children, allGroups, allModules, mode,
  userId, defaultName = "", defaultEmail = "", defaultUserid = "",
  defaultIsActive = true, defaultGroupIds = [], defaultModuleIds = []
}: Props) {
  const [open, setOpen] = useState(false)
  const [selectedGroups, setSelectedGroups] = useState<string[]>(defaultGroupIds)
  const [selectedModules, setSelectedModules] = useState<string[]>(defaultModuleIds)
  const [isActive, setIsActive] = useState(defaultIsActive)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function handleOpen() {
    setSelectedGroups(defaultGroupIds)
    setSelectedModules(defaultModuleIds)
    setIsActive(defaultIsActive)
    setError("")
    setOpen(true)
  }

  function toggleItem(id: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(id) ? list.filter(i => i !== id) : [...list, id])
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    const formData = new FormData(e.currentTarget)
    if (isActive) formData.set("isActive", "on")
    selectedGroups.forEach(id => formData.append("groupIds", id))
    selectedModules.forEach(id => formData.append("moduleIds", id))

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createUser(formData)
        } else {
          await updateUser(userId!, formData)
        }
        setOpen(false)
      } catch (err: any) {
        setError(err.message || "Erro ao salvar usuário.")
      }
    })
  }

  return (
    <>
      <span onClick={handleOpen} className="contents">{children}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl p-0 gap-0 overflow-hidden border border-slate-200/90 shadow-2xl rounded-2xl bg-white">
          {/* Header Fixo */}
          <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between bg-white select-none">
            <div className="flex items-center gap-3.5 pr-8">
              <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-green-dark shrink-0 shadow-xs">
                {mode === "create" ? (
                  <UserPlus className="w-5 h-5 text-green-dark" />
                ) : (
                  <UserCog className="w-5 h-5 text-green-dark" />
                )}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-navy tracking-tight">
                  {mode === "create" ? "Novo Usuário" : "Editar Usuário"}
                </DialogTitle>
                <p className="text-xs text-[#5F6775] mt-0.5">
                  {mode === "create" 
                    ? "Cadastre um novo operador e defina os grupos e permissões de acesso." 
                    : "Atualize as credenciais, status e acessos vinculados a esta conta."}
                </p>
              </div>
            </div>
          </div>

          {/* Formulário com Área Central Rolável e Rodapé Fixo */}
          <form onSubmit={handleSubmit} className="flex flex-col m-0">
            {/* Corpo Rolável */}
            <div className="px-6 py-5 max-h-[calc(85vh-140px)] overflow-y-auto overflow-x-hidden space-y-6 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
              
              {/* Seção: Dados Principais */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-wider">
                    Informações Pessoais & Credenciais
                  </span>
                  <div className="flex-1 h-[1px] bg-slate-100" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nome Completo */}
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Nome Completo <span className="text-red-500">*</span>
                    </Label>
                    <Input 
                      id="name" 
                      name="name" 
                      defaultValue={defaultName} 
                      placeholder="Ex: João da Silva" 
                      required 
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-green-dark focus:ring-2 focus:ring-green-500/20 transition-all shadow-xs"
                    />
                  </div>

                  {/* ID de Usuário */}
                  <div className="space-y-1.5">
                    <Label htmlFor="userid" className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1">
                      <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
                      ID de Usuário / Login
                    </Label>
                    <Input 
                      id="userid" 
                      name="userid" 
                      defaultValue={defaultUserid} 
                      placeholder="Ex: joao.silva ou u2501234" 
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:border-green-dark focus:ring-2 focus:ring-green-500/20 transition-all shadow-xs"
                    />
                  </div>

                  {/* E-mail */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      E-mail Institucional <span className="text-red-500">*</span>
                    </Label>
                    <Input 
                      id="email" 
                      name="email" 
                      type="email" 
                      defaultValue={defaultEmail} 
                      placeholder="email@unievangelica.edu.br" 
                      required 
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-green-dark focus:ring-2 focus:ring-green-500/20 transition-all shadow-xs"
                    />
                  </div>

                  {/* Senha */}
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                      {mode === "create" ? (
                        <>Senha de Acesso <span className="text-red-500">*</span></>
                      ) : (
                        <>Nova Senha <span className="text-slate-400 font-normal lowercase">(vazio p/ manter)</span></>
                      )}
                    </Label>
                    <Input 
                      id="password" 
                      name="password" 
                      type="password" 
                      placeholder="••••••••••••" 
                      required={mode === "create"} 
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-green-dark focus:ring-2 focus:ring-green-500/20 transition-all shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Seção: Status da Conta */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50/80 hover:bg-slate-50/90 rounded-xl border border-slate-200/80 transition-colors select-none">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center transition-colors shadow-xs",
                    isActive ? "bg-green-100 text-green-dark" : "bg-slate-200 text-slate-400"
                  )}>
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="isActive" className="text-sm font-bold text-navy cursor-pointer">
                        Status da Conta
                      </label>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                        isActive ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"
                      )}>
                        {isActive ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#5F6775] mt-0.5">
                      {isActive 
                        ? "Usuário autorizado a efetuar login e acessar os módulos liberados." 
                        : "Usuários inativos têm o acesso ao sistema bloqueado imediatamente."}
                    </p>
                  </div>
                </div>
                <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
              </div>

              {/* Seção: Grupos de Acesso */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between select-none">
                  <div>
                    <Label className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-navy" />
                      Grupos de Permissões
                    </Label>
                    <p className="text-[11px] text-[#5F6775]">O usuário herda todos os módulos e políticas atribuídos aos grupos vinculados.</p>
                  </div>
                  {selectedGroups.length > 0 && (
                    <Badge className="bg-navy text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      {selectedGroups.length} selecionado{selectedGroups.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                <div className="border border-slate-200/90 rounded-xl p-2.5 bg-slate-50/50">
                  {allGroups.length === 0 ? (
                    <p className="text-xs text-slate-400 italic p-3 text-center">Nenhum grupo cadastrado no sistema.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1 [scrollbar-width:thin]">
                      {allGroups.map(g => {
                        const isSelected = selectedGroups.includes(g.id);
                        return (
                          <div
                            key={g.id}
                            onClick={() => toggleItem(g.id, selectedGroups, setSelectedGroups)}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all cursor-pointer select-none",
                              isSelected
                                ? "bg-white border-navy text-navy font-semibold shadow-xs ring-1 ring-navy/10"
                                : "bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-700"
                            )}
                          >
                            <Checkbox
                              id={`group-${g.id}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleItem(g.id, selectedGroups, setSelectedGroups)}
                              className="data-[state=checked]:bg-navy data-[state=checked]:border-navy shrink-0"
                            />
                            <span className="text-xs font-medium truncate flex-1">{g.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Seção: Sistemas / Módulos Avulsos */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between select-none">
                  <div>
                    <Label className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-green-dark" />
                      Sistemas e Módulos Avulsos
                    </Label>
                    <p className="text-[11px] text-[#5F6775]">Concede acesso direto a módulos específicos, além dos herdados pelo grupo.</p>
                  </div>
                  {selectedModules.length > 0 && (
                    <Badge className="bg-green-100 text-green-800 border border-green-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      {selectedModules.length} avulso{selectedModules.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                <div className="border border-slate-200/90 rounded-xl p-2.5 bg-slate-50/50">
                  {allModules.length === 0 ? (
                    <p className="text-xs text-slate-400 italic p-3 text-center">Nenhum sistema cadastrado.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1 [scrollbar-width:thin]">
                      {allModules.map(m => {
                        const isSelected = selectedModules.includes(m.id);
                        return (
                          <div
                            key={m.id}
                            onClick={() => toggleItem(m.id, selectedModules, setSelectedModules)}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all cursor-pointer select-none",
                              isSelected
                                ? "bg-white border-green-dark text-green-900 font-semibold shadow-xs ring-1 ring-green-500/20"
                                : "bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-700"
                            )}
                          >
                            <Checkbox
                              id={`module-${m.id}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleItem(m.id, selectedModules, setSelectedModules)}
                              className="data-[state=checked]:bg-green-dark data-[state=checked]:border-green-dark shrink-0"
                            />
                            <span className="text-xs font-medium truncate flex-1">{m.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Mensagem de Erro */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Rodapé Fixo de Ações */}
            <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-3 select-none">
              <p className="text-[11px] text-[#9AA0AC] hidden sm:block">
                <span className="text-red-500 font-bold">*</span> Campos de preenchimento obrigatório
              </p>
              <div className="flex items-center gap-2.5 ml-auto">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setOpen(false)}
                  className="border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium px-4 h-9 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-green-dark hover:bg-green-brand text-white font-bold px-5 h-9 rounded-xl shadow-sm gap-2 transition-all cursor-pointer active:scale-98" 
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{mode === "create" ? "Criar Usuário" : "Salvar Alterações"}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
