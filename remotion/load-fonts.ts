import { loadFont as loadAlfaSlabOne } from "@remotion/google-fonts/AlfaSlabOne"
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton"
import { loadFont as loadArchivoBlack } from "@remotion/google-fonts/ArchivoBlack"
import { loadFont as loadBaloo2 } from "@remotion/google-fonts/Baloo2"
import { loadFont as loadBebasNeue } from "@remotion/google-fonts/BebasNeue"
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist"
import { loadFont as loadInter } from "@remotion/google-fonts/Inter"
import { loadFont as loadLilitaOne } from "@remotion/google-fonts/LilitaOne"
import { loadFont as loadLuckiestGuy } from "@remotion/google-fonts/LuckiestGuy"
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat"
import { loadFont as loadNunito } from "@remotion/google-fonts/Nunito"
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald"
import { loadFont as loadPlayfairDisplay } from "@remotion/google-fonts/PlayfairDisplay"
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins"
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk"
import { loadFont as loadTitanOne } from "@remotion/google-fonts/TitanOne"

import { fontIdsForRender } from "../lib/compose/fonts.ts"
import { WEIGHTS_BY_FONT, parseFontId, type FontId, type FontWeight } from "../lib/compose/insert-style.ts"
import { ensureTextPresetFontsReady } from "../lib/text-presets/fonts.ts"
import type { RenderProps } from "./types.ts"

type FontLoader = (
  style?: "normal",
  options?: {
    weights?: string[]
    subsets?: Array<"latin" | "latin-ext">
  },
) => { waitUntilDone: () => Promise<undefined> }

const LOADERS: Record<FontId, FontLoader> = {
  geist: loadGeist as FontLoader,
  poppins: loadPoppins as FontLoader,
  bebas: loadBebasNeue as FontLoader,
  archivo: loadArchivoBlack as FontLoader,
  playfair: loadPlayfairDisplay as FontLoader,
  space: loadSpaceGrotesk as FontLoader,
  oswald: loadOswald as FontLoader,
  montserrat: loadMontserrat as FontLoader,
  anton: loadAnton as FontLoader,
  inter: loadInter as FontLoader,
  alfa: loadAlfaSlabOne as FontLoader,
  nunito: loadNunito as FontLoader,
  lilita: loadLilitaOne as FontLoader,
  luckiest: loadLuckiestGuy as FontLoader,
  baloo: loadBaloo2 as FontLoader,
  titan: loadTitanOne as FontLoader,
  caveat: hostedFontLoader("Caveat", "Caveat-Bold.woff2", "700"),
  courier: hostedFontLoader("Courier Prime", "CourierPrime-Bold.woff2", "700"),
}

function hostedFontLoader(family: string, file: string, weight: string): FontLoader {
  return () => ({
    waitUntilDone: async () => {
      if (typeof FontFace === "undefined" || typeof document === "undefined") return
      const face = new FontFace(family, `url(/fonts/${file})`, { weight, display: "block" })
      const loaded = await face.load()
      document.fonts.add(loaded)
    },
  })
}

function weightStrings(fontId: FontId): string[] {
  return WEIGHTS_BY_FONT[fontId].map((weight: FontWeight) => String(weight))
}

function usedFontIds(props: RenderProps): FontId[] {
  const ids = [
    ...fontIdsForRender({
      brand: { fontId: props.brand.fontId },
      inserts: props.inserts,
      captionStyle: props.captionStyle,
      styleRef: props.styleRef,
      tracks: props.tracks,
    }),
    ...(props.watermark?.text ? ["geist"] : []),
  ]
  const unique: FontId[] = []
  for (const raw of ids.length > 0 ? ids : ["geist"]) {
    const fontId = parseFontId(raw) ?? "geist"
    if (!unique.includes(fontId)) unique.push(fontId)
  }
  return unique
}

const startedFonts = new Map<FontId, { waitUntilDone: () => Promise<undefined> }>()
const waitFontsByKey = new Map<string, Promise<void>>()

function startFont(fontId: FontId): { waitUntilDone: () => Promise<undefined> } {
  const cached = startedFonts.get(fontId)
  if (cached) return cached
  const load = LOADERS[fontId] ?? LOADERS.geist
  const started = load("normal", {
    subsets: ["latin"],
    weights: weightStrings(fontId),
  })
  startedFonts.set(fontId, started)
  return started
}

/** Registers every font used by the composition. `loadFont()` already delayRenders. */
export function loadRenderFonts(props: RenderProps): void {
  for (const fontId of usedFontIds(props)) {
    startFont(fontId)
  }
}

export async function waitForRenderFonts(props: RenderProps): Promise<void> {
  const key = usedFontIds(props).join(",")
  const cached = waitFontsByKey.get(key)
  if (cached) return cached
  const pending = (async () => {
    await ensureTextPresetFontsReady()
    await Promise.all(usedFontIds(props).map((fontId) => startFont(fontId).waitUntilDone()))
  })()
  waitFontsByKey.set(key, pending)
  return pending
}
