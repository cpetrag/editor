import { test } from "node:test"
import assert from "node:assert/strict"

import { IMPORT_ERROR_COPY, mapImportError } from "./import-errors.ts"

test("mapImportError casa stderr conhecido", () => {
  assert.equal(mapImportError("ERROR: Private video").code, "PRIVATE")
  assert.equal(mapImportError("This video is private").code, "PRIVATE")
  assert.equal(mapImportError("Video unavailable").code, "NOT_FOUND")
  assert.equal(mapImportError("HTTP Error 404: Not Found").code, "NOT_FOUND")
  assert.equal(mapImportError("This video is not available in your country").code, "GEO_BLOCKED")
  assert.equal(mapImportError("HTTP Error 429: Too Many Requests").code, "RATE_LIMITED")
  assert.equal(mapImportError("Unsupported URL").code, "UNSUPPORTED")
  assert.equal(mapImportError("yt-dlp timeout").code, "TIMEOUT")
  assert.equal(mapImportError("Failed to establish a new connection").code, "NETWORK")
  assert.equal(mapImportError("alguma coisa estranha do extractor").code, "UNKNOWN")
})

test("falha clássica do extractor TikTok pede tentar de novo", () => {
  const rehydration = mapImportError(
    "WARNING: [TikTok] The extractor is attempting impersonation, but no impersonate target is available. ERROR: [TikTok] 7675873611797761300: Unable to extract universal data for rehydration",
  )
  assert.equal(rehydration.code, "EXTRACTOR_OUTDATED")
  assert.equal(rehydration.retry, true)
  assert.match(rehydration.message, /Tente de novo/)
  assert.doesNotMatch(rehydration.message, /yt-dlp -U/)

  assert.equal(
    mapImportError("ERROR: Unexpected response from webpage request").code,
    "EXTRACTOR_OUTDATED",
  )
})

test("UNSUPPORTED descreve a allowlist real", () => {
  assert.match(IMPORT_ERROR_COPY.UNSUPPORTED.message, /Shopee Video/)
  assert.match(IMPORT_ERROR_COPY.UNSUPPORTED.message, /Pinterest/)
})

test("NETWORK e TIMEOUT permitem retry; PRIVATE não", () => {
  assert.equal(IMPORT_ERROR_COPY.NETWORK.retry, true)
  assert.equal(IMPORT_ERROR_COPY.TIMEOUT.retry, true)
  assert.equal(IMPORT_ERROR_COPY.EXTRACTOR_OUTDATED.retry, true)
  assert.equal(IMPORT_ERROR_COPY.PRIVATE.retry, false)
  assert.equal(IMPORT_ERROR_COPY.UNKNOWN.retry, false)
})
