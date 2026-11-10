export type FillMode = "none" | "pingpong" | "loop" | "freeze"
export type FitMode = "video" | "audio" | "manual"

export interface SourcePlayback {
  speed: number
  fill: FillMode
  fit: FitMode
  /** Segundos de saída. Só vale com fit `manual`. */
  targetDuration?: number
}

export const PLAYBACK_SPEED_MIN = 0.5
export const PLAYBACK_SPEED_MAX = 2
export const DEFAULT_PLAYBACK: SourcePlayback = { speed: 1, fill: "none", fit: "video" }

const FILLS: readonly FillMode[] = ["none", "pingpong", "loop", "freeze"]
const FITS: readonly FitMode[] = ["video", "audio", "manual"]

export function clampPlaybackSpeed(value: number): number {
  if (!Number.isFinite(value)) return 1
  const clamped = Math.min(PLAYBACK_SPEED_MAX, Math.max(PLAYBACK_SPEED_MIN, value))
  return Math.round(clamped * 100) / 100
}

export function isFillMode(value: unknown): value is FillMode {
  return typeof value === "string" && FILLS.includes(value as FillMode)
}

export function isFitMode(value: unknown): value is FitMode {
  return typeof value === "string" && FITS.includes(value as FitMode)
}

export function parsePlayback(raw: unknown): SourcePlayback {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_PLAYBACK }
  const record = raw as Record<string, unknown>
  const speed = typeof record.speed === "number" ? clampPlaybackSpeed(record.speed) : 1
  const fill = isFillMode(record.fill) ? record.fill : "none"
  const fit = isFitMode(record.fit) ? record.fit : "video"
  const target = typeof record.targetDuration === "number" && record.targetDuration > 0
    ? record.targetDuration
    : undefined
  return {
    speed,
    fill,
    fit,
    ...(fit === "manual" && target ? { targetDuration: target } : {}),
  }
}

export function isIdentityPlayback(playback: SourcePlayback | undefined): boolean {
  const value = playback ?? DEFAULT_PLAYBACK
  return value.speed === 1 && value.fill === "none" && value.fit === "video"
}

export function formatSpeedLabel(speed: number): string {
  return `${speed.toFixed(2).replace(".", ",")}×`
}

const FILL_LABEL: Record<FillMode, string> = {
  none: "Normal",
  pingpong: "Ping-pong",
  loop: "Loop",
  freeze: "Congelar",
}

export function formatPlaybackSummary(input: {
  playback: SourcePlayback
  outputSeconds: number
  videoSeconds: number
}): string {
  const speed = formatSpeedLabel(input.playback.speed)
  const output = input.outputSeconds.toFixed(1).replace(".", ",")
  const video = input.videoSeconds.toFixed(1).replace(".", ",")
  const fill = input.playback.fill === "none" ? null : FILL_LABEL[input.playback.fill]
  const head = fill ? `${fill} · ${speed}` : speed
  return `${head} · ${output} s (vídeo ${video} s)`
}
