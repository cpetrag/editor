import { test } from "node:test"
import assert from "node:assert/strict"

import {
  DEFAULT_CAPTION_STYLE,
  DEFAULT_VIDEO_BITRATE,
  COMPOSITION_VERSION,
  type Composition,
  type CompositionInsert,
} from "../lib/composition.ts"
import {
  calculateShortMetadata,
  defaultRenderProps,
  isRenderSafeVideoSrc,
  secondsFromFrame,
  sourceTimeFromFrame,
  toCliRenderProps,
  toRenderProps,
} from "./types.ts"
import { layoutInserts } from "../lib/insert-layout.ts"
import { sourceTransformAt } from "../lib/source-segments.ts"

function sampleInsert(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "i1",
    type: "alerta-desconto",
    start: 1.2,
    duration: 3.4,
    text: "50% OFF",
    anchor: "center",
    animIn: "pop",
    animOut: "none",
    ...patch,
  }
}

function sampleComposition(patch: Partial<Composition> = {}): Composition {
  return {
    version: COMPOSITION_VERSION,
    source: {
      duration: 18,
      fps: 30,
      width: 1080,
      height: 1920,
      fileName: "anuncio.mp4",
    },
    brand: { fontId: "bebas", primary: "#EE4D2D", logo: "data:image/svg+xml,logo" },
    inserts: [sampleInsert()],
    batch: { hooks: [], fonts: ["geist"], positions: ["top"], baseName: "" },
    output: {
      width: 1080,
      height: 1920,
      fps: 30,
      videoBitrate: DEFAULT_VIDEO_BITRATE,
    },
    captionPreset: "viral",
    captionStyle: DEFAULT_CAPTION_STYLE,
    ...patch,
  }
}

test("calculateShortMetadata derives durationInFrames from video length and fps", () => {
  const meta = calculateShortMetadata({
    ...defaultRenderProps,
    fps: 30,
    video: { src: "/tmp/clip.mp4", durationInSeconds: 18 },
  })
  assert.equal(meta.fps, 30)
  assert.equal(meta.durationInFrames, 540)
})

test("calculateShortMetadata ceils fractional seconds so the last frame is included", () => {
  const meta = calculateShortMetadata({
    ...defaultRenderProps,
    fps: 30,
    video: { src: "/tmp/clip.mp4", durationInSeconds: 18.01 },
  })
  assert.equal(meta.durationInFrames, 541)
})

test("toRenderProps is a pure mapping from composition + video src", () => {
  const composition = sampleComposition()
  const props = toRenderProps({
    composition,
    videoSrc: "https://cdn.example.com/clip.mp4",
    stickerSrcs: { file1: "https://cdn.example.com/sticker.png" },
  })

  assert.equal(props.video.src, "https://cdn.example.com/clip.mp4")
  assert.equal(props.video.durationInSeconds, 18)
  assert.equal(props.fps, 30)
  assert.equal(props.width, 1080)
  assert.equal(props.height, 1920)
  assert.equal(props.brand.fontId, "bebas")
  assert.equal(props.brand.logo, "data:image/svg+xml,logo")
  assert.equal(props.stickerSrcs.file1, "https://cdn.example.com/sticker.png")
  assert.equal(props.inserts.length, 1)

  const insert = props.inserts[0]
  assert.equal(insert?.id, "i1")
  assert.equal(insert?.type, "alerta-desconto")
  assert.equal(insert?.text, "50% OFF")
  assert.equal(insert?.startInSeconds, 1.2)
  assert.equal(insert?.endInSeconds, 4.6)
  assert.equal(insert?.start, 1.2)
  assert.equal(insert?.duration, 3.4)
  assert.equal(insert?.animIn, "pop")
})

test("toRenderProps recorta a duração e mantém o tempo do arquivo nos inserts", () => {
  const composition = sampleComposition({
    source: {
      duration: 18,
      fps: 30,
      width: 1080,
      height: 1920,
      fileName: "anuncio.mp4",
      trim: { start: 2.5, end: 10 },
    },
  })
  const props = toRenderProps({ composition, videoSrc: "https://cdn.example.com/clip.mp4" })
  assert.equal(props.video.durationInSeconds, 7.5)
  assert.equal(props.video.trimStartInSeconds, 2.5)
  assert.equal(props.video.sourceDurationInSeconds, 18)
  assert.equal(props.inserts[0]?.startInSeconds, 1.2)
  assert.equal(calculateShortMetadata(props).durationInFrames, 225)
  assert.equal(sourceTimeFromFrame(0, props), 2.5)
  assert.equal(sourceTimeFromFrame(30, props), 3.5)
})

