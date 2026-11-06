import { test } from "node:test"
import assert from "node:assert/strict"

import {
  COMPOSITION_VERSION,
  DEFAULT_CAPTION_STYLE,
  DEFAULT_VIDEO_BITRATE,
  FONT_SIZE_MAX,
  MIN_DURATION,
  clampComposition,
  clampInsert,
  insertKind,
  mergeCaptionStylePatch,
  mergeInsertPatch,
  insertHasFontSize,
  isChipInsert,
  parseComposition,
  qualityFromOutput,
  scaleRangeLabel,
  serializeComposition,
  createDefaultComposition,
  type Composition,
  type CompositionInsert,
} from "./composition.ts"

function sampleInsert(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "i1",
    type: "alerta-desconto",
    start: 1,
    duration: 3,
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
      duration: 20.27,
      fps: 30,
      width: 1080,
      height: 1920,
      fileName: "anuncio.mp4",
      fileId: "file-1",
    },
    brand: { fontId: "geist", primary: "#EE4D2D", logo: "" },
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

test("parseComposition accepts a valid v1 document", () => {
  const parsed = parseComposition({ ...sampleComposition(), version: 1 })
  assert.equal(parsed.version, COMPOSITION_VERSION)
  assert.equal(parsed.inserts[0]?.start, 1)
  assert.equal(parsed.inserts[0]?.anchor, "center")
  assert.equal(parsed.inserts[0]?.style, undefined)
})

test("parseComposition migrates v2 documents to output 1080x1920 without dropping inserts", () => {
  const { output: _dropped, ...v2 } = sampleComposition({
    source: {
      duration: 13.91,
      fps: 30,
      width: 576,
      height: 1024,
      fileName: "anuncio.mp4",
    },
  })
  const parsed = parseComposition({ ...v2, version: 2 })
  assert.equal(parsed.version, COMPOSITION_VERSION)
  assert.equal(parsed.source.width, 576)
  assert.equal(parsed.source.height, 1024)
  assert.deepEqual(parsed.output, {
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrate: DEFAULT_VIDEO_BITRATE,
  })
  assert.equal(qualityFromOutput(parsed.output, parsed.source), "1080")
  assert.equal(parsed.inserts[0]?.text, "50% OFF")
})

test("parseComposition rejects an unknown version", () => {
  assert.throws(
    () => parseComposition({ ...sampleComposition(), version: 99 }),
    /version/,
  )
})

test("parseComposition drops unknown fields", () => {
  const parsed = parseComposition({
    ...sampleComposition(),
    extra: "nope",
  })
  assert.equal("extra" in parsed, false)
})

test("parseComposition migrates startTime and position aliases", () => {
  const parsed = parseComposition({
    ...sampleComposition(),
    inserts: [
      {
        id: "old",
        type: "cupom",
        startTime: 4,
        duration: 2,
        position: "bottom",
        animIn: "pop",
        animOut: "none",
      },
    ],
  })
  assert.equal(parsed.inserts[0]?.start, 4)
  assert.equal(parsed.inserts[0]?.anchor, "bottom")
  assert.equal("startTime" in parsed.inserts[0], false)
  assert.equal("position" in parsed.inserts[0], false)
})

test("clampInsert keeps a one-frame start", () => {
  const clamped = clampInsert(sampleInsert({ start: 1 + 1 / 30, duration: 2 }), 20)
  assert.ok(Math.abs(clamped.start - (1 + 1 / 30)) < 1e-9)
})

test("clampInsert preserves duration when the start is typed past the end", () => {
  const clamped = clampInsert(sampleInsert({ start: 999, duration: 4 }), 18.088, "start")
  assert.equal(clamped.start, 14.1)
  assert.equal(clamped.duration, 4)
})

test("clampInsert does not change start when duration is clamped", () => {
  const clamped = clampInsert(sampleInsert({ start: 1, duration: 999 }), 18.088, "duration")
  assert.equal(clamped.start, 1)
  assert.ok(clamped.duration <= 18.088 - 1 + 0.05)
  assert.ok(clamped.duration >= MIN_DURATION)
})

