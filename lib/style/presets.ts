import { deepMerge } from "./deep-merge.ts"
import type { DeepPartial, InsertStyle, Preset, PresetGroup, StyleRef, UserPreset } from "./types.ts"

export const LEGADO_PRESET_ID = "legado" as const
export const DEFAULT_CTA_PRESET_ID = "carrinhoLaranja" as const

export const LEGADO_STYLE: InsertStyle = {
  text: {
    fontFamily: "geist",
    fontWeight: 800,
    fontSize: 56,
    letterSpacing: 0,
    lineHeight: 1.2,
    textTransform: "none",
    textAlign: "center",
    maxWidth: 84,
    color: "#FFFFFF",
    gradient: { enabled: false, from: "#fff", to: "#fff", angle: 0 },
    stroke: { enabled: true, width: 6, color: "#000000" },
    shadows: [],
    background: {
      enabled: false,
      mode: "bloco",
      color: "#000000",
      opacity: 0,
      paddingX: 0,
      paddingY: 0,
      radius: 0,
      backdropBlur: 0,
    },
    highlight: {
      mode: "nenhum",
      color: "#FFE500",
      boxColor: null,
      scale: 1,
      keywords: [],
    },
    x: 50,
    y: 35,
    rotation: 0,
    opacity: 100,
  },
  animation: {
    unit: "bloco",
    enter: {
      from: {},
      durationInFrames: 0,
      delayInFrames: 0,
      easing: "linear",
      overshoot: 0,
      staggerInFrames: 0,
    },
    exit: {
      to: {},
      durationInFrames: 0,
      easing: "linear",
    },
    loop: { type: "nenhum", amplitude: 0, speed: 0 },
  },
}

function style(patch: DeepPartial<InsertStyle>): InsertStyle {
  return deepMerge(LEGADO_STYLE, patch)
}

function makePreset(
  label: string,
  group: PresetGroup,
  patch: DeepPartial<InsertStyle>,
  extra: { maxWords?: number } = {},
): Preset {
  return { label, group, style: style(patch), ...extra }
}

const noneAnim = {
  unit: "bloco" as const,
  enter: {
    from: {},
    durationInFrames: 0,
    delayInFrames: 0,
    easing: "linear" as const,
    overshoot: 0,
    staggerInFrames: 0,
  },
  exit: { to: {}, durationInFrames: 0, easing: "linear" as const },
  loop: { type: "nenhum" as const, amplitude: 0, speed: 0 },
}

export const FACTORY_PRESET_IDS = [
  "hormozi",
  "karaoke",
  "umaPalavra",
  "pillBranca",
  "marcador",
  "tiktokNativo",
  "neon",
  "minimal",
  "manchete",
  "impacto3D",
  "fitaTorta",
  "seloAvaliacao",
  "contador",
  "carrinhoLaranja",
  "setaTexto",
  "urgencia",
] as const

export type FactoryPresetId = (typeof FACTORY_PRESET_IDS)[number]

export const DEFAULT_CTA_STYLE_REF: StyleRef = {
  presetId: DEFAULT_CTA_PRESET_ID,
  overrides: {},
}

