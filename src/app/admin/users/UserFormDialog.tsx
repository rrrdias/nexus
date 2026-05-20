"use client"

import { useState, useTransition } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { createUser, updateUser } from "@/app/actions/users"
import { Loader2 } from "lucide-react"

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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-navy font-extrabold">
              {mode === "create" ? "Novo Usuário" : "Editar Usuário"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 mt-2">
            {/* Dados Pessoais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-semibold text-[#5F6775]">Nome Completo</Label>
                <Input id="name" name="name" defaultValue={defaultName} placeholder="Nome do usuário" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="userid" className="text-sm font-semibold text-[#5F6775]">ID de Usuário</Label>
                <Input id="userid" name="userid" defaultValue={defaultUserid} placeholder="Ex: u2501234 ou joao.silva" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-semibold text-[#5F6775]">E-mail</Label>
                <Input id="email" name="email" type="email" defaultValue={defaultEmail} placeholder="email@dominio.com" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-semibold text-[#5F6775]">
                  {mode === "create" ? "Senha" : "Nova Senha (deixe em branco para manter)"}
                </Label>
                <Input id="password" name="password" type="password" placeholder="••••••••" required={mode === "create"} />
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
              <div>
                <label htmlFor="isActive" className="text-sm font-semibold text-navy cursor-pointer">Usuário Ativo</label>
                <p className="text-[11px] text-[#9AA0AC]">Usuários inativos não conseguem fazer login</p>
              </div>
            </div>

            {/* Grupos */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-[#5F6775]">Grupos</Label>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-36 overflow-y-auto">
                {allGroups.length === 0
                  ? <p className="text-sm text-[#9AA0AC] italic p-3">Nenhum grupo cadastrado.</p>
                  : allGroups.map(g => (
                    <div key={g.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                      <Checkbox
                        id={`group-${g.id}`}
                        checked={selectedGroups.includes(g.id)}
                        onCheckedChange={() => toggleItem(g.id, selectedGroups, setSelectedGroups)}
                      />
                      <label htmlFor={`group-${g.id}`} className="text-sm font-medium text-navy cursor-pointer flex-1">{g.name}</label>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Sistemas Avulsos */}
            <div className="space-y-2">
              <div>
                <Label className="text-sm font-semibold text-[#5F6775]">Sistemas Avulsos</Label>
                <p className="text-[11px] text-[#9AA0AC] mt-0.5">Concede acesso direto a sistemas, além dos herdados pelo grupo.</p>
              </div>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-36 overflow-y-auto">
                {allModules.length === 0
                  ? <p className="text-sm text-[#9AA0AC] italic p-3">Nenhum sistema cadastrado.</p>
                  : allModules.map(m => (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                      <Checkbox
                        id={`module-${m.id}`}
                        checked={selectedModules.includes(m.id)}
                        onCheckedChange={() => toggleItem(m.id, selectedModules, setSelectedModules)}
                      />
                      <label htmlFor={`module-${m.id}`} className="text-sm font-medium text-navy cursor-pointer flex-1">{m.name}</label>
                    </div>
                  ))
                }
              </div>
            </div>

            {error && <p className="text-xs text-[#E53935] font-semibold">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-green-dark hover:bg-green-brand text-white" disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {mode === "create" ? "Criar Usuário" : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