test("clampInsert shrinks duration only when it cannot fit the video", () => {
  const clamped = clampInsert(sampleInsert({ start: 1, duration: 40 }), 18.088, "start")
  assert.ok(clamped.duration <= 18.1 + 1e-9)
  assert.ok(clamped.duration < 40)
})

test("clampInsert pulls a start past the video back into range", () => {
  const clamped = clampInsert(sampleInsert({ start: 999, duration: 3 }), 20.27)
  assert.ok(clamped.start <= 20.27 - 3 + 0.05)
  assert.equal(clamped.duration, 3)
})

test("clampInsert raises a negative duration to the minimum", () => {
  const clamped = clampInsert(sampleInsert({ duration: -5 }), 20.27)
  assert.equal(clamped.duration, MIN_DURATION)
})

test("clampInsert shortens an insert that would overrun the video", () => {
  const clamped = clampInsert(sampleInsert({ start: 18, duration: 10 }), 20.27)
  assert.ok(clamped.start + clamped.duration <= 20.27 + 0.06)
  assert.ok(clamped.duration >= MIN_DURATION)
})

test("parseComposition round-trips additive source metadata without bumping version", () => {
  const parsed = parseComposition(
    sampleComposition({
      source: {
        duration: 14,
        fps: 30,
        width: 1080,
        height: 1920,
        fileName: "sandalia.mp4",
        fileId: "file-9",
        remoteUrl: "https://www.tiktok.com/@loja/video/7423?utm_source=share",
        canonicalUrl: "https://www.tiktok.com/@loja/video/7423",
        provider: "tiktok",
        author: "@loja",
        title: "sandália anabela",
        codec: "hevc",
        watermarked: true,
      },
    }),
  )
  assert.equal(parsed.version, COMPOSITION_VERSION)
  assert.equal(parsed.source.canonicalUrl, "https://www.tiktok.com/@loja/video/7423")
  assert.equal(parsed.source.provider, "tiktok")
  assert.equal(parsed.source.author, "@loja")
  assert.equal(parsed.source.title, "sandália anabela")
  assert.equal(parsed.source.codec, "hevc")
  assert.equal(parsed.source.watermarked, true)
  const again = parseComposition(JSON.parse(serializeComposition(parsed)))
  assert.equal(again.source.canonicalUrl, parsed.source.canonicalUrl)
  assert.equal(again.source.author, "@loja")
})

test("parseComposition keeps a project when source has unknown keys", () => {
  const parsed = parseComposition({
    ...sampleComposition(),
    source: {
      duration: 10,
      fps: 30,
      width: 1080,
      height: 1920,
      fileName: "clip.mp4",
      fileId: "file-1",
      futureField: "keep-project",
    },
  })
  assert.equal(parsed.source.fileId, "file-1")
  assert.equal(parsed.source.duration, 10)
  assert.equal("futureField" in parsed.source, false)
})

test("serializeComposition never emits blob URLs or legacy field names", () => {
  const json = serializeComposition(
    sampleComposition({
      source: {
        duration: 10,
        fps: 30,
        width: 1080,
        height: 1920,
        fileName: "clip.mp4",
        fileId: "abc",
        remoteUrl: "blob:http://localhost/secret",
      },
    }),
  )
  assert.equal(json.includes("blob:"), false)
  assert.equal(json.includes("startTime"), false)
  assert.equal(JSON.parse(json).source.remoteUrl, undefined)
})

test("insertKind infers chip when kind is omitted", () => {
  assert.equal(insertKind(sampleInsert()), "chip")
  assert.equal(isChipInsert(sampleInsert()), true)
})

test("parseComposition round-trips free x/y/scale on a chip", () => {
  const parsed = parseComposition(
    sampleComposition({
      inserts: [
        {
          id: "chip",
          type: "alerta-desconto",
          start: 1,
          duration: 3,
          text: "50% OFF",
          anchor: "top",
          animIn: "pop",
          animOut: "none",
          x: 42.5,
          y: 18,
          scale: 1.25,
        },
      ],
    }),
  )
  const insert = parsed.inserts[0]
  assert.ok(insert)
  assert.equal(insertKind(insert), "chip")
  assert.equal(insert.x, 42.5)
  assert.equal(insert.y, 18)
  assert.equal(insert.scale, 1.25)

  const again = parseComposition(JSON.parse(serializeComposition(parsed)))
  assert.equal(again.inserts[0]?.x, 42.5)
  assert.equal(again.inserts[0]?.y, 18)
  assert.equal(again.inserts[0]?.scale, 1.25)
})

