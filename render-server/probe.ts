import { spawn } from "node:child_process"

function ffprobeBin(): string {
  const fromEnv = String(process.env.FFPROBE_PATH || "").trim()
  if (fromEnv) return fromEnv
  const ffmpeg = String(process.env.FFMPEG_PATH || "").trim()
  if (ffmpeg.endsWith("ffmpeg")) return `${ffmpeg.slice(0, -"ffmpeg".length)}ffprobe`
  return "ffprobe"
}

/**
 * Duração da faixa de vídeo. O container fica um pouco maior por causa do
 * padding do AAC, e isso não é a duração da composição.
 */
export function probeDurationSeconds(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffprobeBin(),
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=duration",
        "-of",
        "default=nw=1:nk=1",
        filePath,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
    let out = ""
    let err = ""
    child.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString()
    })
    child.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString()
    })
    child.on("error", reject)
    child.on("close", (code) => {
      const value = Number(out.trim())
      if (code !== 0 || !(value > 0)) {
        reject(new Error((err.trim() || `ffprobe exit ${code}`).slice(-300)))
        return
      }
      resolve(value)
    })
  })
}

export function durationDriftSeconds(actual: number, expected: number, fps: number): number {
  return Math.abs(actual - expected)
}

export function durationWithinFrame(actual: number, expected: number, fps: number): boolean {
  const frame = fps > 0 ? 1 / fps : 1 / 30
  return durationDriftSeconds(actual, expected, fps) <= frame + 0.001
}
