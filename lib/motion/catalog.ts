import type { Animation, AnimTarget } from "../style/types.ts"

export type ClipDir = "esq" | "dir" | "cima" | "baixo"
export type MotionOrigin = "centro" | "base" | "topo"
export type MotionUnit = Animation["unit"]

type EnterDef = {
  id: string
  label: string
  from: AnimTarget
  easing: Animation["enter"]["easing"]
  overshoot?: number
  dur: number
  legacy?: boolean
  unit?: MotionUnit
  stagger?: number
  origin?: MotionOrigin
  clipDir?: ClipDir
}

type ExitDef = {
  id: string
  label: string
  to: AnimTarget
  easing: Animation["exit"]["easing"]
  dur: number
  unit?: MotionUnit
  stagger?: number
  clipDir?: ClipDir
}

type LoopDef = {
  id: string
  label: string
  amp?: number
  speed?: number
  unitLabel?: "%" | "px" | "°"
  legacy?: true | "shake" | "float"
}

type EmphasisDef = {
  id: "punch" | "tremida" | "flash" | "giro" | "pulo"
  label: string
  dur: number
  strength: number
}

export type PackLoop = readonly [string] | readonly [string, number, number]

export type MotionPack = {
  id: string
  label: string
  slot: "gancho" | "prova" | "oferta" | "cta"
  enter: string
  loop: PackLoop
  exit: string
  unit: MotionUnit
  emphasis?: ReadonlyArray<{ type: EmphasisDef["id"]; at: number }>
  niche?: readonly string[]
}

/** Valores do anexo A. `legacy` marca o que já existia; o runtime de projeto salvo usa os canais gravados, não este default. */
export const ENTER: readonly EnterDef[] = [
  { id: "pop", label: "Pop", from: { scale: 0.6, opacity: 0 }, easing: "spring", overshoot: 0.15, dur: 8, legacy: true },
  { id: "pop-elastico", label: "Pop elástico", from: { scale: 0.2, opacity: 0 }, easing: "elastic-out", dur: 20 },
  { id: "carimbo", label: "Carimbo", from: { scale: 2.4, opacity: 0, rotate: -8 }, easing: "ease-in", dur: 7 },
  { id: "slide-up", label: "Sobe", from: { y: 60, opacity: 0 }, easing: "ease-out", dur: 9, legacy: true },
  { id: "slide-down", label: "Desce", from: { y: -60, opacity: 0 }, easing: "ease-out", dur: 9 },
  { id: "slide-esq", label: "Da esquerda", from: { x: -180, opacity: 0 }, easing: "ease-out", dur: 9 },
  { id: "slide-dir", label: "Da direita", from: { x: 180, opacity: 0 }, easing: "ease-out", dur: 9 },
  { id: "queda", label: "Queda", from: { y: -280 }, easing: "bounce-out", dur: 20 },
  { id: "zoom-in", label: "Zoom in", from: { scale: 0.2, opacity: 0 }, easing: "back-out", dur: 11 },
  { id: "zoom-out", label: "Zoom out", from: { scale: 1.35, opacity: 0 }, easing: "ease-out", dur: 8, legacy: true },
  { id: "blur-in", label: "Desfoque", from: { blur: 8, opacity: 0 }, easing: "ease-out", dur: 10, legacy: true },
  { id: "foco-zoom", label: "Foco + zoom", from: { blur: 14, scale: 1.25, opacity: 0 }, easing: "ease-out", dur: 12 },
  { id: "typewriter", label: "Digitação", from: { opacity: 0 }, easing: "linear", dur: 1, unit: "letra", stagger: 2, legacy: true },
  { id: "cascata", label: "Cascata", from: { y: 50, opacity: 0 }, easing: "spring", overshoot: 0.2, dur: 10, unit: "palavra", stagger: 3 },
  { id: "letra-sobe", label: "Letra a letra", from: { y: 40, opacity: 0, blur: 4 }, easing: "ease-out", dur: 8, unit: "letra", stagger: 1.2 },
  { id: "flip-3d", label: "Flip 3D", from: { rotateX: 90, opacity: 0 }, easing: "back-out", dur: 12, origin: "base" },
  { id: "giro", label: "Giro", from: { rotate: -200, scale: 0.2, opacity: 0 }, easing: "back-out", dur: 14 },
  { id: "balanco", label: "Balanço", from: { rotate: -30, opacity: 0 }, easing: "elastic-out", dur: 24, origin: "topo" },
  { id: "revelar", label: "Revelar", from: { clip: 1 }, easing: "ease-in-out", dur: 12, clipDir: "esq" },
  { id: "glitch", label: "Glitch", from: { jitter: 1, opacity: 0, skewX: 20 }, easing: "linear", dur: 10 },
  { id: "elastico", label: "Elástico", from: { scaleX: 0.2, scaleY: 1.6, opacity: 0 }, easing: "elastic-out", dur: 22 },
  { id: "mola-lateral", label: "Mola lateral", from: { x: -320 }, easing: "spring", overshoot: 0.35, dur: 14 },
]