test("parseComposition round-trips element colors and a new UGC chip type", () => {
  const parsed = parseComposition(
    sampleComposition({
      inserts: [
        {
          id: "bubble",
          type: "bubble-comentario",
          start: 1,
          duration: 3,
          text: "@loja top",
          anchor: "center",
          animIn: "pop",
          animOut: "none",
          x: 30,
          y: 70,
          fillColor: "#FFFFFF",
          accentColor: "#111111",
          maxWidthPct: 48,
        },
      ],
    }),
  )
  assert.equal(parsed.inserts[0]?.type, "bubble-comentario")
  assert.equal(parsed.inserts[0]?.fillColor, "#FFFFFF")
  assert.equal(parsed.inserts[0]?.accentColor, "#111111")
  assert.equal(parsed.inserts[0]?.maxWidthPct, 48)
  const again = parseComposition(JSON.parse(serializeComposition(parsed)))
  assert.equal(again.inserts[0]?.type, "bubble-comentario")
  assert.equal(again.inserts[0]?.fillColor, "#FFFFFF")
  assert.equal(again.inserts[0]?.accentColor, "#111111")
  assert.equal(again.inserts[0]?.maxWidthPct, 48)
})

test("parseComposition leaves a chip without x/y so it can keep stacking", () => {
  const parsed = parseComposition(
    sampleComposition({
      inserts: [
        {
          id: "chip",
          type: "alerta-desconto",
          start: 1,
          duration: 3,
          text: "50% OFF",
          anchor: "top",
          animIn: "pop",
          animOut: "none",
        },
      ],
    }),
  )
  assert.equal(parsed.inserts[0]?.x, undefined)
  assert.equal(parsed.inserts[0]?.y, undefined)
  assert.equal(parsed.inserts[0]?.scale, undefined)
})

test("parseComposition treats a legacy insert without kind as a chip", () => {
  const parsed = parseComposition(sampleComposition())
  assert.equal(insertKind(parsed.inserts[0]!), "chip")
  assert.equal(parsed.inserts[0]?.kind, undefined)
})

test("parseComposition round-trips a free-text overlay", () => {
  const parsed = parseComposition(
    sampleComposition({
      inserts: [
        {
          id: "txt",
          type: "texto-livre",
          kind: "text",
          start: 2,
          duration: 4,
          text: "NOVO",
          anchor: "center",
          animIn: "pop",
          animOut: "none",
          x: 50,
          y: 35,
          fontSize: 56,
          preset: "bold-outline",
          maxWidthPct: 84,
          textAlign: "center",
        },
      ],
    }),
  )
  const insert = parsed.inserts[0]
  assert.ok(insert)
  assert.equal(insert.kind, "text")
  assert.equal(insert.type, "texto-livre")
  assert.equal(insert.text, "NOVO")
  assert.equal(insert.x, 50)
  assert.equal(insert.y, 35)
  assert.equal(insert.fontSize, 56)
  assert.equal(insert.preset, "contorno-tiktok")
  assert.equal(isChipInsert(insert), false)

  const again = parseComposition(JSON.parse(serializeComposition(parsed)))
  assert.equal(again.inserts[0]?.kind, "text")
  assert.equal(again.inserts[0]?.x, 50)
  assert.equal(again.inserts[0]?.fontSize, 56)
  assert.equal(again.inserts[0]?.preset, "contorno-tiktok")
})

test("parseComposition infers text kind from type texto-livre", () => {
  const parsed = parseComposition(
    sampleComposition({
      inserts: [
        {
          id: "txt",
          type: "texto-livre",
          start: 1,
          duration: 3,
          text: "CTA",
          anchor: "center",
          animIn: "pop",
          animOut: "none",
        },
      ],
    }),
  )
  assert.equal(parsed.inserts[0]?.kind, "text")
  assert.equal(parsed.inserts[0]?.x, 50)
  assert.equal(parsed.inserts[0]?.y, 35)
  assert.equal(parsed.inserts[0]?.fontSize, 56)
})

