import type { DeepPartial, InsertStyle, PresetGroup } from "./types.ts"

export type OfferNiche = "shopee" | "moda" | "beleza" | "bebe"

export type OfferPresetMeta = {
  id: string
  label: string
  slots: Array<"gancho" | "prova" | "oferta" | "cta">
  niche: OfferNiche[]
  phase: "4a" | "4b" | "4c"
}

type OfferDef = OfferPresetMeta & {
  font: string
  weight: number
  size: number
  case?: "upper"
  color: string
  accent: string
  italic?: boolean
  tracking?: number
  accentFont?: string
  rotation?: number
  gradient?: [string, string, number]
  stroke?: { width: number; color: string }
  outerStroke?: { width: number; color: string }
  longShadow?: { length: number; color: string }
  shadows?: { x: number; y: number; blur: number; color: string }[]
  bg?: { color: string; opacity: number; padX: number; padY: number; radius: number; mode?: "linha" }
  underline?: boolean
  boxShadow?: boolean
  priceLayout?: boolean
  shape?: InsertStyle["text"]["shape"]
  glass?: boolean
  highlightBar?: { color: string; skew: number }
}

const OFFER_DEFS: OfferDef[] = [
  { id: "sticker", label: "Sticker", slots: ["gancho", "cta"], niche: ["shopee", "bebe"], phase: "4a", font: "poppins", weight: 900, size: 72, color: "slot:ink", accent: "slot:primary", bg: { color: "slot:paper", opacity: 100, padX: 0.45, padY: 0.2, radius: 28 }, shadows: [{ x: 0, y: 10, blur: 0, color: "rgba(0,0,0,.28)" }], rotation: -3 },
  { id: "vazado", label: "Contorno vazado", slots: ["gancho"], niche: ["shopee", "moda"], phase: "4a", font: "anton", weight: 400, size: 120, case: "upper", color: "transparent", accent: "slot:primary", stroke: { width: 5, color: "#FFFFFF" } },
  { id: "sombra-longa", label: "Sombra longa", slots: ["gancho", "oferta"], niche: ["shopee"], phase: "4a", font: "archivo", weight: 400, size: 96, case: "upper", color: "#FFFFFF", accent: "slot:accent", longShadow: { length: 16, color: "slot:primary" } },
  { id: "duplo", label: "Duplo contorno", slots: ["gancho", "oferta"], niche: ["shopee", "bebe"], phase: "4a", font: "anton", weight: 400, size: 104, case: "upper", color: "slot:accent", accent: "slot:primary", stroke: { width: 9, color: "slot:ink" }, outerStroke: { width: 9, color: "#FFFFFF" } },
  { id: "por-do-sol", label: "Pôr do sol", slots: ["gancho"], niche: ["beleza", "shopee"], phase: "4a", font: "anton", weight: 400, size: 110, case: "upper", gradient: ["#FFC400", "#FF3D7F", 180], accent: "#FFFFFF", shadows: [{ x: 0, y: 7, blur: 0, color: "rgba(0,0,0,.35)" }] },
  { id: "cromado", label: "Cromado", slots: ["gancho", "oferta"], niche: ["shopee"], phase: "4a", font: "archivo", weight: 400, size: 96, case: "upper", gradient: ["#FFFFFF", "#8E99A6", 180], accent: "slot:accent", stroke: { width: 2, color: "#2B2F35" }, shadows: [{ x: 0, y: 6, blur: 14, color: "rgba(0,0,0,.45)" }] },
  { id: "editorial", label: "Editorial serif", slots: ["gancho", "prova"], niche: ["moda", "beleza"], phase: "4a", font: "playfair", weight: 700, italic: true, size: 84, color: "slot:paper", accent: "slot:accent", shadows: [{ x: 0, y: 4, blur: 18, color: "rgba(0,0,0,.45)" }] },
  { id: "script-caps", label: "Script + caixa alta", slots: ["gancho", "cta"], niche: ["moda", "beleza"], phase: "4a", font: "montserrat", weight: 800, size: 64, case: "upper", tracking: 0.04, color: "#FFFFFF", accent: "slot:accent", accentFont: "pacifico", shadows: [{ x: 0, y: 4, blur: 12, color: "rgba(0,0,0,.5)" }] },
  { id: "neon-rosa", label: "Neon rosa", slots: ["gancho"], niche: ["beleza"], phase: "4a", font: "montserrat", weight: 800, size: 80, color: "#FFFFFF", accent: "#FFFFFF", shadows: [{ x: 0, y: 0, blur: 8, color: "slot:primary" }, { x: 0, y: 0, blur: 22, color: "slot:primary" }, { x: 0, y: 0, blur: 44, color: "slot:primary" }] },
  { id: "bolha", label: "Bolha pastel", slots: ["gancho", "cta"], niche: ["bebe"], phase: "4a", font: "fredoka", weight: 700, size: 86, color: "#FFFFFF", accent: "slot:accent", stroke: { width: 11, color: "slot:primary" }, shadows: [{ x: 0, y: 8, blur: 0, color: "slot:ink" }] },
  { id: "pilula-marca", label: "Pílula da marca", slots: ["cta", "oferta"], niche: ["shopee", "bebe", "beleza"], phase: "4a", font: "poppins", weight: 800, size: 60, color: "slot:onPrimary", accent: "slot:accent", bg: { color: "slot:primary", opacity: 100, padX: 0.7, padY: 0.3, radius: 999 } },
  { id: "grife", label: "Minimal grife", slots: ["prova", "cta"], niche: ["moda"], phase: "4a", font: "montserrat", weight: 500, size: 44, case: "upper", tracking: 0.32, color: "#FFFFFF", accent: "slot:accent", underline: true, shadows: [{ x: 0, y: 2, blur: 10, color: "rgba(0,0,0,.45)" }] },
  { id: "contador-bold", label: "Bloco condensado", slots: ["oferta", "prova"], niche: ["shopee", "moda"], phase: "4a", font: "oswald", weight: 700, size: 88, case: "upper", color: "slot:paper", accent: "slot:primary", bg: { color: "slot:ink", opacity: 92, padX: 0.4, padY: 0.12, radius: 0, mode: "linha" } },
  { id: "fita", label: "Fita adesiva", slots: ["prova"], niche: ["moda", "beleza"], phase: "4b", font: "permanent-marker", weight: 400, size: 64, color: "slot:ink", accent: "slot:primary", shape: "fita", bg: { color: "slot:accent", opacity: 88, padX: 0.5, padY: 0.18, radius: 2 }, rotation: 2 },
  { id: "vidro", label: "Vidro", slots: ["prova", "cta"], niche: ["beleza", "moda"], phase: "4b", font: "montserrat", weight: 700, size: 58, color: "#FFFFFF", accent: "slot:accent", glass: true, bg: { color: "#FFFFFF", opacity: 20, padX: 0.6, padY: 0.35, radius: 30 } },
  { id: "marca-texto", label: "Marca-texto torto", slots: ["prova", "gancho"], niche: ["shopee", "beleza"], phase: "4b", font: "poppins", weight: 800, size: 70, color: "slot:ink", accent: "slot:ink", highlightBar: { color: "slot:accent", skew: -6 } },
  { id: "preco-gigante", label: "Preço gigante", slots: ["oferta"], niche: ["shopee", "moda", "beleza", "bebe"], phase: "4b", font: "anton", weight: 400, size: 150, color: "#FFFFFF", accent: "slot:accent", stroke: { width: 8, color: "slot:ink" }, priceLayout: true, shadows: [{ x: 0, y: 8, blur: 0, color: "slot:primary" }] },
  { id: "balao", label: "Balão de fala", slots: ["prova"], niche: ["shopee", "bebe", "beleza"], phase: "4b", font: "poppins", weight: 700, size: 56, color: "slot:ink", accent: "slot:primary", shape: "balao", bg: { color: "#FFFFFF", opacity: 100, padX: 0.6, padY: 0.38, radius: 34 } },
  { id: "etiqueta", label: "Etiqueta recortada", slots: ["oferta"], niche: ["shopee", "moda"], phase: "4b", font: "archivo", weight: 400, size: 70, case: "upper", color: "slot:onPrimary", accent: "slot:accent", shape: "etiqueta", bg: { color: "slot:primary", opacity: 100, padX: 0.8, padY: 0.3, radius: 10 } },
  { id: "selo", label: "Selo estrela", slots: ["oferta"], niche: ["shopee", "bebe"], phase: "4b", font: "anton", weight: 400, size: 64, case: "upper", color: "slot:onPrimary", accent: "slot:accent", shape: "selo", bg: { color: "slot:primary", opacity: 100, padX: 0.9, padY: 0.9, radius: 0 } },
  { id: "bilhete", label: "Bilhete", slots: ["prova", "cta"], niche: ["moda", "beleza", "bebe"], phase: "4b", font: "caveat", weight: 700, size: 72, color: "slot:ink", accent: "slot:primary", bg: { color: "slot:paper", opacity: 100, padX: 0.6, padY: 0.3, radius: 4 }, shadows: [{ x: 0, y: 12, blur: 24, color: "rgba(0,0,0,.28)" }], rotation: 2, boxShadow: true },
  { id: "tarja", label: "Tarja diagonal", slots: ["oferta", "gancho"], niche: ["shopee"], phase: "4b", font: "archivo", weight: 400, size: 72, case: "upper", color: "slot:onPrimary", accent: "slot:accent", shape: "tarja", bg: { color: "slot:primary", opacity: 100, padX: 2, padY: 0.25, radius: 0 }, rotation: -6 },
  { id: "quadrinho", label: "Quadrinho", slots: ["gancho", "oferta"], niche: ["shopee", "bebe"], phase: "4c", font: "luckiest", weight: 400, size: 96, color: "slot:accent", accent: "#FFFFFF", stroke: { width: 10, color: "slot:ink" }, shadows: [{ x: 6, y: 8, blur: 0, color: "slot:ink" }], rotation: -2 },
  { id: "manchete", label: "Manchete", slots: ["gancho", "oferta"], niche: ["shopee", "moda"], phase: "4c", font: "bebas", weight: 400, size: 96, case: "upper", color: "slot:paper", accent: "slot:accent", bg: { color: "slot:primary", opacity: 100, padX: 0.3, padY: 0.06, radius: 0, mode: "linha" } },
  { id: "fita-preta", label: "Faixa de aviso", slots: ["gancho", "oferta"], niche: ["shopee"], phase: "4c", font: "bebas", weight: 400, size: 84, case: "upper", color: "slot:accent", accent: "#FFFFFF", bg: { color: "slot:ink", opacity: 100, padX: 0.5, padY: 0.14, radius: 0 }, rotation: 4 },
  { id: "retro", label: "Retrô slab", slots: ["gancho", "oferta"], niche: ["shopee", "moda"], phase: "4c", font: "alfa", weight: 400, size: 86, case: "upper", color: "slot:accent", accent: "#FFFFFF", longShadow: { length: 10, color: "slot:ink" } },
  { id: "dourado", label: "Dourado", slots: ["gancho", "oferta", "cta"], niche: ["moda", "beleza"], phase: "4c", font: "playfair", weight: 700, italic: true, size: 80, gradient: ["#FFF1C1", "#C99A3B", 180], accent: "#FFFFFF", shadows: [{ x: 0, y: 4, blur: 14, color: "rgba(0,0,0,.5)" }] },
  { id: "neon-azul", label: "Neon azul", slots: ["gancho", "cta"], niche: ["shopee", "beleza"], phase: "4c", font: "montserrat", weight: 800, size: 78, color: "#FFFFFF", accent: "#A5F3FC", shadows: [{ x: 0, y: 0, blur: 8, color: "#22D3EE" }, { x: 0, y: 0, blur: 22, color: "#22D3EE" }, { x: 0, y: 0, blur: 44, color: "#0EA5E9" }] },
  { id: "gordinho", label: "Gordinho", slots: ["gancho", "prova", "cta"], niche: ["bebe"], phase: "4c", font: "lilita", weight: 400, size: 90, color: "#FFFFFF", accent: "slot:accent", stroke: { width: 8, color: "slot:primary" }, shadows: [{ x: 0, y: 6, blur: 0, color: "slot:ink" }] },
  { id: "recibo", label: "Recibo", slots: ["prova"], niche: ["shopee", "moda", "beleza"], phase: "4c", font: "courier", weight: 700, size: 52, color: "slot:ink", accent: "slot:primary", bg: { color: "#FFFFFF", opacity: 100, padX: 0.55, padY: 0.32, radius: 2 }, shadows: [{ x: 0, y: 8, blur: 18, color: "rgba(0,0,0,.3)" }], boxShadow: true, rotation: -1 },
  { id: "post-it", label: "Post-it", slots: ["prova", "cta"], niche: ["shopee", "moda", "beleza", "bebe"], phase: "4c", font: "caveat", weight: 700, size: 76, color: "#1F1A0A", accent: "slot:primary", bg: { color: "#FFE873", opacity: 100, padX: 0.55, padY: 0.32, radius: 2 }, shadows: [{ x: 0, y: 10, blur: 20, color: "rgba(0,0,0,.28)" }], boxShadow: true, rotation: -3 },
  { id: "cartao", label: "Cartão clean", slots: ["prova", "oferta", "cta"], niche: ["shopee", "moda", "beleza", "bebe"], phase: "4c", font: "space", weight: 700, size: 56, color: "slot:ink", accent: "slot:primary", bg: { color: "slot:paper", opacity: 94, padX: 0.5, padY: 0.28, radius: 16 } },
  { id: "botao", label: "Botão", slots: ["cta"], niche: ["shopee", "bebe"], phase: "4c", font: "titan", weight: 400, size: 62, color: "slot:primary", accent: "slot:ink", bg: { color: "#FFFFFF", opacity: 100, padX: 0.7, padY: 0.32, radius: 999 }, shadows: [{ x: 0, y: 7, blur: 0, color: "slot:primary" }], boxShadow: true },
  { id: "sublinhado", label: "Sublinhado", slots: ["prova", "cta"], niche: ["shopee", "beleza"], phase: "4c", font: "nunito", weight: 800, size: 64, color: "#FFFFFF", accent: "slot:accent", underline: true, shadows: [{ x: 0, y: 3, blur: 12, color: "rgba(0,0,0,.5)" }] },
  { id: "numero-gigante", label: "Número gigante", slots: ["oferta"], niche: ["shopee", "moda", "beleza", "bebe"], phase: "4c", font: "anton", weight: 400, size: 170, color: "#FFFFFF", accent: "slot:accent", stroke: { width: 10, color: "slot:ink" }, shadows: [{ x: 0, y: 10, blur: 0, color: "slot:primary" }] },
]

