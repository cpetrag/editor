import { test } from "node:test"
import assert from "node:assert/strict"

import { generateModelSchema, sanitizeAiInserts } from "./ai-schema.ts"

test("generateModelSchema rejects a payload without inserts", () => {
  const parsed = generateModelSchema.safeParse({ hooks: [] })
  assert.equal(parsed.success, false)
})

test("sanitizeAiInserts drops sticker-png and unknown types", () => {
  const kept = sanitizeAiInserts([
    { type: "alerta-desconto", start: 1, duration: 3, text: "70% OFF" },
    { type: "sticker-png", start: 2, duration: 3 },
    { type: "unicorn", start: 0, duration: 1 },
  ])
  assert.equal(kept.length, 1)
  assert.equal(kept[0]?.type, "alerta-desconto")
})
