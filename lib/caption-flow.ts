import { isSaleToken, markSaleWords } from "./caption-emphasis.ts"
import { linkCaptionsToVoice } from "./caption-link.ts"
import { resolveCaptionPrefs, type CaptionPrefs } from "./caption-prefs.ts"
import { normalizeCaptionLines } from "./caption-timing.ts"
import { tidyCaptionSpeech } from "./caption-speech.ts"
import { applyVocabularyToLines } from "./caption-vocab.ts"
import {
  fitCaptionLinesToOutput,
  groupCaptionLines,
  linesToCaptionInserts,
  type CaptionLine,
} from "./captions.ts"
import { insertKind, type CaptionWord, type CompositionInsert, type StyleRef } from "./composition.ts"

function sharedStyleRef(inserts: readonly CompositionInsert[]): StyleRef | undefined {
  return inserts.find((insert) => insertKind(insert) === "caption" && !insert.captionOwnStyle)?.styleRef
}

function withSharedStyle(inserts: CompositionInsert[], styleRef: StyleRef | undefined): CompositionInsert[] {
  if (!styleRef) return inserts
  return inserts.map((insert) =>
    insertKind(insert) === "caption" ? { ...insert, styleRef, captionOwnStyle: undefined } : insert,
  )
}

function emphasize(inserts: CompositionInsert[], prefs: CaptionPrefs, extraTerms: readonly string[]): CompositionInsert[] {
  const terms = [...prefs.saleTerms, ...extraTerms]
  return inserts.map((insert) => {
    if (insertKind(insert) !== "caption" || !insert.words) return insert
    return { ...insert, words: markSaleWords(insert.words, terms, prefs.emphasizeSales) }
  })
}

export function remarkCaptionWords(
  words: readonly CaptionWord[],
  prefs: Partial<CaptionPrefs> | undefined,
  vocabulary: readonly string[] = [],
): CaptionWord[] {
  const resolved = resolveCaptionPrefs(prefs)
  return markSaleWords(words, [...resolved.saleTerms, ...vocabulary], resolved.emphasizeSales)
}

export function remarkCaptionInserts(
  inserts: readonly CompositionInsert[],
  prefs: Partial<CaptionPrefs> | undefined,
  vocabulary: readonly string[] = [],
): CompositionInsert[] {
  const resolved = resolveCaptionPrefs(prefs)
  return emphasize([...inserts], resolved, vocabulary)
}

export function captionLinesFromWords(
  words: readonly CaptionWord[],
  prefs: Partial<CaptionPrefs> | undefined,
  vocabulary: readonly string[],
): CaptionLine[] {
  const resolved = resolveCaptionPrefs(prefs)
  const terms = [...resolved.saleTerms, ...vocabulary]
  const spoken = tidyCaptionSpeech(words)
  const grouped = groupCaptionLines(spoken, {
    maxWords: resolved.maxWords,
    maxChars: resolved.maxChars,
  }, (text) => isSaleToken(text, terms), terms.filter((term) => term.includes(" ")))
  return normalizeCaptionLines(applyVocabularyToLines(grouped, vocabulary))
}

export function buildCaptionInserts(input: {
  words: readonly CaptionWord[]
  outputDuration: number
  prefs?: Partial<CaptionPrefs>
  vocabulary?: readonly string[]
  styleRef?: StyleRef
  voice?: { id: string; start: number } | null
}): { inserts: CompositionInsert[]; dropped: number } {
  const vocabulary = input.vocabulary ?? []
  const prefs = resolveCaptionPrefs(input.prefs)
  const lines = captionLinesFromWords(input.words, prefs, vocabulary)
  const fitted = fitCaptionLinesToOutput(lines, input.outputDuration)
  let inserts = linesToCaptionInserts(fitted.lines, input.outputDuration)
  inserts = withSharedStyle(inserts, input.styleRef)
  inserts = emphasize(inserts, prefs, vocabulary)
  if (input.voice) inserts = linkCaptionsToVoice(inserts, { id: input.voice.id, start: input.voice.start })
  return { inserts, dropped: fitted.dropped }
}

export function regroupCaptions(
  inserts: readonly CompositionInsert[],
  outputDuration: number,
  prefs: Partial<CaptionPrefs> | undefined,
  vocabulary: readonly string[],
): CompositionInsert[] {
  const captions = inserts.filter((insert) => insertKind(insert) === "caption")
  const words = captions
    .flatMap((insert) => insert.words ?? [])
    .slice()
    .sort((a, b) => a.start - b.start)
  if (words.length === 0) return [...inserts]
  const voice = captions.find((insert) => insert.captionSource?.kind === "voice")?.captionSource
  const anchor = captions.find((insert) => insert.captionSource?.kind === "voice")
  const trackStart = anchor && voice ? anchor.start - voice.offset : 0
  const built = buildCaptionInserts({
    words,
    outputDuration,
    prefs,
    vocabulary,
    styleRef: sharedStyleRef(inserts),
    voice: voice ? { id: voice.trackId, start: trackStart } : null,
  })
  return [...inserts.filter((insert) => insertKind(insert) !== "caption"), ...built.inserts]
}
