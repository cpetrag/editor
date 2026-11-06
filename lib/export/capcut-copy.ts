import { existsSync } from "node:fs"
import { copyFile, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  isInsideCapcutDir,
  sanitizeCapcutFileName,
  uniqueCapcutDest,
} from "./capcut-path.ts"

export type CopyExportToCapcutInput = {
  destDir: string
  fileName: string
  sourcePath?: string
  bytes?: Uint8Array
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
  return { destPath, fileName: path.basename(destPath) }
}
