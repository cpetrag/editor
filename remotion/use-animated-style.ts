import { useCurrentFrame, useVideoConfig } from "remotion"

import { animatedCssAt, type AnimatedCss } from "../lib/style/anim-engine.ts"
import type { Animation } from "../lib/style/types.ts"

export function useAnimatedStyle(
  anim: Animation,
  indexInCard: number,
  cardStartFrame: number,
  cardDurationFrames: number,
): AnimatedCss {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return animatedCssAt({
    anim,
    indexInCard,
    cardStartFrame,
    cardDurationFrames,
    frame,
    fps,
  })
}
