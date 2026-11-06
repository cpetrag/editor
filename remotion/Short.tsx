import type { CSSProperties } from "react"
import {
  AbsoluteFill,
  Html5Audio,
  Html5Video,
  OffthreadVideo,
  useCurrentFrame,
  useRemotionEnvironment,
} from "remotion"

import { getVideoRect } from "../lib/export/cover.ts"
import { sourceTransformAt } from "../lib/source-segments.ts"
import { loadRenderFonts } from "./load-fonts.ts"
import { InsertRenderer } from "./InsertRenderer.tsx"
import { sourceTimeFromFrame, trimStartOf, type RenderProps } from "./types.ts"

function BackgroundVideo({
  src,
  width,
  height,
  sourceWidth,
  sourceHeight,
  transform,
  trimBeforeFrames,
}: {
  src: string
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  transform: RenderProps["video"]["transform"]
  trimBeforeFrames: number
}) {
  const env = useRemotionEnvironment()
  const rect = getVideoRect(transform, sourceWidth, sourceHeight, width, height)
  const wrap: CSSProperties = {
    position: "absolute",
    left: rect.dx,
    top: rect.dy,
    width: rect.dw,
    height: rect.dh,
  }
  const fill: CSSProperties = { width: "100%", height: "100%", objectFit: "fill" }
  const trimBefore = trimBeforeFrames > 0 ? trimBeforeFrames : undefined
  if (!src) return null
  if (env.isPlayer || src.startsWith("blob:")) {
    return (
      <div data-source-framing="" style={wrap}>
        <Html5Video src={src} style={fill} trimBefore={trimBefore} />
      </div>
    )
  }
  return (
    <div data-source-framing="" style={wrap}>
      <OffthreadVideo src={src} style={fill} trimBefore={trimBefore} />
    </div>
  )
}

export function Short(props: RenderProps) {
  const frame = useCurrentFrame()
  const time = sourceTimeFromFrame(frame, props)
  const trimBeforeFrames = Math.round(trimStartOf(props) * props.fps)
  const env = useRemotionEnvironment()
  // Player pinta inserts no OverlayCanvas; carregar o catálogo via gstatic
  // aqui dispara o fallback de fonte lenta do Chrome ao gerar legendas.
  if (!env.isPlayer) loadRenderFonts(props)

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <BackgroundVideo
        src={props.video.src}
        width={props.width}
        height={props.height}
        sourceWidth={props.video.width ?? props.width}
        sourceHeight={props.video.height ?? props.height}
        transform={sourceTransformAt(props.video, time)}
        trimBeforeFrames={trimBeforeFrames}
      />
      {props.audio ? (
        <Html5Audio src={props.audio.src} volume={props.audio.volume} />
      ) : null}
      {/* Player freezes this canvas while paused; OverlayCanvas paints inserts instead. */}
      {env.isPlayer ? null : <InsertRenderer props={props} time={time} />}
    </AbsoluteFill>
  )
}
