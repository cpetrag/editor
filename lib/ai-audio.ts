import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"

const FFMPEG_TIMEOUT_MS = 60_000
const OPENAI_ERROR_MAX_CHARS = 300

export interface WhisperAudio {
  bytes: Uint8Array
  mime: string
  filename: string
}

type FfmpegRunner = (args: string[]) => Promise<void>

export function ffmpegBin(): string {
  return String(process.env.FFMPEG_PATH || "").trim() || "ffmpeg"
}

export function buildAudioExtractArgs(inputPath: string, outputPath: string): string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "64k",
    outputPath,
  ]
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBin(), args, { stdio: ["ignore", "ignore", "pipe"] })
    let stderr = ""
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      reject(new Error("ffmpeg timeout"))
    }, FFMPEG_TIMEOUT_MS)
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk
    })
    child.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error((stderr.trim() || `ffmpeg exit ${code}`).slice(-500)))
    })
  })
}

/**
 * Whisper only accepts a few containers (no .mov / QuickTime, no extensionless
 * names), so we always re-encode to a small mono mp3 before uploading.
 * Temp files live on the app volume (tmp/), not in the Mini's internal SSD.
 */
export async function extractAudioForWhisper(
  bytes: Uint8Array,
  {
    tmpRoot = path.join(process.cwd(), "tmp", "ai-audio"),
    run = runFfmpeg,
  }: { tmpRoot?: string; run?: FfmpegRunner } = {},
): Promise<WhisperAudio> {
  await fs.mkdir(tmpRoot, { recursive: true })
  const workDir = await fs.mkdtemp(path.join(tmpRoot, "job-"))
  try {
    const inputPath = path.join(workDir, "input")
    const outputPath = path.join(workDir, "audio.mp3")
    await fs.writeFile(inputPath, bytes)
    await run(buildAudioExtractArgs(inputPath, outputPath))
    const audio = await fs.readFile(outputPath)
    return { bytes: new Uint8Array(audio), mime: "audio/mpeg", filename: "audio.mp3" }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true })
  }
}

export function describeOpenAiError(status: number, body: string): string {
  let detail = body
  try {
    const json = JSON.parse(body) as { error?: { message?: string } }
    if (json.error?.message) detail = json.error.message
  } catch {
    /* body is not JSON; keep raw text */
  }
  return `HTTP ${status}: ${detail.trim().slice(0, OPENAI_ERROR_MAX_CHARS)}`
}