export const PRESETS: Record<string, Preset> = {
  legado: {
    label: "Legado",
    group: "legenda",
    style: LEGADO_STYLE,
  },
  hormozi: makePreset("Hormozi", "legenda", {
    text: {
      fontFamily: "montserrat",
      fontWeight: 900,
      fontSize: 84,
      letterSpacing: -0.02,
      lineHeight: 1.05,
      textTransform: "uppercase",
      maxWidth: 80,
      stroke: { enabled: true, width: 8, color: "#000000" },
      shadows: [{ x: 0, y: 4, blur: 12, color: "rgba(0,0,0,0.5)" }],
      highlight: { mode: "palavra-ativa", color: "#FFE600", boxColor: null, scale: 1.08, keywords: [] },
      x: 50,
      y: 50,
    },
    animation: {
      unit: "palavra",
      enter: {
        from: { scale: 0.6, opacity: 0 },
        durationInFrames: 8,
        delayInFrames: 0,
        easing: "spring",
        overshoot: 0.15,
        staggerInFrames: 0,
      },
      exit: { to: { opacity: 0 }, durationInFrames: 4, easing: "linear" },
    },
  }),
  karaoke: makePreset("Karaoke", "legenda", {
    text: {
      fontFamily: "bebas",
      fontWeight: 400,
      fontSize: 72,
      textTransform: "uppercase",
      stroke: { enabled: true, width: 4, color: "#000000" },
      highlight: { mode: "karaoke-fill", color: "#00E676", boxColor: null, scale: 1, keywords: [] },
      y: 72,
    },
    animation: noneAnim,
  }),
  umaPalavra: makePreset(
    "Uma Palavra",
    "legenda",
    {
      text: {
        fontFamily: "anton",
        fontWeight: 400,
        fontSize: 140,
        textTransform: "uppercase",
        stroke: { enabled: true, width: 6, color: "#000000" },
        highlight: { mode: "nenhum", color: "#FFE500", boxColor: null, scale: 1, keywords: [] },
        x: 50,
        y: 50,
        maxWidth: 90,
      },
      animation: {
        unit: "bloco",
        enter: {
          from: { scale: 1.35, opacity: 0 },
          durationInFrames: 10,
          delayInFrames: 0,
          easing: "ease-out",
          overshoot: 0,
          staggerInFrames: 0,
        },
        exit: { to: { opacity: 0 }, durationInFrames: 6, easing: "ease-out" },
      },
    },
    { maxWords: 1 },
  ),
  pillBranca: makePreset("Pill Branca", "legenda", {
    text: {
      fontFamily: "poppins",
      fontWeight: 600,
      fontSize: 48,
      color: "#111111",
      stroke: { enabled: false, width: 0, color: "#000000" },
      highlight: { mode: "nenhum", color: "#111111", boxColor: null, scale: 1, keywords: [] },
      background: {
        enabled: true,
        mode: "por-linha",
        color: "#FFFFFF",
        opacity: 100,
        paddingX: 18,
        paddingY: 8,
        radius: 999,
        backdropBlur: 0,
      },
      y: 78,
    },
    animation: {
      unit: "bloco",
      enter: {
        from: { y: 24, opacity: 0 },
        durationInFrames: 10,
        delayInFrames: 0,
        easing: "ease-out",
        overshoot: 0,
        staggerInFrames: 0,
      },
      exit: { to: { opacity: 0 }, durationInFrames: 6, easing: "ease-out" },
    },
  }),
  marcador: makePreset("Marcador", "legenda", {
    text: {
      fontFamily: "inter",
      fontWeight: 700,
      fontSize: 56,
      color: "#111111",
      stroke: { enabled: false, width: 0, color: "#000000" },
      highlight: {
        mode: "palavra-ativa",
        color: "#111111",
        boxColor: "#FFE600",
        scale: 1.04,
        keywords: [],
      },
      y: 72,
    },
    animation: {
      unit: "palavra",
      enter: {
        from: { scale: 0.9, opacity: 0 },
        durationInFrames: 8,
        delayInFrames: 0,
        easing: "spring",
        overshoot: 0.08,
        staggerInFrames: 1,
      },
      exit: { to: { opacity: 0 }, durationInFrames: 4, easing: "linear" },
    },
  }),
  tiktokNativo: makePreset("TikTok Nativo", "legenda", {
    text: {
      fontFamily: "inter",
      fontWeight: 600,
      fontSize: 44,
      stroke: { enabled: false, width: 0, color: "#000000" },
      highlight: { mode: "nenhum", color: "#FFFFFF", boxColor: null, scale: 1, keywords: [] },
      background: {
        enabled: true,
        mode: "por-linha",
        color: "#000000",
        opacity: 70,
        paddingX: 14,
        paddingY: 6,
        radius: 8,
        backdropBlur: 0,
      },
      y: 78,
    },
    animation: {
      unit: "bloco",
      enter: {
        from: { scale: 0.95, opacity: 0 },
        durationInFrames: 8,
        delayInFrames: 0,
        easing: "spring",
        overshoot: 0.05,
        staggerInFrames: 0,
      },
      exit: { to: { opacity: 0 }, durationInFrames: 4, easing: "linear" },
    },
  }),
  neon: makePreset("Neon", "legenda", {
    text: {
      fontFamily: "bebas",
      fontWeight: 400,
      fontSize: 72,
      color: "#00E5FF",
      textTransform: "uppercase",
      stroke: { enabled: false, width: 0, color: "#000000" },
      shadows: [
        { x: 0, y: 0, blur: 20, color: "#00E5FF" },
        { x: 0, y: 0, blur: 20, color: "#00E5FF" },
        { x: 0, y: 0, blur: 20, color: "#00E5FF" },
      ],
      highlight: { mode: "nenhum", color: "#00E5FF", boxColor: null, scale: 1, keywords: [] },
      y: 50,
    },
    animation: {
      unit: "palavra",
      enter: {
        from: { blur: 8, opacity: 0 },
        durationInFrames: 10,
        delayInFrames: 0,
        easing: "ease-out",
        overshoot: 0,
        staggerInFrames: 2,
      },
      exit: { to: { opacity: 0 }, durationInFrames: 6, easing: "ease-out" },
    },
  }),
  minimal: makePreset("Minimal", "legenda", {
    text: {
      fontFamily: "inter",
      fontWeight: 500,
      fontSize: 48,
      textTransform: "none",
      stroke: { enabled: false, width: 0, color: "#000000" },
      shadows: [{ x: 0, y: 6, blur: 14, color: "rgba(0,0,0,0.55)" }],
      highlight: { mode: "nenhum", color: "#FFFFFF", boxColor: null, scale: 1, keywords: [] },
      y: 78,
    },
    animation: {
      unit: "bloco",
      enter: {
        from: { opacity: 0 },
        durationInFrames: 10,
        delayInFrames: 0,
        easing: "ease-out",
        overshoot: 0,
        staggerInFrames: 0,
      },
      exit: { to: { opacity: 0 }, durationInFrames: 6, easing: "ease-out" },
    },
  }),
  manchete: makePreset("Manchete", "gancho", {
    text: {
      fontFamily: "archivo",
      fontWeight: 400,
      fontSize: 64,
      textTransform: "uppercase",
      maxWidth: 100,
      color: "#FFFFFF",
      stroke: { enabled: false, width: 0, color: "#000000" },
      background: {
        enabled: true,
        mode: "bloco",
        color: "#EE0000",
        opacity: 100,
        paddingX: 28,
        paddingY: 16,
        radius: 0,
        backdropBlur: 0,
      },
      highlight: { mode: "nenhum", color: "#FFFFFF", boxColor: null, scale: 1, keywords: [] },
      x: 50,
      y: 18,
    },
    animation: {
      unit: "bloco",
      enter: {
        from: { x: -60, opacity: 0 },
        durationInFrames: 10,
        delayInFrames: 0,
        easing: "ease-out",
        overshoot: 0,
        staggerInFrames: 0,
      },
      exit: { to: { opacity: 0 }, durationInFrames: 6, easing: "ease-out" },
    },
  }),
  impacto3D: makePreset("Impacto 3D", "gancho", {
    text: {
      fontFamily: "anton",
      fontWeight: 400,
      fontSize: 96,
      textTransform: "uppercase",
      stroke: { enabled: false, width: 0, color: "#000000" },
      shadows: [{ x: 8, y: 8, blur: 0, color: "#FF6B00" }],
      highlight: { mode: "nenhum", color: "#FFFFFF", boxColor: null, scale: 1, keywords: [] },
      y: 22,
    },
    animation: {
      unit: "bloco",
      enter: {
        from: { scale: 0.6, opacity: 0 },
        durationInFrames: 10,
        delayInFrames: 0,
        easing: "spring",
        overshoot: 0.25,
        staggerInFrames: 0,
      },
      exit: { to: { scale: 0.8, opacity: 0 }, durationInFrames: 6, easing: "ease-out" },
    },
  }),
  fitaTorta: makePreset("Fita Torta", "gancho", {
    text: {
      fontFamily: "poppins",
      fontWeight: 800,
      fontSize: 52,
      color: "#111111",
      textTransform: "uppercase",
      stroke: { enabled: false, width: 0, color: "#000000" },
      background: {
        enabled: true,
        mode: "bloco",
        color: "#FFE600",
        opacity: 100,
        paddingX: 24,
        paddingY: 12,
        radius: 4,
        backdropBlur: 0,
      },
      highlight: { mode: "nenhum", color: "#111111", boxColor: null, scale: 1, keywords: [] },
      y: 24,
      rotation: -3,
    },
    animation: {
      unit: "bloco",
      enter: {
        from: { scale: 0.6, opacity: 0 },
        durationInFrames: 10,
        delayInFrames: 0,
        easing: "spring",
        overshoot: 0.3,
        staggerInFrames: 0,
      },
      exit: { to: { opacity: 0 }, durationInFrames: 6, easing: "ease-out" },
    },
  }),
  seloAvaliacao: makePreset("Selo Avaliação", "prova", {
    text: {
      fontFamily: "poppins",
      fontWeight: 700,
      fontSize: 36,
      stroke: { enabled: false, width: 0, color: "#000000" },
      background: {
        enabled: true,
        mode: "bloco",
        color: "rgba(0,0,0,0.7)",
        opacity: 100,
        paddingX: 22,
        paddingY: 12,
        radius: 999,
        backdropBlur: 12,
      },
      highlight: { mode: "nenhum", color: "#FFFFFF", boxColor: null, scale: 1, keywords: [] },
      y: 50,
    },
    animation: {
      unit: "bloco",
      enter: {
        from: { scale: 0.6, opacity: 0 },
        durationInFrames: 8,
        delayInFrames: 0,
        easing: "spring",
        overshoot: 0.15,
        staggerInFrames: 0,
      },
      exit: { to: { opacity: 0 }, durationInFrames: 4, easing: "linear" },
    },
  }),
  contador: makePreset("Contador", "prova", {
    text: {
      fontFamily: "anton",
      fontWeight: 400,
      fontSize: 120,
      textTransform: "uppercase",
      gradient: { enabled: true, from: "#FFE600", to: "#FF6B00", angle: 90 },
      stroke: { enabled: false, width: 0, color: "#000000" },
      highlight: { mode: "nenhum", color: "#FFFFFF", boxColor: null, scale: 1, keywords: [] },
      y: 48,
    },
    animation: {
      unit: "bloco",
      enter: {
        from: { scale: 1.35, opacity: 0 },
        durationInFrames: 10,
        delayInFrames: 0,
        easing: "ease-out",
        overshoot: 0,
        staggerInFrames: 0,
      },
      exit: { to: { opacity: 0 }, durationInFrames: 6, easing: "ease-out" },
    },
  }),
  carrinhoLaranja: makePreset("Carrinho Laranja", "cta", {
    text: {
      fontFamily: "poppins",
      fontWeight: 700,
      fontSize: 56,
      stroke: { enabled: false, width: 0, color: "#000000" },
      shadows: [{ x: 0, y: 6, blur: 20, color: "rgba(0,0,0,0.35)" }],
      background: {
        enabled: true,
        mode: "bloco",
        color: "#FF6B00",
        opacity: 100,
        paddingX: 40,
        paddingY: 24,
        radius: 999,
        backdropBlur: 0,
      },
      highlight: { mode: "nenhum", color: "#FFFFFF", boxColor: null, scale: 1, keywords: [] },
      x: 50,
      y: 80,
    },
    animation: {
      unit: "bloco",
      enter: {
        from: { scale: 0.8, opacity: 0 },
        durationInFrames: 10,
        delayInFrames: 0,
        easing: "spring",
        overshoot: 0.2,
        staggerInFrames: 0,
      },
      exit: { to: { opacity: 0 }, durationInFrames: 6, easing: "ease-out" },
      loop: { type: "pulse", amplitude: 0.04, speed: 1.2 },
    },
  }),
  setaTexto: makePreset("Seta + Texto", "cta", {
    text: {
      fontFamily: "poppins",
      fontWeight: 700,
      fontSize: 48,
      stroke: { enabled: false, width: 0, color: "#000000" },
      highlight: { mode: "nenhum", color: "#FFFFFF", boxColor: null, scale: 1, keywords: [] },
      y: 82,
    },
    animation: {
      unit: "bloco",
      enter: {
        from: { y: 16, opacity: 0 },
        durationInFrames: 10,
        delayInFrames: 0,
        easing: "ease-out",
        overshoot: 0,
        staggerInFrames: 0,
      },
      exit: { to: { opacity: 0 }, durationInFrames: 6, easing: "ease-out" },
      loop: { type: "float", amplitude: 6, speed: 1.1 },
    },
  }),
  urgencia: makePreset("Urgência", "cta", {
    text: {
      fontFamily: "anton",
      fontWeight: 400,
      fontSize: 64,
      color: "#FF3B30",
      textTransform: "uppercase",
      stroke: { enabled: true, width: 4, color: "#000000" },
      highlight: { mode: "nenhum", color: "#FF3B30", boxColor: null, scale: 1, keywords: [] },
      y: 80,
    },
    animation: {
      unit: "bloco",
      enter: {
        from: { scale: 0.8, opacity: 0 },
        durationInFrames: 8,
        delayInFrames: 0,
        easing: "spring",
        overshoot: 0.15,
        staggerInFrames: 0,
      },
      exit: { to: { opacity: 0 }, durationInFrames: 4, easing: "linear" },
      loop: { type: "shake", amplitude: 1.5, speed: 8 },
    },
  }),
}

