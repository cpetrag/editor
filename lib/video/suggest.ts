import { formatSpeedLabel, type FillMode, type SourcePlayback } from "./playback.ts"

export interface FitSuggestion {
  fill: FillMode
  speed: number
  fit: "audio"
  label: string
}

const PING_MIN = 0.8
const PING_MAX = 1.2
const MAX_PASSES = 4

function roundSpeed(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Como esticar o vídeo até a locução sem passar de câmera lenta nem de um
 * ping-pong longo demais. No máximo 4 metades (ida, volta, ida, volta):
 * um clipe de 2 s até 15 s não acha velocidade em [0,8, 1,2] e cai no
 * ping-pong a 1× com corte no fim.
 */
export function suggestFit(videoLen: number, target: number): FitSuggestion | null {
  if (!(videoLen > 0) || !(target > videoLen + 1e-6)) return null
  const gap = target - videoLen
  if (gap < 1) {
    return { fill: "freeze", speed: 1, fit: "audio", label: "Congelar a 1×" }
  }
  if (target / videoLen <= 1.25) {
    const speed = Math.max(PING_MIN, roundSpeed(videoLen / target))
    return { fill: "none", speed, fit: "audio", label: `Velocidade ${formatSpeedLabel(speed)}` }
  }
  let best: { speed: number; distance: number } | null = null
  for (let passes = 2; passes <= MAX_PASSES; passes += 1) {
    const speed = roundSpeed((passes * videoLen) / target)
    if (speed < PING_MIN - 1e-9 || speed > PING_MAX + 1e-9) continue
    const distance = Math.abs(speed - 1)
    if (!best || distance < best.distance - 1e-9) best = { speed, distance }
  }
  if (best) {
    return {
      fill: "pingpong",
      speed: best.speed,
      fit: "audio",
      label: `Ping-pong a ${formatSpeedLabel(best.speed)}`,
    }
  }
  return { fill: "pingpong", speed: 1, fit: "audio", label: "Ping-pong a 1×" }
}

export function suggestionPlayback(suggestion: FitSuggestion, targetDuration: number): SourcePlayback {
  return {
    speed: suggestion.speed,
    fill: suggestion.fill,
    fit: "audio",
    ...(suggestion.fill === "none" ? {} : { targetDuration }),
  }
}
