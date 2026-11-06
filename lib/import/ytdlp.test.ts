import assert from "node:assert/strict"
import { afterEach, describe, test } from "node:test"

import {
  TIKTOK_CHROME_USER_AGENT,
  buildYtDlpArgs,
  importProxy,
  isRetryableExtractorError,
  withExtractorRetries,
  ytdlpBin,
} from "./ytdlp.ts"

test("args pedem melhor qualidade e merge mp4 + proxy", () => {
  const args = buildYtDlpArgs({
    url: "https://youtu.be/x",
    outTemplate: "/tmp/id.%(ext)s",
    proxy: "socks5://127.0.0.1:8080",
  })
  assert.ok(args.includes("-f"))
  assert.ok(args.some((a) => String(a).includes("bv*") || String(a).includes("bestvideo")))
  assert.ok(args.includes("--merge-output-format"))
  assert.ok(args.includes("mp4"))
  assert.ok(args.includes("--proxy"))
  assert.ok(args.includes("socks5://127.0.0.1:8080"))
  assert.ok(args.includes("https://youtu.be/x"))
  assert.equal(args.includes("--user-agent"), false)
})

test("TikTok args enviam User-Agent de Chrome para passar do desafio da página", () => {
  const canonical = buildYtDlpArgs({
    url: "https://www.tiktok.com/@thalitaliiima/video/7659067964246854932",
    outTemplate: "/tmp/id.%(ext)s",
  })
  const short = buildYtDlpArgs({
    url: "https://vt.tiktok.com/ZMhqK8vXY/",
    outTemplate: "/tmp/id.%(ext)s",
  })
  assert.equal(canonical[canonical.indexOf("--user-agent") + 1], TIKTOK_CHROME_USER_AGENT)
  assert.equal(short[short.indexOf("--user-agent") + 1], TIKTOK_CHROME_USER_AGENT)
  assert.match(TIKTOK_CHROME_USER_AGENT, /Chrome\/140/)
})

describe("env defaults", () => {
  const prev = { ...process.env }

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in prev)) delete process.env[key]
    }
    Object.assign(process.env, prev)
  })

  test("ytdlpBin default", () => {
    delete process.env.YTDLP_PATH
    assert.equal(ytdlpBin(), "yt-dlp")
  })

  test("ytdlpBin from env", () => {
    process.env.YTDLP_PATH = " /opt/yt-dlp "
    assert.equal(ytdlpBin(), "/opt/yt-dlp")
  })

  test("importProxy default é direto (produção Mac Mini)", () => {
    delete process.env.IMPORT_PROXY
    assert.equal(importProxy(), "")
  })

  test("importProxy from env", () => {
    process.env.IMPORT_PROXY = "socks5://127.0.0.1:8081"
    assert.equal(importProxy(), "socks5://127.0.0.1:8081")
  })

  test("importProxy direct/off desliga proxy", () => {
    process.env.IMPORT_PROXY = "direct"
    assert.equal(importProxy(), "")
    process.env.IMPORT_PROXY = "off"
    assert.equal(importProxy(), "")
  })
})

test("isRetryableExtractorError casa o desafio JS do TikTok", () => {
  assert.equal(
    isRetryableExtractorError(
      "ERROR: [TikTok] 7676829783585606930: Unable to extract universal data for rehydration",
    ),
    true,
  )
  assert.equal(isRetryableExtractorError("Unexpected response from webpage request"), true)
  assert.equal(isRetryableExtractorError("ERROR: Private video"), false)
  assert.equal(isRetryableExtractorError("yt-dlp timeout"), false)
})

test("withExtractorRetries repete falha transitória e devolve a 2ª tentativa", async () => {
  let attempts = 0
  const delays: number[] = []
  const result = await withExtractorRetries(
    async () => {
      attempts += 1
      if (attempts === 1) {
        throw new Error("Unable to extract universal data for rehydration")
      }
      return "ok"
    },
    {
      attempts: 3,
      delayMs: 40,
      sleep: async (ms) => {
        delays.push(ms)
      },
    },
  )
  assert.equal(result, "ok")
  assert.equal(attempts, 2)
  assert.deepEqual(delays, [40])
})

test("withExtractorRetries não repete erro permanente", async () => {
  let attempts = 0
  await assert.rejects(
    () =>
      withExtractorRetries(async () => {
        attempts += 1
        throw new Error("ERROR: Private video")
      }),
    /Private video/,
  )
  assert.equal(attempts, 1)
})
