"use client"

import React, { useEffect, useRef } from "react"
import { logoutAction } from "@/app/actions/auth"

const IDLE_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutos de inatividade total

export function IdleTimeoutProvider({ children, basePath = "" }: { children: React.ReactNode, basePath?: string }) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(handleLogout, IDLE_TIMEOUT_MS)
  }

  const handleLogout = () => {
    console.log("[IdleTimeout] Usuário inativo por 15 minutos. Efetuando logout de segurança automático...")
    logoutAction()
  }

  useEffect(() => {
    // Eventos que indicam atividade física do usuário na tela
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"]

    const handleActivity = () => {
      resetTimer()
    }

    // Registrar ouvintes de atividade
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // Iniciar contagem regressiva
    resetTimer()

    // Cleanup dos eventos e temporizador ao desmontar
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return <>{children}</>
}
