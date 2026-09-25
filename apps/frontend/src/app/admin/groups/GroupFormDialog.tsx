"use client"

import { useState, useTransition } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { createGroup, updateGroup } from "@/app/actions/groups"
import { 
  Loader2, 
  ShieldCheck, 
  Layers, 
  AlertCircle, 
  Check, 
  Users
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Module { id: string; name: string; description?: string | null }

interface Props {
  children: React.ReactNode
  allModules: Module[]
  mode: "create" | "edit"
  groupId?: string
  defaultName?: string
  defaultDescription?: string
  defaultModuleIds?: string[]
}

export function GroupFormDialog({
  children, allModules, mode,
  groupId, defaultName = "", defaultDescription = "", defaultModuleIds = []
}: Props) {
  const [open, setOpen] = useState(false)
  const [selectedModules, setSelectedModules] = useState<string[]>(defaultModuleIds)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function handleOpen() {
    setSelectedModules(defaultModuleIds)
    setError("")
    setOpen(true)
  }

  function handleModuleToggle(id: string) {
    setSelectedModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    const formData = new FormData(e.currentTarget)
    selectedModules.forEach(id => formData.append("moduleIds", id))

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createGroup(formData)
        } else {
          await updateGroup(groupId!, formData)
        }
        setOpen(false)
      } catch (err: any) {
        setError(err.message || "Erro ao salvar grupo.")
      }
    })
  }

  return (
    <>
      <span onClick={handleOpen} className="contents">{children}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg md:max-w-xl p-0 gap-0 overflow-hidden border border-slate-200/90 shadow-2xl rounded-2xl bg-white">
          {/* Header Fixo */}
          <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between bg-white select-none">
            <div className="flex items-center gap-3.5 pr-8">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-navy shrink-0 shadow-xs">
                <ShieldCheck className="w-5 h-5 text-navy" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-navy tracking-tight">
                  {mode === "create" ? "Novo Grupo de Acesso" : "Editar Grupo de Acesso"}
                </DialogTitle>
                <p className="text-xs text-[#5F6775] mt-0.5">
                  {mode === "create"
                    ? "Defina um perfil de permissões e vincule os módulos correspondentes."
                    : "Atualize os dados e os módulos permitidos para este grupo."}
                </p>
              </div>
            </div>
          </div>

          {/* Formulário com Área Central Rolável e Rodapé Fixo */}
          <form onSubmit={handleSubmit} className="flex flex-col m-0">
            {/* Corpo Rolável */}
            <div className="px-6 py-5 max-h-[calc(85vh-140px)] overflow-y-auto overflow-x-hidden space-y-5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
              
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  Nome do Grupo <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="name" 
                  name="name" 
                  defaultValue={defaultName} 
                  placeholder="Ex: Coordenadores Pedagógicos, Secretaria..." 
                  required 
                  className="h-10 rounded-xl border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-navy focus:ring-2 focus:ring-navy/10 transition-all shadow-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs font-bold text-navy uppercase tracking-wider">
                  Descrição das Atribuições
                </Label>
                <Textarea 
                  id="description" 
                  name="description" 
                  defaultValue={defaultDescription} 
                  placeholder="Descreva a finalidade e as permissões atribuídas a este grupo..." 
                  rows={2} 
                  className="rounded-xl border-slate-200 bg-white p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-navy focus:ring-2 focus:ring-navy/10 transition-all shadow-xs resize-none"
                />
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between select-none">
                  <div>
                    <Label className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-green-dark" />
                      Módulos com Acesso Liberado
                    </Label>
                    <p className="text-[11px] text-[#5F6775]">Todos os membros deste grupo terão acesso aos módulos marcados.</p>
                  </div>
                  {selectedModules.length > 0 && (
                    <Badge className="bg-navy text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      {selectedModules.length} liberado{selectedModules.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                <div className="border border-slate-200/90 rounded-xl p-2.5 bg-slate-50/50">
                  {allModules.length === 0 ? (
                    <p className="text-xs text-slate-400 italic p-3 text-center">Nenhum sistema cadastrado.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 [scrollbar-width:thin]">
                      {allModules.map(m => {
                        const isSelected = selectedModules.includes(m.id);
                        return (
                          <div 
                            key={m.id} 
                            onClick={() => handleModuleToggle(m.id)}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all cursor-pointer select-none",
                              isSelected 
                                ? "bg-white border-navy text-navy font-semibold shadow-xs ring-1 ring-navy/10" 
                                : "bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-700"
                            )}
                          >
                            <Checkbox
                              id={`module-${m.id}`}
                              checked={isSelected}
                              onCheckedChange={() => handleModuleToggle(m.id)}
                              className="data-[state=checked]:bg-navy data-[state=checked]:border-navy shrink-0"
                            />
                            <span className="text-xs font-medium truncate flex-1">{m.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Rodapé Fixo */}
            <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-3 select-none">
              <p className="text-[11px] text-[#9AA0AC] hidden sm:block">
                <span className="text-red-500 font-bold">*</span> Campo obrigatório
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
                      <span>{mode === "create" ? "Criar Grupo" : "Salvar Alterações"}</span>
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
