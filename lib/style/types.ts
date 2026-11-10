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
  /** Cor do trecho entre asteriscos. `slot:*` resolve com o kit. */
  accent?: string
  italic?: boolean
  accentFont?: string
  outerStroke?: { width: number; color: string }
  longShadow?: { length: number; color: string }
  priceLayout?: boolean
  underline?: boolean
  boxShadow?: boolean
  shape?: "fita" | "balao" | "etiqueta" | "selo" | "tarja"
  glass?: boolean
  highlightBar?: { color: string; skew: number }
}

export type AnimTarget = {
  scale?: number
  x?: number
  y?: number
  rotate?: number
  opacity?: number
  blur?: number
  scaleX?: number
  scaleY?: number
  rotateX?: number
  rotateY?: number
  skewX?: number
  clip?: number
  jitter?: number
}

export type EasingName =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "spring"
  | "back-in"
  | "back-out"
  | "elastic-out"
  | "bounce-out"

export type EmphasisHit = {
  type: "punch" | "tremida" | "flash" | "giro" | "pulo"
  atFrame: number
  durationInFrames: number
  strength: number
}

export type Animation = {
  unit: "bloco" | "palavra" | "letra"
  enter: {
    from: AnimTarget
    durationInFrames: number
    delayInFrames: number
    easing: EasingName
    overshoot: number
    staggerInFrames: number
    recipeId?: string
  }
  exit: {
    to: AnimTarget
    durationInFrames: number
    easing: EasingName
    recipeId?: string
    staggerInFrames?: number
  }
  loop: {
    type:
      | "nenhum"
      | "pulse"
      | "shake"
      | "float"
      | "batimento"
      | "tremor"
      | "chacoalho"
      | "flutuar"
      | "quicar"
      | "balanco"
      | "gelatina"
      | "onda"
      | "brilho"
      | "piscar"
      | "inclinar3d"
    amplitude: number
    speed: number
    recipeId?: string
  }
  emphasis?: EmphasisHit[]
  origin?: "centro" | "base" | "topo"
  order?: "inicio" | "fim" | "centro" | "aleatorio"
  intensity?: number
  speed?: number
  packId?: string
  clipDir?: "esq" | "dir" | "cima" | "baixo"
  /** `final`: o frame 0 do insert já sai legível (capa). `play`: a entrada começa do zero. */
  entryFromFrame0?: "final" | "play"
}

export type InsertStyle = { text: TextStyle; animation: Animation }

export type StyleRef = {
  presetId: string
  overrides: DeepPartial<InsertStyle>
}

export type PresetGroup = "legenda" | "gancho" | "prova" | "cta" | "oferta"

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
