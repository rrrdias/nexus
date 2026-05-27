"use client"

import { useState, useTransition } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { createGroup, updateGroup } from "@/app/actions/groups"
import { Loader2 } from "lucide-react"

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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-navy font-extrabold">
              {mode === "create" ? "Novo Grupo" : "Editar Grupo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-semibold text-[#5F6775]">Nome do Grupo</Label>
              <Input id="name" name="name" defaultValue={defaultName} placeholder="Ex: Secretaria, Professores..." required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm font-semibold text-[#5F6775]">Descrição</Label>
              <Textarea id="description" name="description" defaultValue={defaultDescription} placeholder="Descreva brevemente as permissões deste grupo..." rows={2} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-[#5F6775]">Sistemas com Acesso</Label>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {allModules.length === 0 && (
                  <p className="text-sm text-[#9AA0AC] italic p-3">Nenhum sistema cadastrado.</p>
                )}
                {allModules.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                    <Checkbox
                      id={`module-${m.id}`}
                      checked={selectedModules.includes(m.id)}
                      onCheckedChange={() => handleModuleToggle(m.id)}
                    />
                    <label htmlFor={`module-${m.id}`} className="text-sm font-medium text-navy cursor-pointer flex-1">{m.name}</label>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-[#E53935] font-semibold">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-green-dark hover:bg-green-brand text-white" disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {mode === "create" ? "Criar Grupo" : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
