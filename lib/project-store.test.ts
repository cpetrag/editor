import { test } from "node:test"
import assert from "node:assert/strict"

import {
  serializeComposition,
  COMPOSITION_VERSION,
  DEFAULT_CAPTION_STYLE,
  createDefaultComposition,
  type Composition,
} from "./composition.ts"
import { defaultCompositionAudio } from "./audio/types.ts"
import {
  COMPOSITION_STORAGE_KEY,
  createMemoryFileStore,
  loadCompositionJson,
  saveCompositionJson,
} from "./project-store.ts"

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null
    },
    setItem(key: string, value: string) {
      map.set(key, value)
    },
    removeItem(key: string) {
      map.delete(key)
    },
    clear() {
      map.clear()
    },
    get snapshot() {
      return Object.fromEntries(map)
    },
  }
}

const composition: Composition = {
  version: COMPOSITION_VERSION,
  source: {
    duration: 12,
    fps: 30,
    width: 1080,
    height: 1920,
    fileName: "base.mp4",
    fileId: "file-1",
  },
  brand: { fontId: "geist", primary: "#EE4D2D", logo: "" },
  inserts: [
    {
      id: "i1",
      type: "logo-shopee",
      start: 0.5,
      duration: 3,
      anchor: "top",
      animIn: "pop",
      animOut: "none",
    },
  ],
  batch: { hooks: ["gancho"], fonts: ["geist"], positions: ["top"], baseName: "campanha" },
  output: { width: 1080, height: 1920, fps: 30, videoBitrate: 8_000_000 },
  captionPreset: "viral",
  captionStyle: DEFAULT_CAPTION_STYLE,
  audio: defaultCompositionAudio(),
}

test("save and load composition JSON roundtrip through localStorage", () => {
  const storage = memoryStorage()
  saveCompositionJson(composition, storage)
  const loaded = loadCompositionJson(storage)
  assert.deepEqual(loaded, composition)
  assert.ok(storage.snapshot[COMPOSITION_STORAGE_KEY])
})

test("saved JSON never contains a blob URL", () => {
  const storage = memoryStorage()
  saveCompositionJson(
    {
      ...composition,
      source: { ...composition.source, remoteUrl: "blob:http://localhost/x" },
    },
    storage,
  )
  const raw = storage.snapshot[COMPOSITION_STORAGE_KEY]
  assert.equal(raw.includes("blob:"), false)
  assert.equal(serializeComposition(composition).includes("blob:"), false)
})

test("memory file store returns null when the id is missing", async () => {
  const files = createMemoryFileStore()
  const missing = await files.load("nope")
  assert.equal(missing, null)
})

test("memory file store roundtrips a blob without putting it in JSON", async () => {
  const files = createMemoryFileStore()
  const blob = new Blob(["video-bytes"], { type: "video/mp4" })
  await files.save("file-1", blob, { fileName: "base.mp4", mimeType: "video/mp4" })
  const loaded = await files.load("file-1")
  assert.equal(loaded?.fileName, "base.mp4")
  assert.equal(loaded?.mimeType, "video/mp4")
  assert.equal(await loaded?.blob.text(), "video-bytes")
})

test("saved empty project round-trips without fileId", () => {
  const storage = memoryStorage()
  const empty = createDefaultComposition()
  saveCompositionJson(empty, storage)
  const loaded = loadCompositionJson(storage)
  assert.equal(loaded?.inserts.length, 0)
  assert.equal(loaded?.source.fileId, undefined)
  assert.equal(loaded?.source.duration, 0)
})
