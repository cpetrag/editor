import { existsSync } from "node:fs"
import { copyFile, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  isInsideCapcutDir,
  sanitizeCapcutFileName,
  uniqueCapcutDest,
} from "./capcut-path.ts"
import type { CapcutAudioPlacement } from "./capcut-audio.ts"

export type CopyExportToCapcutInput = {
  destDir: string
  fileName: string
  sourcePath?: string
  bytes?: Uint8Array
  /** Áudios ao lado do MP4. O draft do CapCut não aplica fade nem ducking. */
  extraFiles?: { fileName: string; bytes: Uint8Array }[]
  audioPlan?: { tracks: CapcutAudioPlacement[]; omissions: string[] }
}

export type CopyExportToCapcutResult = {
  destPath: string
  fileName: string
}

export async function copyExportToCapcut(
  input: CopyExportToCapcutInput,
): Promise<CopyExportToCapcutResult> {
  if (!input.sourcePath && !input.bytes) {
    throw new Error("nada para copiar")
  }
  await mkdir(input.destDir, { recursive: true })
  const destPath = uniqueCapcutDest(
    input.destDir,
    sanitizeCapcutFileName(input.fileName),
    existsSync,
  )
  if (!isInsideCapcutDir(input.destDir, destPath)) {
    throw new Error("destino CapCut inválido")
  }
  if (input.sourcePath) {
    await copyFile(input.sourcePath, destPath)
  } else if (input.bytes) {
    await writeFile(destPath, input.bytes)
  }
  const stem = path.basename(destPath).replace(/\.mp4$/i, "")
  const placed: { file: string; kind: string; start: number; trimIn: number; trimOut: number; volume: number; loop: boolean }[] = []
  for (const [index, extra] of (input.extraFiles ?? []).entries()) {
    const safe = extra.fileName.replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "") || `audio-${index + 1}.mp3`
    const audioDest = path.join(input.destDir, `${stem}__${safe}`)
    if (!isInsideCapcutDir(input.destDir, audioDest)) continue
    await writeFile(audioDest, extra.bytes)
    const match = input.audioPlan?.tracks.find((track) => track.fileName === extra.fileName)
    if (match) {
      placed.push({
        file: path.basename(audioDest),
        kind: match.kind,
        start: match.start,
        trimIn: match.trimIn,
        trimOut: match.trimOut,
        volume: match.volume,
        loop: match.loop,
      })
    }
  }
  if (placed.length > 0) {
    const notePath = path.join(input.destDir, `${stem}__audio.json`)
    if (isInsideCapcutDir(input.destDir, notePath)) {
      const note = {
        omissions: input.audioPlan?.omissions ?? [],
        tracks: placed,
      }
      await writeFile(notePath, JSON.stringify(note, null, 2))
    }
  }
  return { destPath, fileName: path.basename(destPath) }
}
