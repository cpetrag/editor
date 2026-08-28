export function isEditableTarget(target: EventTarget | null): boolean {
  if (target == null) return false
  if (typeof HTMLElement === "undefined") return false
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
}
