import assert from "node:assert/strict"
import { test } from "node:test"

import { defaultRenderProps } from "../remotion/types.ts"
import { applyUploadedVideo, mediaUrlForJob, parseRenderProps } from "./props.ts"

test("mediaUrlForJob monta http no servidor de render", () => {
  assert.equal(
    mediaUrlForJob("http://127.0.0.1:4014", "job-1"),
    "http://127.0.0.1:4014/media/job-1",
  )
})

test("parseRenderProps usa o default quando o campo vem vazio", () => {
  assert.equal(parseRenderProps(null).video.durationInSeconds, 18)
  assert.equal(parseRenderProps("").inserts.length, 3)
})

test("parseRenderProps lê JSON válido e rejeita lixo", () => {
  const parsed = parseRenderProps(JSON.stringify(defaultRenderProps))
  assert.equal(parsed.fps, 30)
  assert.throws(() => parseRenderProps("{"), /props.json/i)
  assert.throws(() => parseRenderProps(JSON.stringify({ hello: 1 })), /props.json/i)
})

test("applyUploadedVideo usa URL http do servidor, nunca file://", () => {
  const withFile = applyUploadedVideo(
    { ...defaultRenderProps, video: { src: "blob:https://x/1", durationInSeconds: 18 } },
    "http://127.0.0.1:4014/media/job-1",
  )
  assert.equal(withFile.video.src, "http://127.0.0.1:4014/media/job-1")

  const withoutFile = applyUploadedVideo(
    { ...defaultRenderProps, video: { src: "blob:https://x/1", durationInSeconds: 18 } },
    null,
  )
  assert.equal(withoutFile.video.src, "")
})

test("parseRenderProps keeps a valid watermark and drops a malformed one", () => {
  const ok = parseRenderProps(
    JSON.stringify({
      ...defaultRenderProps,
      watermark: { text: "@loja", loop: true },
    }),
  )
  assert.deepEqual(ok.watermark, {
    text: "@loja",
    loop: true,
    opacityPct: 22,
    fontPx: 42,
    speed: 1,
  })

  const bad = parseRenderProps(
    JSON.stringify({
      ...defaultRenderProps,
      watermark: { text: 1, loop: "yes" },
    }),
  )
  assert.equal(bad.watermark, undefined)
})

test("parseRenderProps keeps watermark when opacityPct is junk", () => {
  const parsed = parseRenderProps(
    JSON.stringify({
      ...defaultRenderProps,
      watermark: { text: "@loja", loop: true, opacityPct: "x" },
    }),
  )
  assert.equal(parsed.watermark?.text, "@loja")
  assert.equal(parsed.watermark?.opacityPct, 22)
  assert.equal(parsed.watermark?.fontPx, 42)
  assert.equal(parsed.watermark?.speed, 1)
})
