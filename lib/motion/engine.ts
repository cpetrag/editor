import type { Animation, AnimTarget } from "../style/types.ts"
import { loopById } from "./catalog.ts"
import { ease, springProgress } from "./easings.ts"
import { hash01 } from "./hash.ts"
import { intensifyDistance, MOTION_IDENTITY, type MotionState } from "./state.ts"

export type MotionSpec = {
  animation: Animation
  startFrame: number
  durationInFrames: number
}

type Order = NonNullable<Animation["order"]>

const LEGACY_LOOP = new Set(["nenhum", "pulse", "shake", "float"])

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

function playbackSpeed(animation: Animation): number {
  const speed = animation.speed
  return speed != null && speed > 0 ? speed : 1
}

function intensityOf(animation: Animation): number {
  return animation.intensity ?? 1
}

function resolveTarget(partial: AnimTarget | undefined): MotionState {
  return {
    scale: partial?.scale ?? MOTION_IDENTITY.scale,
    scaleX: partial?.scaleX ?? MOTION_IDENTITY.scaleX,
    scaleY: partial?.scaleY ?? MOTION_IDENTITY.scaleY,
    x: partial?.x ?? MOTION_IDENTITY.x,
    y: partial?.y ?? MOTION_IDENTITY.y,
    rotate: partial?.rotate ?? MOTION_IDENTITY.rotate,
    rotateX: partial?.rotateX ?? MOTION_IDENTITY.rotateX,
    rotateY: partial?.rotateY ?? MOTION_IDENTITY.rotateY,
    skewX: partial?.skewX ?? MOTION_IDENTITY.skewX,
    opacity: partial?.opacity ?? MOTION_IDENTITY.opacity,
    blur: partial?.blur ?? MOTION_IDENTITY.blur,
    clip: partial?.clip ?? MOTION_IDENTITY.clip,
    jitter: partial?.jitter ?? MOTION_IDENTITY.jitter,
    brightness: MOTION_IDENTITY.brightness,
    glow: MOTION_IDENTITY.glow,
  }
}

function mixPose(from: MotionState, to: MotionState, t: number): MotionState {
  return {
    scale: lerp(from.scale, to.scale, t),
    scaleX: lerp(from.scaleX, to.scaleX, t),
    scaleY: lerp(from.scaleY, to.scaleY, t),
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    rotate: lerp(from.rotate, to.rotate, t),
    rotateX: lerp(from.rotateX, to.rotateX, t),
    rotateY: lerp(from.rotateY, to.rotateY, t),
    skewX: lerp(from.skewX, to.skewX, t),
    opacity: lerp(from.opacity, to.opacity, t),
    blur: lerp(from.blur, to.blur, t),
    clip: lerp(from.clip, to.clip, t),
    jitter: lerp(from.jitter, to.jitter, t),
    brightness: lerp(from.brightness, to.brightness, t),
    glow: lerp(from.glow, to.glow, t),
  }
}

function progressAt(
  local: number,
  durationInFrames: number,
  easing: Animation["enter"]["easing"],
  overshoot: number,
  fps: number,
  speed: number,
): number {
  if (durationInFrames <= 0) return local >= 0 ? 1 : 0
  if (easing === "spring") return springProgress(local * speed, fps, overshoot)
  const linear = clamp(local / durationInFrames, 0, 1)
  return ease(easing, linear)
}

function fittedPhaseDurations(
  animation: Animation,
  cardDurationFrames: number,
  speed: number,
): { enter: number; exit: number } {
  let enter = Math.max(0, animation.enter.durationInFrames) / speed
  let exit = Math.max(0, animation.exit.durationInFrames) / speed
  const span = enter + exit
  if (span > cardDurationFrames && span > 0) {
    const k = cardDurationFrames / span
    enter *= k
    exit *= k
  }
  return { enter, exit }
}

/** Posição na fila do stagger. `inicio` devolve o rank cru, mesmo se unitCount for menor. */
export function unitStaggerIndex(order: Order | undefined, rank: number, unitCount: number, seed: number): number {
  if (!order || order === "inicio") return rank
  const count = Math.max(1, unitCount, rank + 1)
  if (order === "fim") return count - 1 - rank
  if (order === "centro") {
    const center = (count - 1) / 2
    const items = [...Array(count).keys()].sort((a, b) => {
      const distance = Math.abs(a - center) - Math.abs(b - center)
      return distance !== 0 ? distance : a - b
    })
    const slot = items.indexOf(rank)
    return slot < 0 ? rank : slot
  }
  const items = [...Array(count).keys()]
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(hash01(seed, index, 17) * (index + 1))
    const current = items[index]!
    items[index] = items[swap]!
    items[swap] = current
  }
  const slot = items.indexOf(rank)
  return slot < 0 ? rank : slot
}

function legacyLoop(loop: Animation["loop"]): boolean {
  return !loop.recipeId && LEGACY_LOOP.has(loop.type)
}

function percentAmplitude(loop: Animation["loop"], intensity: number): number {
  const recipe = loop.recipeId ? loopById(loop.recipeId) : loopById(loop.type)
  const raw = loop.amplitude * intensity
  if (recipe?.unitLabel === "%") return raw / 100
  return raw
}

