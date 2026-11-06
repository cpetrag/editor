"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

/** Linha de preset: miniatura, nome, Trocar e menu. A grade só abre no Trocar. */
export function PresetPickerRow({
  label,
  thumb,
  open,
  onToggle,
  disabled = false,
  menu,
  gridLabel,
  children,
}: {
  label: string
  thumb: ReactNode
  open: boolean
  onToggle: () => void
  disabled?: boolean
  menu?: ReactNode
  gridLabel: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {thumb}
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{label}</p>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={disabled}
          aria-expanded={open}
          onClick={onToggle}
        >
          Trocar
        </Button>
        {menu}
      </div>
      {open ? (
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={gridLabel}>
          {children}
        </div>
      ) : null}
    </div>
  )
}
