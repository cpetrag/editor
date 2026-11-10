import type { CSSProperties } from "react"
import {
  AbsoluteFill,
  Html5Audio,
  Html5Video,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useRemotionEnvironment,
} from "remotion"

import { trackOutputRange } from "../lib/audio/range.ts"
import { audioTrimFrames } from "../lib/audio/trim-frames.ts"
import { defaultCompositionAudio } from "../lib/audio/types.ts"
import { volumeAtTime, volumeContextFor } from "../lib/audio/volume.ts"
import { getVideoRect } from "../lib/export/cover.ts"
import { sourceTransformAt } from "../lib/source-segments.ts"
import { loadRenderFonts } from "./load-fonts.ts"
import { InsertRenderer } from "./InsertRenderer.tsx"
import { sourceTimeFromFrame, trimStartOf, type RenderAudio, type RenderProps } from "./types.ts"

function BackgroundVideo({
  src,
  width,
  height,
  sourceWidth,
  sourceHeight,
  transform,
  trimBeforeFrames,
  volume,
}: {
  src: string
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  transform: RenderProps["video"]["transform"]
  trimBeforeFrames: number
  volume: number
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
        <Html5Video src={src} style={fill} trimBefore={trimBefore} volume={volume} muted={volume <= 0} />
      </div>
    )
  }
  return (
    <div data-source-framing="" style={wrap}>
      <OffthreadVideo src={src} style={fill} trimBefore={trimBefore} volume={volume} muted={volume <= 0} />
    </div>
  )
}

function originalVolumeOf(audio: RenderAudio | undefined): number {
  const original = audio?.original ?? defaultCompositionAudio().original
  if (original.muted || !(original.volume > 0)) return 0
  return original.volume
}

function MixAudio({ props }: { props: RenderProps }) {
  const audio = props.audio
  if (!audio) return null
  const ctx = volumeContextFor(audio, props.video.durationInSeconds)
  return (
    <>
      {audio.tracks.map((track) => {
        if (!track.src || track.muted || !(track.volume > 0)) return null
        const range = trackOutputRange(track, props.video.durationInSeconds)
        if (!(range.end > range.start)) return null
        const frames = audioTrimFrames(track, props.fps)
        if (!frames) return null
        const from = Math.max(0, Math.round(range.start * props.fps))
        const durationInFrames = Math.max(1, Math.round((range.end - range.start) * props.fps))
        return (
          <Sequence key={track.id} from={from} durationInFrames={durationInFrames}>
            <Html5Audio
              src={track.src}
              trimBefore={frames.trimBefore}
              trimAfter={frames.trimAfter}
              loop={track.loop}
              volume={(frame) => volumeAtTime(track, range.start + frame / props.fps, ctx)}
            />
          </Sequence>
        )
      })}
    </>
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
        volume={originalVolumeOf(props.audio)}
      />
      <MixAudio props={props} />
      {/* Player freezes this canvas while paused; OverlayCanvas paints inserts instead. */}
      {env.isPlayer ? null : <InsertRenderer props={props} time={time} />}
    </AbsoluteFill>
  )
}
