import type { ClipDir, MotionOrigin } from "./catalog.ts"
import type { MotionState } from "./state.ts"

export type MotionCss = {
  transform: string
  opacity: number
  filter?: string
  clipPath?: string
  transformOrigin?: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Insets em % do box. Negativo é folga para contorno e sombra não serem cortados. */
export function clipInsets(clip: number, dir: ClipDir): { top: number; right: number; bottom: number; left: number } {
  const open = -30
  const closed = 130
  const edge = open + (closed - open) * clamp(clip, 0, 1)
  const insets = { top: open, right: open, bottom: open, left: open }
  if (dir === "esq") insets.left = edge
  else if (dir === "dir") insets.right = edge
  else if (dir === "cima") insets.top = edge
  else insets.bottom = edge
  return insets
}

export function clipPathCss(clip: number, dir: ClipDir): string {
  const insets = clipInsets(clip, dir)
  return `inset(${insets.top}% ${insets.right}% ${insets.bottom}% ${insets.left}%)`
}

export function clipRect(
  clip: number,
  dir: ClipDir,
  box: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  const insets = clipInsets(clip, dir)
  const left = box.x + (insets.left / 100) * box.w
  const top = box.y + (insets.top / 100) * box.h
  const right = box.x + box.w - (insets.right / 100) * box.w
  const bottom = box.y + box.h - (insets.bottom / 100) * box.h
  return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) }
}

/** Raio do brilho no quadro 1080. O canvas usa este valor; no CSS ele multiplica pela escala do preview. */
export function frameGlowRadius(glow: number): number {
  return 8 + glow * 24
}

export function motionCss(
  pose: MotionState,
  options: { clipDir?: ClipDir; origin?: MotionOrigin; accent?: string; pixelScale?: number } = {},
): MotionCss {
  const pixelScale = options.pixelScale && options.pixelScale > 0 ? options.pixelScale : 1
  const scaleX = pose.scale * pose.scaleX
  const scaleY = pose.scale * pose.scaleY
  const css: MotionCss = {
    transform: `translate(${pose.x * pixelScale}px, ${pose.y * pixelScale}px) rotateX(${pose.rotateX}deg) rotateY(${pose.rotateY}deg) rotate(${pose.rotate}deg) skewX(${pose.skewX}deg) scale(${scaleX}, ${scaleY})`,
    opacity: pose.opacity,
  }
  const filters: string[] = []
  if (pose.blur > 0) filters.push(`blur(${pose.blur * pixelScale}px)`)
  if (pose.brightness !== 1) filters.push(`brightness(${pose.brightness})`)
  if (pose.glow > 0 && options.accent) {
    filters.push(`drop-shadow(0 0 ${frameGlowRadius(pose.glow) * pixelScale}px ${options.accent})`)
  }
  if (filters.length > 0) css.filter = filters.join(" ")
  if (pose.clip > 0 || options.clipDir) css.clipPath = clipPathCss(pose.clip, options.clipDir ?? "esq")
  if (options.origin === "base") css.transformOrigin = "50% 100%"
  if (options.origin === "topo") css.transformOrigin = "50% 0%"
  return css
}
