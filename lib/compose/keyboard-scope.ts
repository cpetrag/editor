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
