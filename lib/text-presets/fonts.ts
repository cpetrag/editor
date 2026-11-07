export const TEXT_PRESET_FONT_FILES = [
  { id: "anton", family: "Anton", weight: 400, file: "Anton-Regular.woff2", label: "Anton" },
  { id: "archivo", family: "Archivo Black", weight: 400, file: "ArchivoBlack-Regular.woff2", label: "Archivo Black" },
  { id: "inter", family: "Inter", weight: 400, file: "Inter-Variable.woff2", label: "Inter" },
  { id: "poppins", family: "Poppins", weight: 700, file: "Poppins-Bold.woff2", label: "Poppins" },
  { id: "caveat", family: "Caveat", weight: 700, file: "Caveat-Bold.woff2", label: "Caveat" },
  { id: "courier", family: "Courier Prime", weight: 700, file: "CourierPrime-Bold.woff2", label: "Courier Prime" },
  { id: "archivo-black", family: "Archivo Black", weight: 400, file: "ArchivoBlack-Regular.woff2", label: "Archivo Black" },
  { id: "permanent-marker", family: "Permanent Marker", weight: 400, file: "PermanentMarker-Regular.woff2", label: "Permanent Marker" },
  { id: "pacifico", family: "Pacifico", weight: 400, file: "Pacifico-Regular.woff2", label: "Pacifico" },
  { id: "fredoka", family: "Fredoka", weight: 700, file: "Fredoka-Bold.woff2", label: "Fredoka" },
] as const

export type TextPresetFontId = (typeof TEXT_PRESET_FONT_FILES)[number]["id"]

export function textPresetFontUrl(file: string): string {
  return `/fonts/${file}`
}

let textPresetFontsOnce: Promise<void> | null = null

export function resetTextPresetFontsCache(): void {
  textPresetFontsOnce = null
}

async function loadTextPresetFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return
  const loads: Promise<FontFace>[] = []
  for (const spec of TEXT_PRESET_FONT_FILES) {
    const url = textPresetFontUrl(spec.file)
    try {
      const face = new FontFace(spec.family, `url(${url})`, {
        weight: String(spec.weight),
        style: "style" in spec && spec.style === "italic" ? "italic" : "normal",
        display: "block",
      })
      loads.push(
        face.load().then((loaded) => {
          document.fonts.add(loaded)
          return loaded
        }),
      )
    } catch {
      // FontFace pode falhar em JSDOM; o caller segue com document.fonts.load.
    }
  }
  try {
    await Promise.all(loads)
  } catch {
    // preview continua com fallback se um arquivo faltar
  }
  for (const spec of TEXT_PRESET_FONT_FILES) {
    try {
      await document.fonts.load(`${spec.weight} 56px "${spec.family}"`)
    } catch {
      // ignore
    }
  }
  try {
    const italic = new FontFace("Playfair Display", "url(/fonts/PlayfairDisplay-BoldItalic.woff2)", {
      weight: "700",
      style: "italic",
      display: "block",
    })
    document.fonts.add(await italic.load())
    await document.fonts.load('italic 700 56px "Playfair Display"')
  } catch {
    // o itálico entra quando o arquivo está no ar
  }
}

export async function ensureTextPresetFontsReady(): Promise<void> {
  textPresetFontsOnce ??= loadTextPresetFonts()
  return textPresetFontsOnce
}

export function isTextPresetFontLoaded(family: string, weight: number): boolean {
  if (typeof document === "undefined" || !document.fonts?.check) return false
  try {
    return document.fonts.check(`${weight} 32px "${family}"`)
  } catch {
    return false
  }
}