function sine(speed: number, seconds: number, phase = 0): number {
  return Math.sin(2 * Math.PI * speed * seconds + phase)
}

/**
 * pulse/shake/float sem recipeId mantêm o seno no frame absoluto da composição,
 * inclusive durante a entrada. Loops novos sobem só depois da última unidade entrar.
 */
function loopEnvelope(
  localFrame: number,
  phases: { enter: number; exit: number },
  animation: Animation,
  unitCount: number,
  durationInFrames: number,
  speed: number,
): number {
  const stagger = animation.enter.staggerInFrames / speed
  const delay = animation.enter.delayInFrames / speed
  const lastSlot = Math.max(0, unitCount - 1)
  const riseStart = delay + lastSlot * stagger + phases.enter
  const rise = clamp((localFrame - riseStart) / 6, 0, 1)
  if (phases.exit <= 0) return rise
  const fallStart = durationInFrames - phases.exit - 6
  const fall = clamp((localFrame - fallStart) / 6, 0, 1)
  return rise * (1 - fall)
}

function applyLegacyLoop(pose: MotionState, loop: Animation["loop"], frame: number, fps: number, intensity: number): MotionState {
  if (loop.type === "nenhum" || loop.amplitude === 0) return pose
  const time = frame / Math.max(1e-6, fps)
  const wave = Math.sin(2 * Math.PI * loop.speed * time)
  const amplitude = loop.amplitude * intensity
  if (loop.type === "pulse") return { ...pose, scale: pose.scale * (1 + amplitude * wave) }
  if (loop.type === "shake") return { ...pose, x: pose.x + amplitude * wave }
  if (loop.type === "float") return { ...pose, y: pose.y + amplitude * wave }
  return pose
}

function tremor(seconds: number, speed: number, seed: number): number {
  const freqs = [1, Math.SQRT2, Math.PI]
  let sum = 0
  for (let index = 0; index < freqs.length; index += 1) {
    const phase = hash01(seed, index + 1, 3) * Math.PI * 2
    sum += Math.sin(2 * Math.PI * speed * freqs[index]! * seconds + phase)
  }
  return sum / freqs.length
}

function applyCatalogLoop(
  pose: MotionState,
  loop: Animation["loop"],
  seconds: number,
  rank: number,
  seed: number,
  envelope: number,
  intensity: number,
): MotionState {
  if (loop.type === "nenhum" || envelope === 0 || loop.amplitude === 0) return pose
  const amp = percentAmplitude(loop, intensity) * envelope
  const wave = sine(loop.speed, seconds)
  const next = { ...pose }
  if (loop.type === "pulse") next.scale *= 1 + amp * wave
  else if (loop.type === "batimento") {
    const phase = ((seconds * loop.speed) % 1 + 1) % 1
    const bump = (center: number, width: number) => {
      const delta = (phase - center) / width
      return Math.exp(-(delta * delta))
    }
    const beat = bump(0.12, 0.045) + 0.6 * bump(0.28, 0.04)
    next.scale *= 1 + amp * beat
  } else if (loop.type === "tremor") next.x += amp * tremor(seconds, loop.speed, seed)
  else if (loop.type === "chacoalho" || loop.type === "balanco") next.rotate += amp * wave
  else if (loop.type === "flutuar") next.y += amp * wave
  else if (loop.type === "quicar") {
    const phase = ((seconds * loop.speed) % 1 + 1) % 1
    next.y -= amp * Math.sin(Math.PI * phase)
  } else if (loop.type === "gelatina") {
    next.scaleX *= 1 + amp * wave
    next.scaleY *= 1 - amp * wave
  } else if (loop.type === "onda") next.y += amp * sine(loop.speed, seconds, 0.6 * rank)
  else if (loop.type === "brilho") {
    const glow = amp * (1 - Math.cos(2 * Math.PI * loop.speed * seconds)) * 0.5
    next.brightness += glow
    next.glow += glow
  } else if (loop.type === "piscar") {
    const dip = (1 - Math.cos(2 * Math.PI * loop.speed * seconds)) * 0.5
    next.opacity *= 1 - amp * dip
  } else if (loop.type === "inclinar3d") next.rotateY += amp * wave
  return next
}

function applyEmphasis(pose: MotionState, animation: Animation, localFrame: number, intensity: number): MotionState {
  const hits = animation.emphasis
  if (!hits || hits.length === 0) return pose
  const next = { ...pose }
  for (const hit of hits) {
    if (hit.durationInFrames <= 0) continue
    const p = (localFrame - hit.atFrame) / hit.durationInFrames
    if (p < 0 || p > 1) continue
    const bump = Math.sin(Math.PI * p)
    const strength = hit.strength * intensity
    if (hit.type === "punch") next.scale *= 1 + strength * bump
    else if (hit.type === "tremida") {
      const decay = Math.exp(-4 * p)
      next.x += Math.sin(p * 40) * decay * strength * bump
    } else if (hit.type === "flash") next.brightness += strength * bump
    else if (hit.type === "giro") next.rotate += strength * ease("ease-in-out", p)
    else if (hit.type === "pulo") next.y -= strength * bump
  }
  return next
}

