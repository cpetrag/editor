import assert from "node:assert/strict"
import test from "node:test"

import { nextContentPreset } from "./presets.ts"

test("sortear outra é estável para o mesmo seed", () => {
  const first = nextContentPreset("gancho-shopee-1", "calca")
  const again = nextContentPreset("gancho-shopee-1", "calca")
  assert.equal(first?.id, again?.id)
  assert.notEqual(first?.id, "gancho-shopee-1")
  assert.equal(first?.slot, "gancho")
  assert.equal(first?.niche, "shopee")
})