test("parseComposition keeps sticker fileId and drops src", () => {
  const parsed = parseComposition(
    sampleComposition({
      inserts: [
        {
          id: "stk",
          type: "sticker-png",
          kind: "sticker",
          start: 0,
          duration: 3,
          anchor: "bottom",
          animIn: "pop",
          animOut: "none",
          x: 50,
          y: 78,
          scale: 0.7,
          sourceKind: "upload",
          fileId: "png-1",
          label: "seta.png",
          src: "blob:http://localhost/secret",
        } as CompositionInsert & { src: string },
      ],
    }),
  )
  const insert = parsed.inserts[0]
  assert.ok(insert)
  assert.equal(insert.kind, "sticker")
  assert.equal(insert.fileId, "png-1")
  assert.equal(insert.sourceKind, "upload")
  assert.equal(insert.scale, 0.7)
  assert.equal("src" in insert, false)

  const json = serializeComposition(parsed)
  assert.equal(json.includes("blob:"), false)
  assert.equal(json.includes('"src"'), false)
  assert.equal(JSON.parse(json).inserts[0].fileId, "png-1")
})

test("parseComposition keeps overlay y at the frame edges 0 and 100", () => {
  const parsed = parseComposition(
    sampleComposition({
      inserts: [
        {
          id: "edge",
          type: "texto-livre",
          kind: "text",
          start: 0,
          duration: 3,
          text: "NOVO",
          anchor: "center",
          animIn: "none",
          animOut: "none",
          x: 0,
          y: 0,
        },
        {
          id: "edge-2",
          type: "sticker-png",
          kind: "sticker",
          start: 0,
          duration: 3,
          anchor: "bottom",
          animIn: "none",
          animOut: "none",
          x: 100,
          y: 100,
          scale: 0.7,
          sourceKind: "library",
          libraryId: "seta",
        },
      ],
    }),
  )
  assert.equal(parsed.inserts[0]?.y, 0)
  assert.equal(parsed.inserts[0]?.x, 0)
  assert.equal(parsed.inserts[1]?.y, 100)
  assert.equal(parsed.inserts[1]?.x, 100)
})

test("parseComposition keeps sticker scale with three decimal places", () => {
  const parsed = parseComposition(
    sampleComposition({
      inserts: [
        {
          id: "stk",
          type: "sticker-png",
          kind: "sticker",
          start: 0,
          duration: 3,
          anchor: "bottom",
          animIn: "none",
          animOut: "none",
          scale: 1.055,
          sourceKind: "library",
          libraryId: "seta",
        },
      ],
    }),
  )
  assert.equal(parsed.inserts[0]?.scale, 1.055)
})

test("parseComposition drops a mismatched kind and type pair", () => {
  const parsed = parseComposition(
    sampleComposition({
      inserts: [
        {
          id: "bad",
          type: "cupom",
          kind: "text",
          start: 1,
          duration: 2,
          anchor: "center",
          animIn: "pop",
          animOut: "none",
        },
      ],
    }),
  )
  assert.equal(parsed.inserts.length, 0)
})

test("mergeInsertPatch clamps overlay percents and size fields", () => {
  const text = mergeInsertPatch(
    {
      id: "t",
      type: "texto-livre",
      kind: "text",
      start: 0,
      duration: 3,
      text: "NOVO",
      anchor: "center",
      animIn: "none",
      animOut: "none",
      x: 50,
      y: 35,
      fontSize: 56,
    },
    { x: -4, y: 140, fontSize: 900 },
  )
  assert.equal(text.x, 0)
  assert.equal(text.y, 100)
  assert.equal(text.fontSize, 360)

  const sticker = mergeInsertPatch(
    {
      id: "s",
      type: "sticker-png",
      kind: "sticker",
      start: 0,
      duration: 3,
      anchor: "bottom",
      animIn: "none",
      animOut: "none",
      x: 50,
      y: 78,
      scale: 0.7,
      sourceKind: "library",
      libraryId: "seta",
    },
    { scale: 0.7004 },
  )
  assert.equal(sticker.scale, 0.7)

  const chipScale = mergeInsertPatch(sampleInsert(), { scale: 5 })
  assert.equal(chipScale.scale, 4)
  const chipTiny = mergeInsertPatch(sampleInsert({ scale: 1 }), { scale: 0.1 })
  assert.equal(chipTiny.scale, 0.2)

  const chipFont = mergeInsertPatch(sampleInsert(), { fontSize: 900 })
  assert.equal(chipFont.fontSize, 360)
  const chipFontMin = mergeInsertPatch(sampleInsert({ fontSize: 13 }), { fontSize: 5 })
  assert.equal(chipFontMin.fontSize, 12)
})

