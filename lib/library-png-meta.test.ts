import { test } from "node:test"
import assert from "node:assert/strict"

import {
  EMPTY_PNG_META,
  filterPngItems,
  parsePngMeta,
  togglePngFavorite,
  touchPngRecent,
} from "./library-png-meta.ts"

test("parsePngMeta returns empty on garbage", () => {
  assert.deepEqual(parsePngMeta(null), EMPTY_PNG_META)
  assert.deepEqual(parsePngMeta("{"), EMPTY_PNG_META)
})

test("togglePngFavorite and recents filter the grid", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }]
  let meta = togglePngFavorite(EMPTY_PNG_META, "b")
  meta = touchPngRecent(meta, "c")
  meta = touchPngRecent(meta, "a")
  assert.deepEqual(
    filterPngItems(items, "favorite", meta).map((item) => item.id),
    ["b"],
  )
  assert.deepEqual(
    filterPngItems(items, "recent", meta).map((item) => item.id),
    ["a", "c"],
  )
  assert.equal(filterPngItems(items, "all", meta).length, 3)
})
