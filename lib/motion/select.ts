import type { Animation } from "../style/types.ts"
import {
  applyEnterRecipe,
  applyExitRecipe,
  applyLoopRecipe,
  applyPack,
  emphasisById,
  enterById,
  exitById,
  loopById,
} from "./catalog.ts"

function withoutPack(animation: Animation): Animation {
  if (animation.packId === undefined) return animation
  const { packId: _packId, ...rest } = animation
  return rest
}

/** Recipe de entrada. Legado sozinho conserva a duração já gravada no insert. */
export function selectEnter(animation: Animation, id: string): Animation {
  const recipe = enterById(id)
  if (!recipe) return animation
  const kept = animation.enter.durationInFrames
  const next = applyEnterRecipe(animation, id)
  const enter =
    recipe.legacy && kept > 0 ? { ...next.enter, durationInFrames: kept, recipeId: recipe.id } : next.enter
  return withoutPack({ ...next, enter })
}

/** Recipe de saída. Sempre grava `exit.recipeId`. */
export function selectExit(animation: Animation, id: string): Animation {
  const recipe = exitById(id)
  if (!recipe) return animation
  return withoutPack(applyExitRecipe(animation, id))
}

/** Loop do catálogo. `recipeId` liga o envelope; pulse/shake/float antigos sem id ficam como estão. */
export function selectLoop(animation: Animation, id: string): Animation {
  const recipe = loopById(id)
  if (!recipe) return animation
  return withoutPack(applyLoopRecipe(animation, id))
}

/** Pacote: entrada, loop, saída, unidade, ênfases e `packId`. */
export function selectPack(animation: Animation, id: string): Animation {
  return applyPack(animation, id)
}

export function mirrorExitFromEnter(animation: Animation): Animation {
  return withoutPack({
    ...animation,
    exit: {
      ...animation.exit,
      to: { ...animation.enter.from },
      recipeId: undefined,
    },
  })
}

export function addEmphasisAt(
  animation: Animation,
  atFrame: number,
  type: "punch" | "tremida" | "flash" | "giro" | "pulo" = "punch",
): Animation {
  const recipe = emphasisById(type)
  if (!recipe) return animation
  return {
    ...animation,
    emphasis: [
      ...(animation.emphasis ?? []),
      {
        type: recipe.id,
        atFrame: Math.max(0, Math.round(atFrame)),
        durationInFrames: recipe.dur,
        strength: recipe.strength,
      },
    ],
  }
}

export function moveEmphasis(animation: Animation, index: number, atFrame: number): Animation {
  const hits = animation.emphasis ?? []
  if (!hits[index]) return animation
  return {
    ...animation,
    emphasis: hits.map((hit, hitIndex) =>
      hitIndex === index ? { ...hit, atFrame: Math.max(0, Math.round(atFrame)) } : hit,
    ),
  }
}

export type ClipMotionMarks = {
  enter: number
  exit: number
  emphasis: Array<{ index: number; ratio: number }>
}

export function clipMotionMarks(animation: Animation, durationSeconds: number, fps: number): ClipMotionMarks {
  const total = Math.max(1, durationSeconds * Math.max(1, fps))
  return {
    enter: Math.min(1, Math.max(0, animation.enter.durationInFrames) / total),
    exit: Math.min(1, Math.max(0, animation.exit.durationInFrames) / total),
    emphasis: (animation.emphasis ?? []).map((hit, index) => ({
      index,
      ratio: Math.min(1, Math.max(0, hit.atFrame / total)),
    })),
  }
}

const LEGACY_LOOP_ID: Record<string, string> = {
  nenhum: "nenhum",
  pulse: "pulse",
  shake: "tremor",
  float: "flutuar",
}

export function activeLoopId(animation: Animation): string | null {
  if (animation.loop.recipeId) return animation.loop.recipeId
  return LEGACY_LOOP_ID[animation.loop.type] ?? null
}

/** Amplitude na unidade do catálogo. Pulse antigo (fração) aparece em %. */
export function displayLoopAmplitude(animation: Animation): { value: number; unit: string } {
  const recipe = animation.loop.recipeId ? loopById(animation.loop.recipeId) : undefined
  if (recipe?.unitLabel) return { value: animation.loop.amplitude, unit: recipe.unitLabel }
  if (animation.loop.type === "pulse") return { value: animation.loop.amplitude * 100, unit: "%" }
  if (animation.loop.type === "shake" || animation.loop.type === "float") {
    return { value: animation.loop.amplitude, unit: "px" }
  }
  return { value: animation.loop.amplitude, unit: "" }
}

export function writeLoopAmplitude(animation: Animation, displayValue: number): Animation {
  if (!animation.loop.recipeId && animation.loop.type === "pulse") {
    return { ...animation, loop: { ...animation.loop, amplitude: displayValue / 100 } }
  }
  return { ...animation, loop: { ...animation.loop, amplitude: displayValue } }
}
