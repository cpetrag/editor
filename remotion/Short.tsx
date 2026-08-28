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
import { loadRenderFonts } from "./load-fonts.ts"
import { InsertRenderer } from "./InsertRenderer.tsx"
import { secondsFromFrame, type RenderProps } from "./types.ts"

function BackgroundVideo({
  src,
  width,
  height,
  sourceWidth,
  sourceHeight,
  transform,
}: {
  src: string
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  transform: RenderProps["video"]["transform"]
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
  if (!src) return null
  if (env.isPlayer || src.startsWith("blob:")) {
    return (
      <div data-source-framing="" style={wrap}>
        <Html5Video src={src} style={fill} />
      </div>
    )
  }
  return (
    <div data-source-framing="" style={wrap}>
      <OffthreadVideo src={src} style={fill} />
    </div>
  )
}

export function Short(props: RenderProps) {
  const frame = useCurrentFrame()
  const time = secondsFromFrame(frame, props.fps)
  loadRenderFonts(props)

  const env = useRemotionEnvironment()

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <BackgroundVideo
        src={props.video.src}
        width={props.width}
        height={props.height}
        sourceWidth={props.video.width ?? props.width}
        sourceHeight={props.video.height ?? props.height}
        transform={props.video.transform}
      />
      {props.audio ? (
        <Html5Audio src={props.audio.src} volume={props.audio.volume} />
      ) : null}
      {/* Player freezes this canvas while paused; OverlayCanvas paints inserts instead. */}
      {env.isPlayer ? null : <InsertRenderer props={props} time={time} />}
    </AbsoluteFill>
  )
}
