import { applyTextBackground } from "./text-presets/bar.ts"
import { createInsert, slug, type Insert } from "./inserts.ts"
import { TEXT_INSERT_TYPE } from "./composition.ts"
import type { RetentionCuts } from "./insert-ops.ts"

const HOOK_SECONDS = 2
const PROOF_SECONDS = 2.5
const CTA_SECONDS = 3
const IDEAL_SECONDS = HOOK_SECONDS + PROOF_SECONDS + CTA_SECONDS

export const FACTORY_STRUCTURE_NAME = "Campeão — calça flare"
export const FACTORY_HOOK_TEXT = "ESCREVA O GANCHO"
export const FACTORY_PROOF_TEXT = "+10 mil vendidos ⭐ 4,9"
export const FACTORY_CTA_TEXT = "Toca no carrinho laranja 🛒"

export type StructureSlot = { start: number; duration: number }

export type StructureTiming = {
  hook: StructureSlot
  proof: StructureSlot
  cta: StructureSlot
  zones: RetentionCuts
}

function tenth(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * GANCHO nos 2s iniciais, selo no começo da PROVA (~2,5s) e CTA nos 3s finais.
 * Vídeos mais curtos que 7,5s repartem na mesma proporção, sem sobrepor nem passar do fim.
 */
export function structureTiming(duration: number): StructureTiming {
  const total = tenth(Math.max(0, duration))
  if (!(total > 0)) {
    return {
      hook: { start: 0, duration: 0 },
      proof: { start: 0, duration: 0 },
      cta: { start: 0, duration: 0 },
      zones: { ganchoEnd: 0, ctaStart: 0 },
    }
  }
  if (total + 1e-6 >= IDEAL_SECONDS) {
    const ctaStart = tenth(total - CTA_SECONDS)
    const proofRoom = tenth(ctaStart - HOOK_SECONDS)
    return {
      hook: { start: 0, duration: HOOK_SECONDS },
      proof: { start: HOOK_SECONDS, duration: Math.min(PROOF_SECONDS, proofRoom) },
      cta: { start: ctaStart, duration: tenth(total - ctaStart) },
      zones: { ganchoEnd: HOOK_SECONDS, ctaStart },
    }
  }
  const hook = tenth((HOOK_SECONDS / IDEAL_SECONDS) * total)
  const proof = tenth((PROOF_SECONDS / IDEAL_SECONDS) * total)
  const ctaStart = tenth(hook + proof)
  const cta = tenth(total - ctaStart)
  return {
    hook: { start: 0, duration: hook },
    proof: { start: hook, duration: proof },
    cta: { start: ctaStart, duration: cta },
    zones: { ganchoEnd: hook, ctaStart },
  }
}

export type HookVariationFile = { fileName: string; hook: string }

/** `<nome>_g1.mp4` … na ordem dos ganchos. */
export function hookVariationFiles(baseName: string, hooks: string[]): HookVariationFile[] {
  const base = slug(baseName) || "video"
  return hooks.map((hook, index) => ({
    hook,
    fileName: `${base}_g${index + 1}.mp4`,
  }))
}

export type HookManifestAudio = {
  summary: string
  tracks: {
    kind: string
    name: string
    start: number
    trimIn: number
    trimOut: number
    volume: number
    loop: boolean
  }[]
}

export function hookVariationManifest(
  baseName: string,
  hooks: string[],
  extras?: Array<{ contentId?: string; styleId?: string; packId?: string }>,
  audio?: HookManifestAudio,
) {
  return {
    baseName: slug(baseName) || "video",
    ...(audio ? { audio } : {}),
    variations: hookVariationFiles(baseName, hooks).map((item, index) => ({
      file: item.fileName,
      hook: item.hook,
      ...(extras?.[index]?.contentId ? { contentId: extras[index]?.contentId } : {}),
      ...(extras?.[index]?.styleId ? { styleId: extras[index]?.styleId } : {}),
      ...(extras?.[index]?.packId ? { packId: extras[index]?.packId } : {}),
    })),
  }
}

export type StructureRole = "gancho" | "prova" | "cta"

export type BuiltStructure = {
  inserts: Insert[]
  retention: RetentionCuts
}

const HOOK_Y = 28
const PROOF_Y = 40
const CTA_Y = 68
const SAFE_MAX_WIDTH = 64

function textInsert(
  slot: StructureSlot,
  text: string,
  role: StructureRole,
  fontSize: number,
  y: number,
  animIn: Insert["animIn"],
  boxed = false,
): Insert {
  const created = createInsert(TEXT_INSERT_TYPE)
  const withBox = boxed ? applyTextBackground(created, true) : null
  return {
    ...created,
    ...(withBox ?? {}),
    role,
    text,
    start: slot.start,
    duration: slot.duration,
    x: 50,
    y,
    fontSize,
    maxWidthPct: SAFE_MAX_WIDTH,
    textAlign: "center",
    anchor: "center",
    animIn,
    animOut: "none",
  }
}

/** Três textos dentro da safe area, mais os cortes da régua. */
export function buildChampionStructure(
  duration: number,
  copy: { hook: string; proof: string; cta: string } = {
    hook: FACTORY_HOOK_TEXT,
    proof: FACTORY_PROOF_TEXT,
    cta: FACTORY_CTA_TEXT,
  },
): BuiltStructure {
  const timing = structureTiming(duration)
  return {
    retention: timing.zones,
    inserts: [
      textInsert(timing.hook, copy.hook, "gancho", 140, HOOK_Y, "none"),
      textInsert(timing.proof, copy.proof, "prova", 48, PROOF_Y, "none"),
      textInsert(timing.cta, copy.cta, "cta", 72, CTA_Y, "pop", true),
    ],
  }
}

export type HookJobState = {
  fileName: string
  hook: string
  status: "queued" | "running" | "ok" | "error"
  error: string | null
}

export function hookJobErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  return "O render não terminou a tempo"
}

/** Roda os jobs em sequência. Um erro grava o status e segue para o próximo. */
export async function runHookVariationQueue(input: {
  jobs: { fileName: string; hook: string; run: () => Promise<void> }[]
  onUpdate?: (states: HookJobState[]) => void
}): Promise<HookJobState[]> {
  const states: HookJobState[] = input.jobs.map((job) => ({
    fileName: job.fileName,
    hook: job.hook,
    status: "queued",
    error: null,
  }))
  input.onUpdate?.(states.map((item) => ({ ...item })))
  for (let index = 0; index < input.jobs.length; index += 1) {
    const job = input.jobs[index]
    const current = states[index]
    if (!job || !current) continue
    current.status = "running"
    input.onUpdate?.(states.map((item) => ({ ...item })))
    try {
      await job.run()
      current.status = "ok"
      current.error = null
    } catch (error) {
      current.status = "error"
      current.error = hookJobErrorMessage(error)
    }
    input.onUpdate?.(states.map((item) => ({ ...item })))
  }
  return states
}
