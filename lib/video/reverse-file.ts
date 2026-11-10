import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { ffmpegBin } from "../ai-audio.ts"
import { reverseChunkPlan, reverseFilterArgs, type ReverseChunk } from "./reverse-plan.ts"

const FFMPEG_TIMEOUT_MS = 120_000
export const REVERSE_CACHE_MAX_BYTES = 2 * 1024 * 1024 * 1024

type Runner = (args: string[]) => Promise<void>

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBin(), args, { stdio: ["ignore", "ignore", "pipe"] })
    let stderr = ""
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      reject(new Error("ffmpeg timeout ao inverter o vídeo"))
    }, FFMPEG_TIMEOUT_MS)
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
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

export function reverseCacheId(hash: string, start: number, end: number): string {
  const window = `${start.toFixed(3)}-${end.toFixed(3)}`
  return createHash("sha256").update(`${hash}:${window}`).digest("hex").slice(0, 24)
}

export async function hashFile(filePath: string): Promise<string> {
  const bytes = await readFile(filePath)
  return createHash("sha256").update(bytes).digest("hex")
}

async function concatReversed(chunks: string[], outputPath: string, run: Runner): Promise<void> {
  const listPath = `${outputPath}.txt`
  const body = chunks.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n")
  await writeFile(listPath, body)
  try {
    await run([
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      outputPath,
    ])
  } finally {
    await rm(listPath, { force: true })
  }
}

/** Inverte só a faixa útil [start, end] e grava um mp4 sem áudio. */
export async function reverseUsefulRange(
  inputPath: string,
  outputPath: string,
  range: { start: number; end: number },
  run: Runner = runFfmpeg,
): Promise<void> {
  const duration = Math.max(0, range.end - range.start)
  const plan = reverseChunkPlan(duration)
  if (plan.length === 0) throw new Error("faixa útil vazia")
  const work = await mkdir(path.join(os.tmpdir(), "editor-reverse-"), { recursive: true }).then(() =>
    path.join(os.tmpdir(), `editor-reverse-${path.basename(outputPath, ".mp4")}`),
  )
  await rm(work, { recursive: true, force: true })
  await mkdir(work, { recursive: true })
  try {
    if (plan.length === 1) {
      const only = plan[0]!
      await run(
        reverseFilterArgs(inputPath, outputPath, {
          start: range.start + only.start,
          end: range.start + only.end,
        }),
      )
      return
    }
    const parts: string[] = []
    for (let index = 0; index < plan.length; index += 1) {
      const chunk: ReverseChunk = plan[index]!
      const part = path.join(work, `part-${index}.mp4`)
      await run(
        reverseFilterArgs(inputPath, part, {
          start: range.start + chunk.start,
          end: range.start + chunk.end,
        }),
      )
      parts.push(part)
    }
    await concatReversed(parts, outputPath, run)
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

export async function pruneReverseCache(dir: string, maxBytes = REVERSE_CACHE_MAX_BYTES): Promise<void> {
  let entries: { path: string; size: number; mtime: number }[] = []
  try {
    const names = await readdir(dir)
    entries = await Promise.all(
      names.map(async (name) => {
        const filePath = path.join(dir, name)
        const info = await stat(filePath)
        return { path: filePath, size: info.size, mtime: info.mtimeMs }
      }),
    )
  } catch {
    return
  }
  let total = entries.reduce((sum, item) => sum + item.size, 0)
  if (total <= maxBytes) return
  entries.sort((a, b) => a.mtime - b.mtime)
  for (const item of entries) {
    if (total <= maxBytes) break
    await rm(item.path, { force: true })
    total -= item.size
  }
}
