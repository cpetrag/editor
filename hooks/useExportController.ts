"use client"

import { useEffect, useRef, useState } from "react"

import type { ExportMode } from "@/lib/export/final-client"

export type ExportAnchor = "header" | "footer"

export function useExportController(input: {
  exporting: boolean
  exportMode: ExportMode
  progress: number
  error: string | null
  fileName: string
}) {
  const [anchor, setAnchor] = useState<ExportAnchor | null>(null)
  const [successName, setSuccessName] = useState<string | null>(null)
  const wasExporting = useRef(false)

  useEffect(() => {
    if (wasExporting.current && !input.exporting && !input.error) {
      const stem = input.fileName.trim() || "video"
      setSuccessName(stem.toLowerCase().endsWith(".mp4") ? stem : `${stem}.mp4`)
      setAnchor(null)
      const timer = window.setTimeout(() => setSuccessName(null), 4000)
      wasExporting.current = false
      return () => window.clearTimeout(timer)
    }
    wasExporting.current = input.exporting
  }, [input.error, input.exporting, input.fileName])

  const percent = Math.round(Math.max(0, Math.min(1, input.progress)) * 100)

  function triggerLabel(place: ExportAnchor): string {
    if (input.exporting) {
      return input.exportMode === "final" ? `Gerando no Mac… ${percent}%` : `Exportando ${percent}%`
    }
    if (input.error) return "Falhou — ver detalhes"
    if (successName) return `✓ Exportado — ${successName}`
    return place === "footer" ? "Exportar vídeo" : "Exportar"
  }

  return {
    isOpen: (place: ExportAnchor) => anchor === place,
    setOpen: (place: ExportAnchor, open: boolean) => setAnchor(open ? place : anchor === place ? null : anchor),
    open: (place: ExportAnchor) => setAnchor(place),
    triggerLabel,
    percent,
  }
}
