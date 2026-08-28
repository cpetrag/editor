import assert from "node:assert/strict"
import { test } from "node:test"

import {
  RenderExportError,
  errorFromRenderResponse,
  errorFromRenderNetwork,
} from "./render-errors.ts"

test("409 avisa que já tem render e não cai para rascunho", () => {
  const error = errorFromRenderResponse(409, { error: "render em andamento" })
  assert.equal(error.fallbackToDraft, false)
  assert.match(error.message, /já tem um render/i)
  assert.equal(error.status, 409)
})

test("507 avisa disco cheio e não cai para rascunho", () => {
  const error = errorFromRenderResponse(507, { error: "disco insuficiente" })
  assert.equal(error.fallbackToDraft, false)
  assert.match(error.message, /disco/i)
  assert.equal(error.status, 507)
})

test("503 e rede caída pedem reconexão, não rascunho", () => {
  const offline = errorFromRenderResponse(503, { error: "servidor de render offline" })
  assert.equal(offline.fallbackToDraft, false)
  assert.match(offline.message, /recuperar último export/i)
  assert.doesNotMatch(offline.message, /rascunho/i)

  const network = errorFromRenderNetwork()
  assert.equal(network.fallbackToDraft, false)
  assert.match(network.message, /recuperar último export/i)
  assert.doesNotMatch(network.message, /rascunho/i)
  assert.equal(network.status, null)
})

test("outro erro HTTP usa a mensagem do servidor, nunca um genérico vazio", () => {
  const error = errorFromRenderResponse(500, { error: "bundle ausente" })
  assert.equal(error.message, "bundle ausente")
  assert.equal(error.fallbackToDraft, false)
  assert.ok(error instanceof RenderExportError)
})
