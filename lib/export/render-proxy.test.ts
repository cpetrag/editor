import assert from "node:assert/strict"
import { test } from "node:test"

import { getRenderServerBase, isOfflineFetchError, mapRenderPath } from "./render-proxy.ts"

test("getRenderServerBase aponta para 127.0.0.1:4014 por padrão", () => {
  assert.equal(getRenderServerBase({}), "http://127.0.0.1:4014")
  assert.equal(
    getRenderServerBase({ RENDER_URL: "http://127.0.0.1:4014/" }),
    "http://127.0.0.1:4014",
  )
})

test("mapRenderPath traduz as rotas do editor para o servidor de render", () => {
  assert.equal(mapRenderPath("POST", "/api/render"), "/render")
  assert.equal(mapRenderPath("GET", "/api/render"), "/health")
  assert.equal(mapRenderPath("GET", "/api/render/progress/abc"), "/progress/abc")
  assert.equal(mapRenderPath("GET", "/api/render/status/abc"), "/status/abc")
  assert.equal(mapRenderPath("GET", "/api/render/download/abc"), "/download/abc")
  assert.equal(mapRenderPath("POST", "/api/render/cancel"), "/cancel")
})

test("falha de conexão é tratada como servidor offline", () => {
  assert.equal(isOfflineFetchError(new TypeError("fetch failed")), true)
  assert.equal(isOfflineFetchError(new Error("ECONNREFUSED")), true)
  assert.equal(isOfflineFetchError(new Error("disco insuficiente")), false)
})