export const EXIT: readonly ExitDef[] = [
  { id: "fade", label: "Some", to: { opacity: 0 }, easing: "linear", dur: 5 },
  { id: "pop-out", label: "Pop out", to: { scale: 0.4, opacity: 0 }, easing: "back-in", dur: 8 },
  { id: "sobe-sai", label: "Sai por cima", to: { y: -80, opacity: 0 }, easing: "ease-in", dur: 7 },
  { id: "desce-sai", label: "Sai por baixo", to: { y: 80, opacity: 0 }, easing: "ease-in", dur: 7 },
  { id: "zoom-sai", label: "Zoom e some", to: { scale: 1.6, opacity: 0, blur: 6 }, easing: "ease-in", dur: 7 },
  { id: "blur-out", label: "Desfoca", to: { blur: 10, opacity: 0 }, easing: "ease-in", dur: 8 },
  { id: "recolher", label: "Recolher", to: { clip: 1 }, easing: "ease-in-out", dur: 10, clipDir: "dir" },
  { id: "cair", label: "Cai", to: { y: 320, rotate: 18, opacity: 0 }, easing: "ease-in", dur: 12 },
  { id: "encolher-x", label: "Fecha", to: { scaleX: 0 }, easing: "back-in", dur: 8 },
  { id: "apagar", label: "Apagar letras", to: { opacity: 0 }, easing: "linear", dur: 1, unit: "letra", stagger: 1.5 },
  { id: "slide-sai-dir", label: "Sai pra direita", to: { x: 320, opacity: 0 }, easing: "ease-in", dur: 8 },
]

export const LOOPS: readonly LoopDef[] = [
  { id: "nenhum", label: "Nenhum" },
  { id: "pulse", label: "Pulsar", amp: 4, speed: 1, unitLabel: "%", legacy: true },
  { id: "batimento", label: "Batimento", amp: 7, speed: 1.1, unitLabel: "%" },
  { id: "tremor", label: "Tremor", amp: 4, speed: 7, unitLabel: "px", legacy: "shake" },
  { id: "chacoalho", label: "Chacoalho", amp: 4, speed: 3, unitLabel: "°" },
  { id: "flutuar", label: "Flutuar", amp: 10, speed: 0.5, unitLabel: "px", legacy: "float" },
  { id: "quicar", label: "Quicar", amp: 18, speed: 1.4, unitLabel: "px" },
  { id: "balanco", label: "Balanço", amp: 6, speed: 0.8, unitLabel: "°" },
  { id: "gelatina", label: "Gelatina", amp: 6, speed: 1.3, unitLabel: "%" },
  { id: "onda", label: "Onda", amp: 10, speed: 0.9, unitLabel: "px" },
  { id: "brilho", label: "Brilho", amp: 60, speed: 1, unitLabel: "%" },
  { id: "piscar", label: "Piscar", amp: 100, speed: 1.5, unitLabel: "%" },
  { id: "inclinar3d", label: "Inclinar 3D", amp: 18, speed: 0.6, unitLabel: "°" },
]

export const EMPHASIS: readonly EmphasisDef[] = [
  { id: "punch", label: "Punch", dur: 10, strength: 0.25 },
  { id: "tremida", label: "Tremida", dur: 12, strength: 14 },
  { id: "flash", label: "Flash", dur: 8, strength: 1.2 },
  { id: "giro", label: "Giro 360", dur: 16, strength: 360 },
  { id: "pulo", label: "Pulo", dur: 12, strength: 50 },
]

