"use client"

import type { ReactNode } from "react"
import { AlertCircle, Check, Loader2, Redo2, Undo2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type SaveStatus = "saved" | "saving" | "error"

const SAVE_STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "Salvo",
  saving: "Salvando…",
  error: "Não salvo",
}

export function SaveIndicator({ status }: { status: SaveStatus }) {
  const Icon = status === "saving" ? Loader2 : status === "error" ? AlertCircle : Check
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-1 text-xs",
        status === "error" ? "text-destructive" : "text-muted-foreground",
      )}
      title={
        status === "error"
          ? "O navegador recusou salvar o projeto (armazenamento cheio ou bloqueado)."
          : "O projeto fica salvo neste navegador."
      }
    >
      <Icon className={cn("size-3.5", status === "saving" && "animate-spin")} aria-hidden />
      {SAVE_STATUS_LABEL[status]}
    </span>
  )
}

export function EditorHeaderActions({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saveStatus,
  exportMenu,
}: {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  saveStatus: SaveStatus
  exportMenu: ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center" role="group" aria-label="Histórico">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!canUndo}
          onClick={onUndo}
          aria-label="Desfazer"
          aria-keyshortcuts="Control+Z Meta+Z"
          title="Desfazer (Ctrl+Z)"
        >
          <Undo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!canRedo}
          onClick={onRedo}
          aria-label="Refazer"
          aria-keyshortcuts="Control+Shift+Z Control+Y Meta+Shift+Z"
          title="Refazer (Ctrl+Shift+Z)"
        >
          <Redo2 />
        </Button>
      </div>
      <SaveIndicator status={saveStatus} />
      {exportMenu}
    </div>
  )
}
