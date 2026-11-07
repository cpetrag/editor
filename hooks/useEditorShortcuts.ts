"use client"

import { useEffect, useRef } from "react"

import { transportShortcut, type TransportShortcut } from "@/lib/editor-shortcuts"

export type EditorShortcutHandlers = {
  /** Quando verdadeiro, só "?" continua ativo (painel de ajuda ou export). */
  blocked?: boolean
  onHelp: () => void
  onTogglePlay: () => void | false
  onSplit: () => void | false
  onMarkIn: () => void | false
  onMarkOut: () => void | false
  onStepFrames: (frames: number) => void | false
  onSeekSeconds: (delta: number) => void | false
  onSeekStart: () => void | false
  onSeekEnd: () => void | false
  onDeleteSelection: () => void | false
  onUndo: () => void | false
  onRedo: () => void | false
  onExport: () => void | false
}

function runShortcut(action: TransportShortcut, handlers: EditorShortcutHandlers): void | false {
  switch (action) {
    case "help":
      handlers.onHelp()
      return
    case "toggle-play":
      return handlers.onTogglePlay()
    case "split":
      return handlers.onSplit()
    case "mark-in":
      return handlers.onMarkIn()
    case "mark-out":
      return handlers.onMarkOut()
    case "step-back-frame":
      return handlers.onStepFrames(-1)
    case "step-forward-frame":
      return handlers.onStepFrames(1)
    case "step-back-second":
      return handlers.onSeekSeconds(-1)
    case "step-forward-second":
      return handlers.onSeekSeconds(1)
    case "seek-start":
      return handlers.onSeekStart()
    case "seek-end":
      return handlers.onSeekEnd()
    case "delete-selection":
      return handlers.onDeleteSelection()
    case "undo":
      return handlers.onUndo()
    case "redo":
      return handlers.onRedo()
    case "export":
      return handlers.onExport()
    default:
      return false
  }
}

/** Atalhos globais do editor. Não dispara dentro de input, textarea ou contenteditable. */
export function useEditorShortcuts(handlers: EditorShortcutHandlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const action = transportShortcut(event)
      if (!action) return
      const current = handlersRef.current
      if (current.blocked && action !== "help") return
      const consumed = runShortcut(action, current)
      if (consumed !== false) event.preventDefault()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
