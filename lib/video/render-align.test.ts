import assert from "node:assert/strict"
import { test } from "node:test"

import { defaultCompositionAudio } from "../audio/types.ts"
import type { RenderProps } from "../../remotion/types.ts"
import { alignRenderTimeline } from "./render-align.ts"

function props(durationInSeconds: number): RenderProps {
  const audio = defaultCompositionAudio()
  audio.tracks = [
    {
      id: "voice",
      kind: "voice",
      fileId: "v",
      fileName: "fala.mp3",
      duration: 13.48,
      start: 0,
      trimIn: 0,
      trimOut: 13.48,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      loop: false,
      muted: false,
      src: "http://127.0.0.1/voice.mp3",
    },
  ]
  return {
    video: {
      src: "http://127.0.0.1/in.mp4",
      durationInSeconds,
      sourceDurationInSeconds: 5.73,
      sourceFps: 30,
      usefulDuration: 5.73,
      usefulStart: 0,
      playback: { speed: 0.85, fill: "pingpong", fit: "audio" },
      segments: [
        {
          kind: "fwd",
          srcStart: 0,
          srcEnd: 5.73,
          speed: 0.85,
          outStart: 0,
          outEnd: 37.59,
          cutIndex: 0,
        },
      ],
    },
    audio,
    fps: 30,
    width: 1080,
    height: 1920,
    inserts: [],
    brand: { fontId: "geist", logo: "" },
    captionPreset: "viral",
    captionStyle: {
      x: 50,
      y: 72,
      fontSize: 64,
      maxWidthPct: 84,
      fontFamily: "geist",
      fontWeight: 800,
      color: "#fff",
      highlightColor: "#FFE500",
      bgColor: "#000",
      strokeColor: "#000",
      strokeWidth: 6,
      rotation: 0,
    },
    stickerSrcs: {},
  }
}

test("props com 37,59 s voltam para a duração da locução", () => {
  const aligned = alignRenderTimeline(props(37.59))
  assert.ok(Math.abs(aligned.props.video.durationInSeconds - 13.48) < 1 / 30)
  assert.equal(aligned.needsReverse, true)
  assert.deepEqual(
    aligned.props.video.segments?.map((segment) => segment.kind),
    ["fwd", "rev"],
  )
  const end = aligned.props.video.segments?.at(-1)?.outEnd ?? 0
  assert.ok(Math.abs(end - aligned.props.video.durationInSeconds) < 1e-6)
})
