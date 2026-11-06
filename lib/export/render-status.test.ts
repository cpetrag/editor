import assert from "node:assert/strict"
import { test } from "node:test"

import { parseRenderStatus } from "./render-status.ts"

test("parseRenderStatus aceita a resposta do servidor de render", () => {
  assert.deepEqual(
    parseRenderStatus({
      progress: 0.42,
      stage: "rendering",
      capcutSaved: true,
      capcutFileName: "Meu Anúncio.mp4",
    }),
    {
      progress: 0.42,
      stage: "rendering",
      capcutSaved: true,
      capcutFileName: "Meu Anúncio.mp4",
    },
  )
})

test("parseRenderStatus segura resposta estranha sem travar o export", () => {
  assert.deepEqual(parseRenderStatus(null), { progress: 0, stage: "rendering" })
  assert.deepEqual(parseRenderStatus("<html>"), { progress: 0, stage: "rendering" })
  assert.deepEqual(parseRenderStatus({ progress: "meio" }), { progress: 0, stage: "rendering" })
})

test("parseRenderStatus mantém o progresso entre 0 e 1", () => {
  assert.equal(parseRenderStatus({ progress: 4, stage: "rendering" }).progress, 1)
  assert.equal(parseRenderStatus({ progress: -2, stage: "rendering" }).progress, 0)
  assert.equal(parseRenderStatus({ progress: Number.NaN, stage: "rendering" }).progress, 0)
})

test("parseRenderStatus repassa a mensagem de erro do render", () => {
  const status = parseRenderStatus({ progress: 0.3, stage: "error", error: "falta disco" })
  assert.equal(status.stage, "error")
  assert.equal(status.error, "falta disco")
})
