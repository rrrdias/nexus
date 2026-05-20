"use client"

import React from "react"
import Notas from "../_legacy/pages/relatorios/Notas"
import dynamic from 'next/dynamic'

const NotasClient = dynamic(() => Promise.resolve(Notas), {
  ssr: false
})

export default function NotasPage() {
  return <NotasClient />
}