test("toRenderProps sem corte não manda campos de trim", () => {
  const props = toRenderProps({ composition: sampleComposition(), videoSrc: "" })
  assert.equal(props.video.trimStartInSeconds, undefined)
  assert.equal(props.video.sourceDurationInSeconds, undefined)
  assert.equal(props.video.cuts, undefined)
  assert.equal(sourceTimeFromFrame(30, props), 1)
})

test("toRenderProps leva as divisões e o zoom muda no frame da divisão", () => {
  const closeUp = { scale: 2, x: 0, y: 0 }
  const composition = sampleComposition({
    source: {
      duration: 18,
      fps: 30,
      width: 1080,
      height: 1920,
      fileName: "anuncio.mp4",
      trim: { start: 2, end: 12 },
      cuts: [{ time: 5, transform: closeUp }],
    },
  })
  const props = toRenderProps({ composition, videoSrc: "https://cdn.example.com/clip.mp4" })
  assert.deepEqual(props.video.cuts, [{ time: 5, transform: closeUp }])
  // Com entrada em 2s, o frame 89 ainda é 4,97s do arquivo e o 90 já é 5s.
  assert.equal(sourceTransformAt(props.video, sourceTimeFromFrame(89, props)), undefined)
  assert.deepEqual(sourceTransformAt(props.video, sourceTimeFromFrame(90, props)), closeUp)
})

test("toRenderProps keeps caption words and does not invent blob video sources", () => {
  const composition = sampleComposition({
    inserts: [
      {
        id: "cap1",
        type: "legenda",
        kind: "caption",
        start: 0,
        duration: 2,
        text: "oi mundo",
        words: [{ text: "oi", start: 0, end: 0.4 }],
        anchor: "bottom",
        animIn: "none",
        animOut: "none",
      },
    ],
  })
  const props = toRenderProps({
    composition,
    videoSrc: "blob:https://editor.local/abc",
  })
  assert.equal(props.inserts[0]?.words?.[0]?.text, "oi")
  assert.equal(props.video.src, "blob:https://editor.local/abc")
  assert.equal(isRenderSafeVideoSrc(props.video.src), false)
})

test("isRenderSafeVideoSrc accepts http(s) and absolute paths, rejects blob and data", () => {
  assert.equal(isRenderSafeVideoSrc("https://cdn.example.com/a.mp4"), true)
  assert.equal(isRenderSafeVideoSrc("http://127.0.0.1:4013/media/a.mp4"), true)
  assert.equal(isRenderSafeVideoSrc("/Users/me/clip.mp4"), true)
  assert.equal(isRenderSafeVideoSrc("N:\\Videos\\clip.mp4"), true)
  assert.equal(isRenderSafeVideoSrc("C:/Videos/clip.mp4"), true)
  assert.equal(isRenderSafeVideoSrc("blob:https://localhost/uuid"), false)
  assert.equal(isRenderSafeVideoSrc("data:video/mp4;base64,aaa"), false)
  assert.equal(isRenderSafeVideoSrc("file:///tmp/clip.mp4"), false)
  assert.equal(isRenderSafeVideoSrc(""), false)
})

test("secondsFromFrame is a pure function of frame and fps", () => {
  assert.equal(secondsFromFrame(0, 30), 0)
  assert.equal(secondsFromFrame(15, 30), 0.5)
  assert.equal(secondsFromFrame(540, 30), 18)
})