export const PACKS: readonly MotionPack[] = [
  { id: "estouro", label: "Estouro", slot: "gancho", enter: "pop", loop: ["pulse", 4, 1], exit: "pop-out", unit: "bloco" },
  { id: "carimbo", label: "Carimbo", slot: "gancho", enter: "carimbo", loop: ["nenhum"], exit: "zoom-sai", unit: "bloco", emphasis: [{ type: "tremida", at: 7 }] },
  { id: "digitacao", label: "Digitação", slot: "prova", enter: "typewriter", loop: ["nenhum"], exit: "fade", unit: "letra" },
  { id: "cascata", label: "Cascata", slot: "gancho", enter: "cascata", loop: ["onda", 6, 0.8], exit: "desce-sai", unit: "palavra" },
  { id: "flutuar", label: "Flutuar", slot: "prova", enter: "slide-up", loop: ["flutuar", 8, 0.5], exit: "fade", unit: "bloco" },
  { id: "alerta", label: "Alerta", slot: "oferta", enter: "pop", loop: ["tremor", 3, 6], exit: "fade", unit: "bloco" },
  { id: "elegante", label: "Elegante", slot: "gancho", enter: "letra-sobe", loop: ["nenhum"], exit: "blur-out", unit: "letra", niche: ["moda", "beleza"] },
  { id: "fofinho", label: "Fofinho", slot: "gancho", enter: "queda", loop: ["gelatina", 5, 1.2], exit: "pop-out", unit: "bloco", niche: ["bebe"] },
  { id: "preco", label: "Preço", slot: "oferta", enter: "zoom-in", loop: ["batimento", 6, 1.1], exit: "sobe-sai", unit: "bloco", emphasis: [{ type: "punch", at: 45 }] },
  { id: "cta-seta", label: "Chamada", slot: "cta", enter: "slide-up", loop: ["quicar", 12, 1.5], exit: "fade", unit: "bloco" },
]

export function enterById(id: string): EnterDef | undefined {
  return ENTER.find((recipe) => recipe.id === id)
}

export function exitById(id: string): ExitDef | undefined {
  return EXIT.find((recipe) => recipe.id === id)
}

export function loopById(id: string): LoopDef | undefined {
  return LOOPS.find((recipe) => recipe.id === id)
}

export function emphasisById(id: string): EmphasisDef | undefined {
  return EMPHASIS.find((recipe) => recipe.id === id)
}

export function packById(id: string): MotionPack | undefined {
  return PACKS.find((pack) => pack.id === id)
}

function loopType(id: string): Animation["loop"]["type"] {
  if (id === "shake") return "shake"
  if (id === "float") return "float"
  if (
    id === "nenhum" ||
    id === "pulse" ||
    id === "batimento" ||
    id === "tremor" ||
    id === "chacoalho" ||
    id === "flutuar" ||
    id === "quicar" ||
    id === "balanco" ||
    id === "gelatina" ||
    id === "onda" ||
    id === "brilho" ||
    id === "piscar" ||
    id === "inclinar3d"
  ) {
    return id
  }
  return "nenhum"
}

export function applyEnterRecipe(animation: Animation, id: string): Animation {
  const recipe = enterById(id)
  if (!recipe) return animation
  return {
    ...animation,
    unit: recipe.unit ?? animation.unit,
    origin: recipe.origin ?? animation.origin,
    clipDir: recipe.clipDir ?? animation.clipDir,
    enter: {
      ...animation.enter,
      from: { ...recipe.from },
      easing: recipe.easing,
      overshoot: recipe.overshoot ?? 0,
      durationInFrames: recipe.dur,
      staggerInFrames: recipe.stagger ?? animation.enter.staggerInFrames,
      recipeId: recipe.id,
    },
  }
}

export function applyExitRecipe(animation: Animation, id: string): Animation {
  const recipe = exitById(id)
  if (!recipe) return animation
  return {
    ...animation,
    unit: recipe.unit ?? animation.unit,
    clipDir: recipe.clipDir ?? animation.clipDir,
    exit: {
      ...animation.exit,
      to: { ...recipe.to },
      easing: recipe.easing,
      durationInFrames: recipe.dur,
      staggerInFrames: recipe.stagger,
      recipeId: recipe.id,
    },
  }
}

export function applyLoopRecipe(
  animation: Animation,
  id: string,
  amplitude = loopById(id)?.amp ?? 0,
  speed = loopById(id)?.speed ?? 0,
): Animation {
  const recipe = loopById(id)
  if (!recipe) return animation
  return {
    ...animation,
    loop: {
      type: loopType(recipe.id),
      amplitude: recipe.id === "nenhum" ? 0 : amplitude,
      speed: recipe.id === "nenhum" ? 0 : speed,
      recipeId: recipe.id,
    },
  }
}

export function applyPack(animation: Animation, packId: string): Animation {
  const pack = packById(packId)
  if (!pack) return animation
  let next = applyEnterRecipe(animation, pack.enter)
  next = applyExitRecipe(next, pack.exit)
  const [loopId, amplitude, speed] = pack.loop
  next = applyLoopRecipe(next, loopId, amplitude, speed)
  next = {
    ...next,
    unit: pack.unit,
    packId: pack.id,
    emphasis: pack.emphasis?.map((hit) => {
      const recipe = emphasisById(hit.type)
      return {
        type: hit.type,
        atFrame: hit.at,
        durationInFrames: recipe?.dur ?? 8,
        strength: recipe?.strength ?? 1,
      }
    }),
  }
  return next
}