test("parseComposition round-trips chip fontSize and clamps scale to 0.2-4", () => {
  const parsed = parseComposition(
    sampleComposition({
      inserts: [
        {
          id: "chip",
          type: "alerta-desconto",
          start: 1,
          duration: 3,
          text: "50% OFF",
          anchor: "top",
          animIn: "pop",
          animOut: "none",
          fontSize: 48,
          scale: 5,
        },
      ],
    }),
  )
  assert.equal(parsed.inserts[0]?.fontSize, 48)
  assert.equal(parsed.inserts[0]?.scale, 4)
  const again = parseComposition(JSON.parse(serializeComposition(parsed)))
  assert.equal(again.inserts[0]?.fontSize, 48)
  assert.equal(again.inserts[0]?.scale, 4)
})

test("insertHasFontSize is true for text and chips with copy, false for logo", () => {
  assert.equal(insertHasFontSize(sampleInsert()), true)
  assert.equal(insertHasFontSize(sampleInsert({ type: "logo-shopee", text: undefined })), false)
  assert.equal(
    insertHasFontSize({
      id: "t",
      type: "texto-livre",
      kind: "text",
      start: 0,
      duration: 3,
      text: "NOVO",
      anchor: "center",
      animIn: "none",
      animOut: "none",
    }),
    true,
  )
  assert.equal(scaleRangeLabel(), "Escala 0,2–4")
})

test("parseComposition leaves style undefined on a v1 insert and round-trips an explicit style", () => {
  const legacy = parseComposition({ ...sampleComposition(), version: 1 })
  assert.equal(legacy.version, COMPOSITION_VERSION)
  assert.equal(legacy.inserts[0]?.style, undefined)

  const styled = parseComposition(
    sampleComposition({
      inserts: [
        {
          id: "chip",
          type: "alerta-desconto",
          start: 1,
          duration: 3,
          text: "50% OFF",
          anchor: "top",
          animIn: "pop",
          animOut: "none",
          style: {
            fontFamily: "bebas",
            fontWeight: 400,
            uppercase: true,
            color: "#FFFFFF",
            bgColor: null,
            strokeWidth: 6,
            strokeColor: "#000000",
            shadow: "soft",
            opacity: 1,
            rotation: 4,
          },
        },
      ],
    }),
  )
  assert.equal(styled.inserts[0]?.style?.fontFamily, "bebas")
  assert.equal(styled.inserts[0]?.style?.strokeWidth, 6)
  const again = parseComposition(JSON.parse(serializeComposition(styled)))
  assert.equal(again.inserts[0]?.style?.fontFamily, "bebas")
  assert.equal(again.inserts[0]?.style?.bgColor, null)
})

test("parseComposition clamps caption words when insert duration exceeds video", () => {
  const parsed = parseComposition({
    version: COMPOSITION_VERSION,
    source: {
      duration: 5,
      fps: 30,
      width: 1080,
      height: 1920,
      fileName: "video.mp4",
    },
    brand: { fontId: "geist", primary: "#EE4D2D", logo: "" },
    batch: { hooks: [], fonts: ["geist"], positions: ["top"], baseName: "" },
    output: {
      width: 1080,
      height: 1920,
      fps: 30,
      videoBitrate: DEFAULT_VIDEO_BITRATE,
    },
    captionPreset: "viral",
    captionStyle: DEFAULT_CAPTION_STYLE,
    inserts: [
      {
        id: "c1",
        type: "legenda",
        kind: "caption",
        start: 0,
        duration: 10,
        text: "a b",
        words: [
          { text: "a", start: 0, end: 3 },
          { text: "b", start: 6, end: 8 },
        ],
        anchor: "bottom",
        animIn: "none",
        animOut: "none",
      },
    ],
  })
  const insert = parsed.inserts[0]!
  assert.ok(insert.duration <= 5)
  for (const word of insert.words ?? []) {
    assert.ok(word.end <= insert.start + insert.duration + 1e-9)
    assert.ok(word.start < insert.start + insert.duration)
    assert.ok(word.start >= insert.start)
  }
})

