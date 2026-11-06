import { isEditableTarget } from "../is-editable-target.ts"
import { insertIdOf, type PreviewSelection } from "../preview-selection.ts"

export const NUDGE_HINT = "← → ↑ ↓ move 1% · Shift + seta move 5%"

export function shouldIgnoreGlobalKey(event: {
  defaultPrevented: boolean
  target: EventTarget | null
}): boolean {
  return event.defaultPrevented || isEditableTarget(event.target)
}

export function isInsideRovingGroup(target: EventTarget | null): boolean {
  if (typeof Element === "undefined") return false
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest("[data-slot='toggle-group']") ||
      target.closest("[role='radiogroup']") ||
      target.closest("[data-preview-overlay]"),
  )
}

export function canHandleInsertNudge(
  event: { defaultPrevented: boolean; target: EventTarget | null },
  selectedInsertId: string | null,
): boolean {
  if (shouldIgnoreGlobalKey(event)) return false
  if (isInsideRovingGroup(event.target)) return false
  if (typeof Element === "undefined") return false
  if (!(event.target instanceof Element)) return false
  if (event.target.closest("[data-preview-stage]")) return true
  if (!selectedInsertId) return false
  const card = event.target.closest("[data-insert-card]")
  return card instanceof HTMLElement && card.dataset.insertId === selectedInsertId
}

export function canHandlePreviewNudge(
  event: { defaultPrevented: boolean; target: EventTarget | null },
  selection: PreviewSelection,
): boolean {
  if (selection?.kind === "source") {
    return canHandleInsertNudge(event, "source")
  }
  return canHandleInsertNudge(event, insertIdOf(selection))
}

export const TRIM_HINT = "I marca a entrada · O marca a saída"
export const SPLIT_HINT = "S divide o vídeo no ponto atual; cada trecho tem zoom próprio"

export type TimelineKeyAction = "in" | "out" | "split"

/**
 * Atalhos da linha do tempo: I = entrada, O = saída, S = dividir.
 * Ignora digitação e combinações com modificador (Ctrl+S continua sendo do navegador).
 */
export function timelineKeyAction(event: {
  key: string
  defaultPrevented: boolean
  target: EventTarget | null
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  repeat?: boolean
}): TimelineKeyAction | null {
  if (shouldIgnoreGlobalKey(event)) return null
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return null
  const key = event.key.toLowerCase()
  if (key === "i") return "in"
  if (key === "o") return "out"
  if (key === "s") return "split"
  return null
}

export const FRAME_STEP_HINT = "← → anda 1 quadro · Shift + seta anda 10 · , e . também"

/**
 * Quantos quadros andar com ← → (Shift = 10) ou , e . (sempre 1).
 * As setas ficam com o nudge quando há algo selecionado e o foco está no
 * palco ou no card dele; nesse caso devolve null.
 */
export function frameStepKeyAction(
  event: {
    key: string
    defaultPrevented: boolean
    target: EventTarget | null
    shiftKey?: boolean
    ctrlKey?: boolean
    metaKey?: boolean
    altKey?: boolean
  },
  selection: PreviewSelection,
): number | null {
  if (shouldIgnoreGlobalKey(event)) return null
  if (event.ctrlKey || event.metaKey || event.altKey) return null
  if (event.key === ",") return -1
  if (event.key === ".") return 1
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return null
  if (isInsideRovingGroup(event.target)) return null
  if (selection && canHandlePreviewNudge(event, selection)) return null
  const step = event.shiftKey ? 10 : 1
  return event.key === "ArrowLeft" ? -step : step
}

export const OVERLAY_MODES = ["none", "safe", "feed"] as const
export type OverlayModeId = (typeof OVERLAY_MODES)[number]

export function cycleOverlayMode(
  current: OverlayModeId,
  key: string,
): OverlayModeId | null {
  const index = OVERLAY_MODES.indexOf(current)
  if (index < 0) return null
  if (key === "ArrowRight" || key === "ArrowDown") {
    return OVERLAY_MODES[(index + 1) % OVERLAY_MODES.length] ?? current
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return OVERLAY_MODES[(index - 1 + OVERLAY_MODES.length) % OVERLAY_MODES.length] ?? current
  }
  return null
}
