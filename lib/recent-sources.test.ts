import { test } from "node:test"
import assert from "node:assert/strict"

import {
  pushRecentSource,
  readRecentSources,
  RECENT_SOURCES_KEY,
} from "./recent-sources.ts"

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
  }
}

test("pushRecentSource guarda no máximo 8 e deduplica por canonicalUrl", () => {
  const storage = memoryStorage()
  for (let i = 0; i < 10; i += 1) {
    pushRecentSource(
      {
        canonicalUrl: `https://www.tiktok.com/@loja/video/${i}`,
        provider: "tiktok",
        author: "@loja",
        title: `peça ${i}`,
      },
      storage,
    )
  }
  pushRecentSource(
    {
      canonicalUrl: "https://www.tiktok.com/@loja/video/9",
      provider: "tiktok",
      author: "@loja",
      title: "peça 9 de novo",
    },
    storage,
  )
  const listed = readRecentSources(storage)
  assert.equal(listed.length, 8)
  assert.equal(listed[0]?.canonicalUrl, "https://www.tiktok.com/@loja/video/9")
  assert.equal(listed[0]?.title, "peça 9 de novo")
  assert.equal(listed.filter((item) => item.canonicalUrl.endsWith("/9")).length, 1)
  assert.ok(storage.getItem(RECENT_SOURCES_KEY))
})
