import { animatedPoseAt, IDENTITY_POSE, type AnimPose } from "./anim-engine.ts"
import { activeWordIndex, wordHighlight, type WordPaint } from "./highlight.ts"
import { backgroundRects, layoutTextTokens, type BgRect, type LaidToken } from "./text-paint.ts"
import type { InsertStyle, TextStyle } from "./types.ts"

export type PlanWord = {
  text: string
  start: number
  end: number
}

export type PlannedToken = LaidToken &
  WordPaint & {
    pose: AnimPose
    word?: PlanWord
  }

export type StyledTextPlan = {
  backgrounds: BgRect[]
  tokens: PlannedToken[]
}

function highlightNeedsWordTimings(mode: TextStyle["highlight"]["mode"]): boolean {
  return mode === "palavra-ativa" || mode === "karaoke-fill"
}

function highlightForPlan(
  words: PlanWord[],
  highlight: TextStyle["highlight"],
): TextStyle["highlight"] {
  if (words.length === 0 && highlightNeedsWordTimings(highlight.mode)) {
    return { ...highlight, mode: "nenhum" }
  }
  return highlight
}

export function captionPaintSkipReason(input: {
  id: string
  preset?: string
  blockW: number
  blockH: number
  text: string
  tokenCount: number
  visibleGlyphs: number
  words: number
}): string | null {
  if (!(input.blockW > 0 && input.blockH > 0)) return null
  if (!input.text.trim()) return null
  if (input.tokenCount <= 0) return "tokens-empty"
  if (input.visibleGlyphs <= 0) return "zero-glyphs"
  return null
}

export function warnInvisibleCaptionPaint(input: {
  id: string
  preset?: string
  blockW: number
  blockH: number
  text: string
  tokenCount: number
  visibleGlyphs: number
  words: number
}): string | null {
  const reason = captionPaintSkipReason(input)
  if (!reason) return null
  if (process.env.NODE_ENV !== "production") {
    console.warn("[caption-paint] zero glyphs", {
      id: input.id,
      preset: input.preset,
      reason,
    })
  }
  return reason
}

export function visibleGlyphCount(plan: StyledTextPlan): number {
  return plan.tokens.filter((token) => token.text.trim() && token.pose.opacity > 0.01).length
}

export function planStyledTextDraw(input: {
  lines: string[]
  words: PlanWord[]
  style: InsertStyle
  time: number
  measure: (text: string) => number
  lineHeight: number
  blockW: number
  blockH: number
  spaceWidth: number
  fps: number
  cardStart: number
  cardDuration: number
  skipEnter?: boolean
}): StyledTextPlan {
  const { style, time, fps } = input
  const highlight = highlightForPlan(input.words, style.text.highlight)
  const simpleText =
    input.words.length === 0 && highlightNeedsWordTimings(style.text.highlight.mode)
  const animation =
    input.skipEnter
      ? {
          ...style.animation,
          enter: { ...style.animation.enter, durationInFrames: 0, from: {}, delayInFrames: 0 },
        }
      : style.animation
  const tokens = layoutTextTokens({
    lines: input.lines,
    unit: simpleText ? "bloco" : animation.unit,
    measure: input.measure,
    lineHeight: input.lineHeight,
    blockH: input.blockH,
    spaceWidth: input.spaceWidth,
  })
  const activeIndex = activeWordIndex(input.words, time)
  const cardStartFrame = input.cardStart * fps
  const cardDurationFrames = Math.max(0, input.cardDuration * fps)
  const frame = time * fps

  const planned: PlannedToken[] = tokens.map((token) => {
    const word = input.words[token.wordIndex]
    const paint = wordHighlight({
      token: token.text,
      word,
      time,
      isActive: token.wordIndex === activeIndex,
      highlight,
      baseColor: style.text.color,
    })
    const pose =
      simpleText || animation.unit === "bloco"
        ? IDENTITY_POSE
        : animatedPoseAt({
            anim: animation,
            indexInCard: token.unitIndex,
            cardStartFrame,
            cardDurationFrames,
            frame,
            fps,
          })
    return { ...token, ...paint, pose, word }
  })

  const blockPose =
    !simpleText && animation.unit === "bloco"
      ? animatedPoseAt({
          anim: animation,
          indexInCard: 0,
          cardStartFrame,
          cardDurationFrames,
          frame,
          fps,
        })
      : IDENTITY_POSE

  if (!simpleText && animation.unit === "bloco") {
    for (const token of planned) token.pose = blockPose
  }

  const lineBoxes = input.lines.map((line, lineIndex) => ({
    width: input.measure(line),
    y: -input.blockH / 2 + input.lineHeight / 2 + lineIndex * input.lineHeight,
    height: input.lineHeight,
  }))

  const wordBoxes = wordBoxesFromTokens(planned, input.lineHeight)
  const bg = style.text.background
  const backgrounds = bg.enabled
    ? backgroundRects({
        mode: bg.mode,
        blockW: input.blockW,
        blockH: input.blockH,
        lines: lineBoxes,
        words: wordBoxes,
        padX: bg.paddingX,
        padY: bg.paddingY,
        radius: bg.radius,
      })
    : []

  return { backgrounds, tokens: planned }
}

function wordBoxesFromTokens(
  tokens: LaidToken[],
  lineHeight: number,
): Array<{ x: number; y: number; width: number; height: number }> {
  const groups = new Map<number, LaidToken[]>()
  for (const token of tokens) {
    const list = groups.get(token.wordIndex) ?? []
    list.push(token)
    groups.set(token.wordIndex, list)
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, group]) => {
      const first = group[0]!
      const minX = Math.min(...group.map((token) => token.x))
      const maxX = Math.max(...group.map((token) => token.x + token.width))
      return {
        x: minX,
        y: first.y,
        width: maxX - minX,
        height: lineHeight,
      }
    })
}