test("parseComposition promove words relativos a tempos absolutos", () => {
  const parsed = parseComposition(
    sampleComposition({
      inserts: [
        {
          id: "c1",
          type: "legenda",
          kind: "caption",
          start: 6,
          duration: 2,
          text: "oi hoje",
          words: [
            { text: "oi", start: 0, end: 0.4 },
            { text: "hoje", start: 0.4, end: 1.2 },
          ],
          anchor: "bottom",
          animIn: "none",
          animOut: "none",
        },
      ],
    }),
  )
  const words = parsed.inserts[0]?.words ?? []
  assert.equal(words[0]?.start, 6)
  assert.equal(words[0]?.end, 6.4)
  assert.equal(words[1]?.start, 6.4)
  assert.equal(words[1]?.end, 7.2)
})

test("parseComposition reads caption inserts and captionPreset", () => {
  const parsed = parseComposition({
    ...sampleComposition({
      captionPreset: "limpo",
      inserts: [
        {
          id: "c1",
          type: "legenda",
          kind: "caption",
          start: 1,
          duration: 2,
          text: "Esse cupom",
          words: [{ text: "Esse", start: 0, end: 0.4 }, { text: "cupom", start: 0.4, end: 1.2 }],
          anchor: "bottom",
          animIn: "none",
          animOut: "none",
          x: 50,
          y: 72,
          fontSize: 64,
        },
      ],
    }),
  })
  assert.equal(parsed.version, COMPOSITION_VERSION)
  assert.equal(parsed.captionPreset, "limpo")
  assert.equal(insertKind(parsed.inserts[0]!), "caption")
  assert.equal(parsed.inserts[0]?.words?.length, 2)
  assert.equal(isChipInsert(parsed.inserts[0]!), false)
})

test("parseComposition defaults invalid captionPreset to viral", () => {
  const parsed = parseComposition({
    ...sampleComposition({ captionPreset: "neon" as never }),
  })
  assert.equal(parsed.captionPreset, "viral")
})

test("serializeComposition always writes captionPreset", () => {
  const parsed = parseComposition(sampleComposition())
  const again = JSON.parse(serializeComposition(parsed)) as { captionPreset?: string }
  assert.equal(again.captionPreset, "viral")
})

test("parseComposition reads captionStyle", () => {
  const parsed = parseComposition({
    ...sampleComposition({
      captionStyle: {
        ...DEFAULT_CAPTION_STYLE,
        y: 60,
        highlightColor: "#00E5FF",
        bgColor: "rgba(0,0,0,0.4)",
      },
    }),
  })
  assert.equal(parsed.captionStyle.y, 60)
  assert.equal(parsed.captionStyle.highlightColor, "#00E5FF")
  assert.equal(parsed.captionStyle.bgColor, "rgba(0,0,0,0.4)")
})

test("parseComposition defaults invalid captionStyle fields", () => {
  const parsed = parseComposition({
    ...sampleComposition(),
    captionStyle: { y: "nope", fontSize: 9999, highlightColor: "yellow" },
  })
  assert.equal(parsed.captionStyle.y, DEFAULT_CAPTION_STYLE.y)
  assert.equal(parsed.captionStyle.fontSize, FONT_SIZE_MAX)
  assert.equal(parsed.captionStyle.highlightColor, DEFAULT_CAPTION_STYLE.highlightColor)
})

test("parseComposition migrates captionStyle from the first caption insert", () => {
  const parsed = parseComposition({
    ...sampleComposition({ captionStyle: undefined as never }),
    captionStyle: undefined,
    inserts: [
      {
        id: "c1",
        type: "legenda",
        kind: "caption",
        start: 0,
        duration: 2,
        text: "oi",
        words: [],
        anchor: "bottom",
        animIn: "none",
        animOut: "none",
        x: 40,
        y: 60,
        fontSize: 80,
      },
    ],
  })
  assert.equal(parsed.captionStyle.x, 40)
  assert.equal(parsed.captionStyle.y, 60)
  assert.equal(parsed.captionStyle.fontSize, 80)
  assert.equal(parsed.captionStyle.highlightColor, "#FFE500")
})

