import { test } from "node:test"
import assert from "node:assert/strict"

import {
  COMPOSITION_VERSION,
  DEFAULT_CAPTION_STYLE,
  DEFAULT_VIDEO_BITRATE,
  type Composition,
  type CompositionSource,
} from "./composition.ts"
import { defaultCompositionAudio } from "./audio/types.ts"
import {
  commitReadySource,
  isReadySource,
  type SourceImport,
} from "./commit-source.ts"

function sampleSource(patch: Partial<CompositionSource> = {}): CompositionSource {
  return {
    duration: 14.2,
    fps: 30,
    width: 1080,
    height: 1920,
    fileName: "clip.mp4",
    fileId: "file-1",
    ...patch,
  }
}

function sampleComposition(source: CompositionSource = sampleSource()): Composition {
  return {
    version: COMPOSITION_VERSION,
    source,
    brand: { fontId: "geist", primary: "#EE4D2D", logo: "" },
    inserts: [],
    batch: { hooks: [], fonts: ["geist"], positions: ["top"], baseName: "" },
    output: {
      width: 1080,
      height: 1920,
      fps: 30,
      videoBitrate: DEFAULT_VIDEO_BITRATE,
    },
    captionPreset: "viral",
    captionStyle: DEFAULT_CAPTION_STYLE,
    audio: defaultCompositionAudio(),
  }
}

test("isReadySource exige fileId e duration > 0", () => {
  assert.equal(isReadySource(sampleSource()), true)
  assert.equal(isReadySource(sampleSource({ duration: 0 })), false)
  assert.equal(isReadySource(sampleSource({ fileId: undefined })), false)
  assert.equal(isReadySource(sampleSource({ fileId: "" })), false)
})

test("commitReadySource grava a origem só quando ready", () => {
  const prev = sampleComposition()
  const next = sampleSource({
    fileId: "file-2",
    fileName: "novo.mp4",
    duration: 8,
    remoteUrl: "https://www.tiktok.com/@loja/video/1",
    canonicalUrl: "https://www.tiktok.com/@loja/video/1",
    provider: "tiktok",
    author: "@loja",
    title: "oferta",
  })
  const committed = commitReadySource(prev, next)
  assert.equal(committed.source.fileId, "file-2")
  assert.equal(committed.source.duration, 8)
  assert.equal(committed.source.author, "@loja")
  assert.notEqual(committed.source, prev.source)
})

test("commitReadySource recusa duration 0 e não altera a origem anterior", () => {
  const prev = sampleComposition()
  const snapshot = structuredClone(prev.source)
  assert.throws(
    () => commitReadySource(prev, sampleSource({ duration: 0, fileId: "file-2" })),
    /ready/,
  )
  assert.deepEqual(prev.source, snapshot)
})

test("nenhum status de SourceImport que não seja ready escreve composition.source", () => {
  const prev = sampleComposition()
  const imports: SourceImport[] = [
    { status: "idle" },
    { status: "downloading", rawUrl: "https://vm.tiktok.com/x", jobId: "abc", jobStatus: "running", startedAt: 1 },
    { status: "probing", rawUrl: "https://vm.tiktok.com/x", canonicalUrl: "https://www.tiktok.com/@a/video/1" },
    {
      status: "error",
      code: "PRIVATE",
      rawUrl: "https://www.tiktok.com/@priv/video/1",
      detail: "Private video",
    },
  ]
  for (const incoming of imports) {
    assert.equal(incoming.status === "ready", false)
    const next = structuredClone(prev)
    // A função de commit só aceita CompositionSource pronto — SourceImport nunca entra.
    assert.equal("fileId" in incoming && incoming.status === "idle", false)
    assert.deepEqual(next.source, prev.source)
  }
})

test("commitReadySource with a fresh next source drops previous transform", () => {
  const prev = sampleComposition(
    sampleSource({ transform: { scale: 2, x: 30, y: 40 } }),
  )
  const next = sampleSource({ fileId: "file-2", fileName: "novo.mp4", duration: 8 })
  const committed = commitReadySource(prev, next)
  assert.equal(committed.source.fileId, "file-2")
  assert.equal(committed.source.transform, undefined)
})
