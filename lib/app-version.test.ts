import assert from "node:assert/strict"
import { test } from "node:test"

import { formatAppVersion, isStaleTab, parseAppVersion } from "./app-version.ts"

test("formatAppVersion mostra versão e horário do build", () => {
  const label = formatAppVersion({ version: "1.1.0", buildTime: "2026-08-27T02:30:00.000Z" })
  assert.match(label, /^v1\.1\.0 · \d{2}\/\d{2} \d{2}:\d{2}$/)
})

test("formatAppVersion aceita build sem horário ou com horário inválido", () => {
  assert.equal(formatAppVersion({ version: "1.1.0", buildTime: null }), "v1.1.0")
  assert.equal(formatAppVersion({ version: "1.1.0", buildTime: "ontem" }), "v1.1.0")
})

test("parseAppVersion aceita a resposta de /api/version e recusa lixo", () => {
  assert.deepEqual(parseAppVersion({ version: "1.1.0", buildTime: "2026-08-27T02:30:00.000Z" }), {
    version: "1.1.0",
    buildTime: "2026-08-27T02:30:00.000Z",
  })
  assert.deepEqual(parseAppVersion({ version: "1.1.0" }), { version: "1.1.0", buildTime: null })
  assert.equal(parseAppVersion(null), null)
  assert.equal(parseAppVersion({ version: "  " }), null)
  assert.equal(parseAppVersion("1.1.0"), null)
})

test("isStaleTab acusa aba velha quando a versão publicada mudou", () => {
  const loaded = { version: "1.1.0", buildTime: "2026-08-27T02:00:00.000Z" }
  assert.equal(isStaleTab(loaded, { version: "1.1.1", buildTime: null }), true)
  assert.equal(
    isStaleTab(loaded, { version: "1.1.0", buildTime: "2026-08-27T03:00:00.000Z" }),
    true,
  )
})

test("isStaleTab fica calado quando não há o que comparar", () => {
  const loaded = { version: "1.1.0", buildTime: "2026-08-27T02:00:00.000Z" }
  assert.equal(isStaleTab(loaded, loaded), false)
  assert.equal(isStaleTab(loaded, null), false)
  assert.equal(isStaleTab(loaded, { version: "1.1.0", buildTime: null }), false)
  assert.equal(isStaleTab({ version: "dev", buildTime: null }, { version: "1.1.0", buildTime: null }), false)
})