test("parseComposition reads captionStyle.rotation; omitido vira 0", () => {
  const withRot = parseComposition({
    ...sampleComposition({
      captionStyle: { ...DEFAULT_CAPTION_STYLE, rotation: 40 },
    }),
  })
  assert.equal(withRot.captionStyle.rotation, 40)
  const parsed = parseComposition({ ...sampleComposition() })
  assert.equal(parsed.captionStyle.rotation, 0)
})

test("serializeComposition always writes captionStyle and omits caption overlay fields", () => {
  const parsed = parseComposition(
    sampleComposition({
      captionStyle: { ...DEFAULT_CAPTION_STYLE, y: 61 },
      inserts: [
        {
          id: "c1",
          type: "legenda",
          kind: "caption",
          start: 0,
          duration: 2,
          text: "oi",
          words: [],
          anchor: "bottom",
          animIn: "none",
          animOut: "none",
        },
      ],
    }),
  )
  const again = JSON.parse(serializeComposition(parsed)) as {
    captionStyle?: { y?: number }
    inserts: Array<{
      x?: number
      y?: number
      fontSize?: number
      style?: unknown
      transform?: { y?: number; touchedByUser?: boolean }
    }>
  }
  assert.equal(again.captionStyle?.y, 61)
  assert.equal(again.inserts[0]?.x, undefined)
  assert.equal(again.inserts[0]?.y, undefined)
  assert.equal(again.inserts[0]?.fontSize, undefined)
  assert.equal(again.inserts[0]?.style, undefined)
  assert.equal(again.inserts[0]?.transform?.y, 61)
  assert.equal(again.inserts[0]?.transform?.touchedByUser, true)
})

test("mergeCaptionStylePatch clamps fontSize and x", () => {
  const next = mergeCaptionStylePatch(DEFAULT_CAPTION_STYLE, { fontSize: 10, x: 200 })
  assert.equal(next.fontSize, 40)
  assert.equal(next.x, 100)
})

test("createDefaultComposition usa carrinhoLaranja na faixa CTA", () => {
  const composition = createDefaultComposition()
  assert.equal(composition.tracks?.cta?.styleRef?.presetId, "carrinhoLaranja")
})

test("parseComposition omits identity source.transform and clamps zoom", () => {
  const identity = parseComposition({
    ...sampleComposition(),
    source: {
      ...sampleComposition().source,
      transform: { scale: 1, x: 0, y: 0, space: "offset" },
    },
  })
  assert.equal(identity.source.transform, undefined)
  const legacyIdentity = parseComposition({
    ...sampleComposition(),
    source: {
      ...sampleComposition().source,
      transform: { scale: 1, x: 50, y: 50 },
    },
  })
  assert.equal(legacyIdentity.source.transform, undefined)
  const json = JSON.parse(serializeComposition(identity)) as { source: { transform?: unknown } }
  assert.equal(json.source.transform, undefined)

  const zoomed = parseComposition({
    ...sampleComposition(),
    source: {
      ...sampleComposition().source,
      transform: { scale: 1.5, x: -8, y: 4, space: "offset" },
    },
  })
  assert.equal(zoomed.source.transform?.scale, 1.5)
  assert.equal(zoomed.source.transform?.x, -8)
  assert.equal(zoomed.source.transform?.y, 4)
  const again = parseComposition(JSON.parse(serializeComposition(zoomed)))
  assert.deepEqual(again.source.transform, { scale: 1.5, x: -8, y: 4 })
  const stored = JSON.parse(serializeComposition(zoomed)) as {
    source: { transform?: { space?: string } }
  }
  assert.equal(stored.source.transform?.space, "offset")

  const clamped = parseComposition({
    ...sampleComposition(),
    source: {
      ...sampleComposition().source,
      transform: { scale: 9, x: -10, y: 40, space: "offset" },
    },
  })
  assert.equal(clamped.source.transform?.scale, 4)
})