export function canWritePresetId(id: string): boolean {
  if (!id || id === LEGADO_PRESET_ID) return false
  return !(FACTORY_PRESET_IDS as readonly string[]).includes(id)
}

type ExtraPreset = Pick<UserPreset, "id" | "style" | "group"> &
  Partial<Pick<UserPreset, "label" | "maxWords">>

let extraPresets = new Map<string, ExtraPreset>()

export function setExtraPresets(presets: ExtraPreset[]): void {
  extraPresets = new Map()
  for (const preset of presets) {
    if (!canWritePresetId(preset.id)) continue
    extraPresets.set(preset.id, preset)
  }
}

export function extraPresetCatalog(): Record<string, ExtraPreset> {
  return Object.fromEntries(extraPresets)
}

export function lookupNamedPreset(
  presetId: string,
  catalog?: Record<string, ExtraPreset | Preset>,
): Preset | undefined {
  const factory = PRESETS[presetId]
  if (factory && presetId !== LEGADO_PRESET_ID) return factory
  const fromArg = catalog?.[presetId]
  if (fromArg) return fromArg
  return extraPresets.get(presetId)
}

export function getPresetStyle(presetId: string | undefined): InsertStyle {
  if (presetId && PRESETS[presetId]) return PRESETS[presetId]!.style
  if (presetId) {
    const extra = extraPresets.get(presetId)
    if (extra) return extra.style
  }
  return PRESETS[LEGADO_PRESET_ID]!.style
}

export function factoryPresetsInGroup(group: PresetGroup): Array<{
  id: string
  label: string
  group: PresetGroup
}> {
  return FACTORY_PRESET_IDS.filter((id) => PRESETS[id]?.group === group).map((id) => ({
    id,
    label: PRESETS[id]!.label,
    group: PRESETS[id]!.group,
  }))
}

export function factoryPresetFontIds(): string[] {
  const ids = new Set<string>()
  for (const id of FACTORY_PRESET_IDS) {
    const family = PRESETS[id]?.style.text.fontFamily
    if (family) ids.add(family)
  }
  return [...ids]
}
