import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, test } from "node:test"

import {
  buildAudioExtractArgs,
  describeOpenAiError,
  extractAudioForWhisper,
  ffmpegBin,
} from "./ai-audio.ts"

describe("ffmpegBin", () => {
  const previous = process.env.FFMPEG_PATH

  afterEach(() => {
    if (previous === undefined) delete process.env.FFMPEG_PATH
    else process.env.FFMPEG_PATH = previous
  })

  test("default é ffmpeg do PATH", () => {
    delete process.env.FFMPEG_PATH
    assert.equal(ffmpegBin(), "ffmpeg")
  })

  test("respeita FFMPEG_PATH", () => {
    process.env.FFMPEG_PATH = " /opt/homebrew/bin/ffmpeg "
    assert.equal(ffmpegBin(), "/opt/homebrew/bin/ffmpeg")
  })
})

test("args extraem só o áudio em mp3 mono 16 kHz", () => {
  const args = buildAudioExtractArgs("/tmp/in.mov", "/tmp/out.mp3")
  assert.equal(args[args.indexOf("-i") + 1], "/tmp/in.mov")
  assert.ok(args.includes("-vn"))
  assert.equal(args[args.indexOf("-ac") + 1], "1")
  assert.equal(args[args.indexOf("-ar") + 1], "16000")
  assert.equal(args.at(-1), "/tmp/out.mp3")
})

test("extractAudioForWhisper devolve mp3 e limpa a pasta temporária", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-audio-test-"))
  let seenArgs: string[] = []
  const result = await extractAudioForWhisper(new Uint8Array([1, 2, 3]), {
    tmpRoot,
    run: async (args) => {
      seenArgs = args
      const input = args[args.indexOf("-i") + 1]
      assert.deepEqual([...fs.readFileSync(input)], [1, 2, 3])
      fs.writeFileSync(args.at(-1) as string, Buffer.from([9, 9]))
    },
  })
  assert.ok(seenArgs.length > 0)
  assert.equal(result.filename, "audio.mp3")
  assert.equal(result.mime, "audio/mpeg")
  assert.deepEqual([...result.bytes], [9, 9])
  assert.deepEqual(fs.readdirSync(tmpRoot), [])
  fs.rmSync(tmpRoot, { recursive: true, force: true })
})

test("extractAudioForWhisper propaga falha do ffmpeg e limpa a pasta", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-audio-test-"))
  await assert.rejects(
    () =>
      extractAudioForWhisper(new Uint8Array([1]), {
        tmpRoot,
        run: async () => {
          throw new Error("ffmpeg exit 1")
        },
      }),
    /ffmpeg exit 1/,
  )
  assert.deepEqual(fs.readdirSync(tmpRoot), [])
  fs.rmSync(tmpRoot, { recursive: true, force: true })
})

test("describeOpenAiError extrai a mensagem da OpenAI", () => {
  const body = JSON.stringify({ error: { message: "Invalid file format." } })
  assert.equal(describeOpenAiError(400, body), "HTTP 400: Invalid file format.")
  assert.equal(describeOpenAiError(500, "<html>oops</html>"), "HTTP 500: <html>oops</html>")
  assert.equal(describeOpenAiError(500, "x".repeat(500)).length, "HTTP 500: ".length + 300)
})