/** Estilos da leva 4c. O selo NOVO some depois do primeiro uso. */
export const FRESH_OFFER_IDS = OFFER_DEFS.filter((def) => def.phase === "4c").map((def) => def.id)

const BY_ID = new Map(OFFER_DEFS.map((def) => [def.id, def]))

export function offerPresetMeta(id: string): OfferPresetMeta | undefined {
  const def = BY_ID.get(id)
  if (!def) return undefined
  return { id: def.id, label: def.label, slots: def.slots, niche: def.niche, phase: def.phase }
}

export function offerPresetGroup(id: string): PresetGroup {
  const def = BY_ID.get(id)
  const slot = def?.slots[0]
  if (slot === "gancho" || slot === "prova" || slot === "cta" || slot === "oferta") return slot
  return "gancho"
}

export function listOfferPresets(filter?: { slot?: string; niche?: string }): OfferPresetMeta[] {
  return OFFER_DEFS.filter((def) => {
    if (filter?.slot && filter.slot !== "todos" && !def.slots.includes(filter.slot as OfferDef["slots"][number])) return false
    if (filter?.niche && filter.niche !== "todos" && !def.niche.includes(filter.niche as OfferNiche)) return false
    return true
  }).map((def) => ({ id: def.id, label: def.label, slots: def.slots, niche: def.niche, phase: def.phase }))
}

