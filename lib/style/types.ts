export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepPartial<U>> | T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K]
}

export type TextStyle = {
  fontFamily: string
  fontWeight: number
  fontSize: number
  letterSpacing: number
  lineHeight: number
  textTransform: "none" | "uppercase"
  textAlign: "left" | "center" | "right"
  maxWidth: number
  color: string
  gradient: { enabled: boolean; from: string; to: string; angle: number }
  stroke: { enabled: boolean; width: number; color: string }
  shadows: { x: number; y: number; blur: number; color: string }[]
  background: {
    enabled: boolean
    mode: "bloco" | "por-linha" | "por-palavra"
    color: string
    opacity: number
    paddingX: number
    paddingY: number
    radius: number
    backdropBlur: number
  }
  highlight: {
    mode: "nenhum" | "palavra-ativa" | "karaoke-fill" | "palavras-chave"
    color: string
    boxColor: string | null
    scale: number
    keywords: string[]
  }
  x: number
  y: number
  rotation: number
  opacity: number
}

export type AnimTarget = {
  scale?: number
  x?: number
  y?: number
  rotate?: number
  opacity?: number
  blur?: number
}

export type Animation = {
  unit: "bloco" | "palavra" | "letra"
  enter: {
    from: AnimTarget
    durationInFrames: number
    delayInFrames: number
    easing: "linear" | "ease-out" | "spring"
    overshoot: number
    staggerInFrames: number
  }
  exit: {
    to: AnimTarget
    durationInFrames: number
    easing: "linear" | "ease-out" | "spring"
  }
  loop: { type: "nenhum" | "pulse" | "shake" | "float"; amplitude: number; speed: number }
}

export type InsertStyle = { text: TextStyle; animation: Animation }

export type StyleRef = {
  presetId: string
  overrides: DeepPartial<InsertStyle>
}

export type PresetGroup = "legenda" | "gancho" | "prova" | "cta"

export type Preset = {
  label: string
  group: PresetGroup
  style: InsertStyle
  maxWords?: number
}

export type UserPreset = Preset & {
  id: string
}

export type StyleLayer = {
  styleRef?: StyleRef
}

export type TrackId = "gancho" | "prova" | "cta"

export type Track = StyleLayer & { id?: TrackId }

export type Project = StyleLayer

export type Insert = StyleLayer
