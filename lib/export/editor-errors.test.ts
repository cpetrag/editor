import assert from "node:assert/strict"
import { test } from "node:test"

import { errorMessageOf, installEditorErrorListeners, isAbortError } from "./editor-errors.ts"

test("errorMessageOf lê Error, string e lixo", () => {
  assert.equal(errorMessageOf(new Error("boom")), "boom")
  assert.equal(errorMessageOf("caiu"), "caiu")
  assert.equal(errorMessageOf(null), "Falha inesperada no editor")
})

test("isAbortError só reconhece cancelamento do usuário", () => {
  assert.equal(isAbortError(new DOMException("Export cancelado", "AbortError")), true)
  assert.equal(isAbortError(new Error("boom")), false)
})

test("installEditorErrorListeners loga rejeição e avisa o app", () => {
  const seen: string[] = []
  const target = new EventTarget()
  const stop = installEditorErrorListeners((message) => {
    seen.push(message)
  }, target as unknown as Window)
  const event = new Event("unhandledrejection") as Event & { reason: Error }
  event.reason = new Error("sumiu")
  target.dispatchEvent(event)
  assert.deepEqual(seen, ["sumiu"])
  stop()
})
