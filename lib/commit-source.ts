import type { Composition, CompositionSource } from "./composition.ts"
import type { ImportErrorCode } from "./import-errors.ts"
import type { ImportJobStatus } from "./import/types.ts"

export const MAX_IMPORT_BYTES = 200 * 1024 * 1024

export type SourceImport =
  | { status: "idle" }
  | {
      status: "downloading"
      rawUrl: string
      jobId: string
      jobStatus: Extract<ImportJobStatus, "queued" | "running">
      startedAt: number
    }
  | { status: "probing"; rawUrl: string; canonicalUrl: string }
  | { status: "error"; code: ImportErrorCode; rawUrl: string; detail: string }

export function isReadySource(source: CompositionSource): boolean {
  return Boolean(source.fileId) && source.duration > 0
}

export function hasPlayableSource(source: CompositionSource): boolean {
  return isReadySource(source)
}

export function isImportTooLarge(bytes: number): boolean {
  return bytes > MAX_IMPORT_BYTES
}

export function commitReadySource(
  composition: Composition,
  next: CompositionSource,
): Composition {
  if (!isReadySource(next)) {
    throw new Error("source not ready")
  }
  return {
    ...composition,
    source: next,
  }
}
