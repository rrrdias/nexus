"use client"

import { useTransition } from "react"
import { Switch } from "@/components/ui/switch"
import { toggleUserActive } from "@/app/actions/users"

interface Props {
  userId: string
  isActive: boolean
}

export function ToggleUserButton({ userId, isActive }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      await toggleUserActive(userId, !isActive)
    })
  }

  return (
    <Switch
      checked={isActive}
      onCheckedChange={handleToggle}
      disabled={isPending}
    />
  )
}