/** O ângulo do anexo é o do CSS: 180 desce. O canvas atual usa 90 para o mesmo eixo. */
function canvasGradientAngle(cssAngle: number): number {
  return cssAngle - 90
}

export function offerStylePatch(id: string): DeepPartial<InsertStyle> | undefined {
  const def = BY_ID.get(id)
  if (!def) return undefined
  const padX = def.bg ? def.bg.padX * def.size : undefined
  const padY = def.bg ? def.bg.padY * def.size : undefined
  return {
    text: {
      fontFamily: def.font,
      fontWeight: def.weight,
      fontSize: def.size,
      letterSpacing: def.tracking ?? 0,
      textTransform: def.case === "upper" ? "uppercase" : "none",
      color: def.color,
      accent: def.accent,
      italic: def.italic,
      accentFont: def.accentFont,
      rotation: def.rotation ?? 0,
      underline: def.underline,
      boxShadow: def.boxShadow,
      priceLayout: def.priceLayout,
      shape: def.shape,
      glass: def.glass,
      outerStroke: def.outerStroke,
      longShadow: def.longShadow,
      highlightBar: def.highlightBar,
      highlight: { color: def.accent },
      ...(def.gradient
        ? {
            gradient: {
              enabled: true,
              from: def.gradient[0],
              to: def.gradient[1],
              angle: canvasGradientAngle(def.gradient[2]),
            },
          }
        : { gradient: { enabled: false } }),
      ...(def.stroke
        ? { stroke: { enabled: true, width: def.stroke.width, color: def.stroke.color } }
        : { stroke: { enabled: false, width: 0 } }),
      ...(def.shadows ? { shadows: def.shadows } : { shadows: [] }),
      ...(def.bg
        ? {
            background: {
              enabled: true,
              mode: def.bg.mode === "linha" ? "por-linha" : "bloco",
              color: def.bg.color,
              opacity: def.bg.opacity,
              paddingX: padX,
              paddingY: padY,
              radius: def.bg.radius,
            },
          }
        : { background: { enabled: false } }),
    },
  }
}

export const OFFER_PRESET_IDS = OFFER_DEFS.map((def) => def.id)