test("parseComposition keeps watermarkEnabled only when it is boolean true", () => {
  const on = parseComposition({ ...sampleComposition(), watermarkEnabled: true })
  assert.equal(on.watermarkEnabled, true)
  const off = parseComposition({ ...sampleComposition(), watermarkEnabled: false })
  assert.equal(off.watermarkEnabled, undefined)
  const junk = parseComposition({ ...sampleComposition(), watermarkEnabled: "true" })
  assert.equal(junk.watermarkEnabled, undefined)
  const missing = parseComposition(sampleComposition())
  assert.equal(missing.watermarkEnabled, undefined)
})

test("serializeComposition omits watermarkEnabled unless true", () => {
  const on = JSON.parse(serializeComposition(sampleComposition({ watermarkEnabled: true }))) as {
    watermarkEnabled?: boolean
  }
  assert.equal(on.watermarkEnabled, true)
  const off = JSON.parse(serializeComposition(sampleComposition())) as {
    watermarkEnabled?: boolean
  }
  assert.equal(off.watermarkEnabled, undefined)
})

test("corte do vídeo sobrevive ao salvar/carregar e é descartado quando inválido", () => {
  const trimmed = parseComposition({
    ...sampleComposition(),
    source: { ...sampleComposition().source, trim: { start: 2, end: 9.5 } },
  })
  assert.deepEqual(trimmed.source.trim, { start: 2, end: 9.5 })
  const again = parseComposition(JSON.parse(serializeComposition(trimmed)))
  assert.deepEqual(again.source.trim, { start: 2, end: 9.5 })

  const whole = parseComposition({
    ...sampleComposition(),
    source: { ...sampleComposition().source, trim: { start: 0, end: 20.27 } },
  })
  assert.equal(whole.source.trim, undefined)
  assert.equal(
    (JSON.parse(serializeComposition(whole)) as { source: { trim?: unknown } }).source.trim,
    undefined,
  )

  const junk = parseComposition({
    ...sampleComposition(),
    source: { ...sampleComposition().source, trim: { start: "a", end: 3 } },
  })
  assert.equal(junk.source.trim, undefined)
})

test("clampComposition reajusta o corte quando a duração do vídeo diminui", () => {
  const composition = sampleComposition({
    source: { ...sampleComposition().source, duration: 8, trim: { start: 2, end: 15 } },
  })
  const clamped = clampComposition(composition)
  assert.deepEqual(clamped.source.trim, { start: 2, end: 8 })
  const kept = sampleComposition({
    source: { ...sampleComposition().source, trim: { start: 1, end: 5 } },
  })
  assert.equal(clampComposition(kept).source, kept.source)
})

test("divisões com zoom por trecho sobrevivem ao salvar/carregar", () => {
  const split = parseComposition({
    ...sampleComposition(),
    source: {
      ...sampleComposition().source,
      transform: { scale: 1.2, x: 0, y: 0, space: "offset" },
      cuts: [{ time: 8, transform: { scale: 2, x: 0, y: 0, space: "offset" } }, { time: 3 }],
    },
  })
  assert.deepEqual(split.source.cuts, [{ time: 3 }, { time: 8, transform: { scale: 2, x: 0, y: 0 } }])
  const again = parseComposition(JSON.parse(serializeComposition(split)))
  assert.deepEqual(again.source.cuts, split.source.cuts)
  assert.deepEqual(again.source.transform, split.source.transform)

  const plain = JSON.parse(serializeComposition(sampleComposition())) as {
    source: { cuts?: unknown }
  }
  assert.equal(plain.source.cuts, undefined)
})

test("clampComposition descarta divisões além da duração e preserva a source válida", () => {
  const shrunk = sampleComposition({
    source: { ...sampleComposition().source, duration: 8, cuts: [{ time: 3 }, { time: 12 }] },
  })
  assert.deepEqual(clampComposition(shrunk).source.cuts, [{ time: 3 }])
  const kept = sampleComposition({
    source: { ...sampleComposition().source, cuts: [{ time: 3 }] },
  })
  assert.equal(clampComposition(kept).source, kept.source)
})

test("createDefaultComposition has no watermarkEnabled", () => {
  assert.equal(createDefaultComposition().watermarkEnabled, undefined)
})