function applyGlitch(pose: MotionState, frame: number, rank: number, seed: number): MotionState {
  if (pose.jitter <= 0) return pose
  const bucket = Math.floor(frame / 2)
  const h1 = hash01(bucket, rank, seed)
  const h2 = hash01(bucket, rank, seed ^ 0x9e3779b9)
  return {
    ...pose,
    x: pose.x + (h1 - 0.5) * 60 * pose.jitter,
    skewX: pose.skewX + (h2 - 0.5) * 30 * pose.jitter,
  }
}

export function motionAt(
  frame: number,
  fps: number,
  spec: MotionSpec,
  unitRank: number,
  unitCount: number,
  seed: number,
): MotionState {
  const { animation } = spec
  const speed = playbackSpeed(animation)
  const intensity = intensityOf(animation)
  const phases = fittedPhaseDurations(animation, spec.durationInFrames, speed)
  const stagger = animation.enter.staggerInFrames / speed
  const delay = animation.enter.delayInFrames / speed
  const slot = unitStaggerIndex(animation.order, unitRank, unitCount, seed)
  const local = frame - spec.startFrame - slot * stagger - delay
  const cardLocal = frame - spec.startFrame
  const exitStagger = (animation.exit.staggerInFrames ?? 0) / speed
  // A última unidade sai primeiro: rank alto começa a saída mais cedo.
  const exitStart = spec.durationInFrames - phases.exit - unitRank * exitStagger

  const from = intensifyDistance(resolveTarget(animation.enter.from), intensity)
  const toExit = intensifyDistance(resolveTarget(animation.exit.to), intensity)

  const coverFrame = animation.entryFromFrame0 === "final" && local <= 0
  let pose = MOTION_IDENTITY
  if (!coverFrame && (phases.enter > 0 || animation.enter.durationInFrames === 0)) {
    let enterProgress = progressAt(local, phases.enter, animation.enter.easing, animation.enter.overshoot, fps, speed)
    if (animation.entryFromFrame0 === "final") enterProgress = 0.7 + 0.3 * enterProgress
    pose = mixPose(from, MOTION_IDENTITY, enterProgress)
  }
  if (phases.exit > 0 && cardLocal >= exitStart) {
    const exitLocal = cardLocal - exitStart
    const exitProgress = progressAt(exitLocal, phases.exit, animation.exit.easing, 0, fps, speed)
    pose = mixPose(MOTION_IDENTITY, toExit, exitProgress)
  }

  if (!coverFrame && legacyLoop(animation.loop)) {
    pose = applyLegacyLoop(pose, animation.loop, frame, fps, intensity)
  } else if (!coverFrame) {
    const seconds = cardLocal / Math.max(1e-6, fps)
    const envelope = loopEnvelope(cardLocal, phases, animation, unitCount, spec.durationInFrames, speed)
    pose = applyCatalogLoop(pose, animation.loop, seconds, unitRank, seed, envelope, intensity)
  }

  if (!coverFrame) pose = applyEmphasis(pose, animation, cardLocal, intensity)
  return coverFrame ? pose : applyGlitch(pose, frame, unitRank, seed)
}

/** Estouro e os outros com caixa: fundo e texto usam a mesma escala. */
export function stickerMotionAt(input: {
  time: number
  fps: number
  duration: number
  animation: Animation
  entryFromFrame0?: "final" | "play"
}): { boxScale: number; textScale: number; opacity: number } {
  const fps = input.fps > 0 ? input.fps : 30
  const animation = input.entryFromFrame0
    ? { ...input.animation, entryFromFrame0: input.entryFromFrame0 }
    : input.animation
  const pose = motionAt(
    input.time * fps,
    fps,
    {
      animation,
      startFrame: 0,
      durationInFrames: Math.max(0, input.duration * fps),
    },
    0,
    1,
    1,
  )
  const scale = pose.scale * pose.scaleX
  return { boxScale: scale, textScale: scale, opacity: pose.opacity }
}

/** Caixa de fundo: entra em 6 frames e sai no mesmo instante da última unidade. */
export function backgroundEnvelope(frame: number, spec: MotionSpec, unitCount: number): { opacity: number; scale: number } {
  const speed = playbackSpeed(spec.animation)
  const phases = fittedPhaseDurations(spec.animation, spec.durationInFrames, speed)
  const local = frame - spec.startFrame
  const enterT = clamp(local / 6, 0, 1)
  let opacity = enterT
  let scale = lerp(0.9, 1, enterT)
  if (phases.exit > 0) {
    const exitStagger = (spec.animation.exit.staggerInFrames ?? 0) / speed
    const lastRank = Math.max(0, unitCount - 1)
    const exitStart = spec.durationInFrames - phases.exit - lastRank * exitStagger
    if (local >= exitStart) {
      const p = clamp((local - exitStart) / phases.exit, 0, 1)
      opacity = enterT * (1 - p)
      scale = lerp(scale, 0.9, p)
    }
  }
  return { opacity, scale }
}
