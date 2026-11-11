export type CaptionPrefs = {
  maxWords: number
  maxChars: number
  emphasizeSales: boolean
  saleTerms: string[]
  dodgeInserts: boolean
  /** Estilo salvo aplicado às legendas novas. */
  lookId?: string
}

export const DEFAULT_CAPTION_PREFS: CaptionPrefs = {
  maxWords: 4,
  maxChars: 22,
  emphasizeSales: true,
  dodgeInserts: true,
  saleTerms: [
    "cupom",
    "cupons",
    "grátis",
    "gratis",
    "frete",
    "desconto",
    "promoção",
    "promocao",
    "promoções",
    "promocoes",
    "oferta",
    "ofertas",
    "hoje",
    "agora",
    "Saiba Mais",
    "link",
  ],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback
  return Math.round(Math.min(max, Math.max(min, raw)))
}

export function resolveCaptionPrefs(partial?: Partial<CaptionPrefs> | null): CaptionPrefs {
  const terms = Array.isArray(partial?.saleTerms)
    ? partial.saleTerms.filter((term) => typeof term === "string" && term.trim()).map((term) => term.trim())
    : DEFAULT_CAPTION_PREFS.saleTerms
  return {
    maxWords: clampInt(partial?.maxWords, DEFAULT_CAPTION_PREFS.maxWords, 1, 6),
    maxChars: clampInt(partial?.maxChars, DEFAULT_CAPTION_PREFS.maxChars, 8, 48),
    emphasizeSales: partial?.emphasizeSales ?? DEFAULT_CAPTION_PREFS.emphasizeSales,
    dodgeInserts: partial?.dodgeInserts ?? DEFAULT_CAPTION_PREFS.dodgeInserts,
    saleTerms: terms.length > 0 ? terms : [...DEFAULT_CAPTION_PREFS.saleTerms],
    ...(partial?.lookId ? { lookId: partial.lookId } : {}),
  }
}

export function parseCaptionPrefs(raw: unknown): CaptionPrefs | undefined {
  if (!isRecord(raw)) return undefined
  return resolveCaptionPrefs({
    maxWords: typeof raw.maxWords === "number" ? raw.maxWords : undefined,
    maxChars: typeof raw.maxChars === "number" ? raw.maxChars : undefined,
    emphasizeSales: typeof raw.emphasizeSales === "boolean" ? raw.emphasizeSales : undefined,
    dodgeInserts: typeof raw.dodgeInserts === "boolean" ? raw.dodgeInserts : undefined,
    saleTerms: Array.isArray(raw.saleTerms)
      ? raw.saleTerms.filter((item): item is string => typeof item === "string")
      : undefined,
    lookId: typeof raw.lookId === "string" ? raw.lookId : undefined,
  })
}