test("defaultRenderProps has fixed ids and a positive duration for Studio", () => {
  assert.equal(typeof defaultRenderProps.video.durationInSeconds, "number")
  assert.ok(defaultRenderProps.video.durationInSeconds > 0)
  assert.equal(defaultRenderProps.fps, 30)
  assert.equal(defaultRenderProps.width, 1080)
  assert.equal(defaultRenderProps.height, 1920)
  assert.deepEqual(
    defaultRenderProps.inserts.map((insert) => insert.id),
    ["demo-logo", "demo-off", "demo-cta"],
  )
  for (const insert of defaultRenderProps.inserts) {
    assert.ok(insert.endInSeconds > insert.startInSeconds)
  }
})

test("default inserts at 3s layout the discount chip (scrub without playing)", () => {
  const chips = layoutInserts(
    defaultRenderProps.inserts,
    3,
    { width: 1080, height: 1920 },
    defaultRenderProps.brand.fontId,
    defaultRenderProps.brand.logo,
  )
  assert.ok(chips.some((chip) => chip.text.includes("50%")))
  assert.ok(chips.some((chip) => chip.id === "demo-logo"))
})

test("default inserts at 9s layout the freight banner", () => {
  const chips = layoutInserts(
    defaultRenderProps.inserts,
    9,
    { width: 1080, height: 1920 },
    defaultRenderProps.brand.fontId,
    defaultRenderProps.brand.logo,
  )
  assert.equal(chips.length, 1)
  assert.ok(chips[0]?.text.includes("FRETE"))
})

test("toCliRenderProps strips blob and data video sources", () => {
  const composition = sampleComposition()
  const props = toRenderProps({
    composition,
    videoSrc: "blob:https://editor.local/abc",
    stickerSrcs: {
      file1: "blob:https://editor.local/sticker",
      file2: "https://cdn.example.com/sticker.png",
    },
  })
  const cli = toCliRenderProps(props)
  assert.equal(cli.video.src, "")
  assert.equal(cli.video.durationInSeconds, 18)
  assert.equal(cli.stickerSrcs.file1, undefined)
  assert.equal(cli.stickerSrcs.file2, "https://cdn.example.com/sticker.png")
})

test("toCliRenderProps keeps http video sources", () => {
  const composition = sampleComposition()
  const props = toRenderProps({
    composition,
    videoSrc: "https://cdn.example.com/clip.mp4",
  })
  const cli = toCliRenderProps(props)
  assert.equal(cli.video.src, "https://cdn.example.com/clip.mp4")
})

test("toRenderProps copies source size and transform onto video", () => {
  const composition = sampleComposition({
    source: {
      duration: 18,
      fps: 30,
      width: 1920,
      height: 1080,
      fileName: "anuncio.mp4",
      transform: { scale: 1.5, x: -8, y: 4 },
    },
  })
  const props = toRenderProps({
    composition,
    videoSrc: "https://cdn.example.com/clip.mp4",
  })
  assert.equal(props.video.width, 1920)
  assert.equal(props.video.height, 1080)
  assert.deepEqual(props.video.transform, { scale: 1.5, x: -8, y: 4 })
})

test("toRenderProps copies watermark only when enabled and text is set", () => {
  const composition = sampleComposition({ watermarkEnabled: true })
  const withText = toRenderProps({
    composition,
    videoSrc: "https://cdn.example.com/clip.mp4",
    watermarkPrefs: { text: "@loja", loop: false },
  })
  assert.deepEqual(withText.watermark, {
    text: "@loja",
    loop: false,
    opacityPct: 22,
    fontPx: 42,
    speed: 1,
  })

  const custom = toRenderProps({
    composition,
    videoSrc: "https://cdn.example.com/clip.mp4",
    watermarkPrefs: { text: "@loja", loop: true, opacityPct: 30, fontPx: 50, speed: 2 },
  })
  assert.deepEqual(custom.watermark, {
    text: "@loja",
    loop: true,
    opacityPct: 30,
    fontPx: 50,
    speed: 2,
  })

  const empty = toRenderProps({
    composition,
    videoSrc: "https://cdn.example.com/clip.mp4",
    watermarkPrefs: { text: "", loop: true },
  })
  assert.equal(empty.watermark, undefined)

  const off = toRenderProps({
    composition: sampleComposition(),
    videoSrc: "https://cdn.example.com/clip.mp4",
    watermarkPrefs: { text: "@loja", loop: true },
  })
  assert.equal(off.watermark, undefined)
})
