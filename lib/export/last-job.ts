import type { StorageLike } from "../project-store.ts"

export const LAST_EXPORT_JOB_KEY = "editor.export.lastJob.v1"

export type LastExportJob = {
  jobId: string
  fileName: string
  savedAt: number
}

function defaultSessionStorage(): StorageLike | null {
  try {
    return globalThis.sessionStorage
  } catch {
    return null
  }
}

export function parseLastExportJob(value: unknown): LastExportJob | null {
  if (!value || typeof value !== "object") return null
  const parsed = value as { jobId?: unknown; fileName?: unknown; savedAt?: unknown }
  if (typeof parsed.jobId !== "string" || !parsed.jobId.trim()) return null
  if (typeof parsed.fileName !== "string" || !parsed.fileName.trim()) return null
  const savedAt =
    typeof parsed.savedAt === "number" && Number.isFinite(parsed.savedAt)
      ? parsed.savedAt
      : 0
  return {
    jobId: parsed.jobId.trim(),
    fileName: parsed.fileName.trim(),
    savedAt,
  }
}

export function loadLastExportJob(
  storage: StorageLike | null = defaultSessionStorage(),
): LastExportJob | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(LAST_EXPORT_JOB_KEY)
    if (!raw) return null
    return parseLastExportJob(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveLastExportJob(
  job: { jobId: string; fileName: string },
  storage: StorageLike | null = defaultSessionStorage(),
  now = Date.now(),
): LastExportJob | null {
  const parsed = parseLastExportJob({ ...job, savedAt: now })
  if (!parsed || !storage) return parsed
  try {
    storage.setItem(LAST_EXPORT_JOB_KEY, JSON.stringify(parsed))
  } catch (error) {
    console.warn("[editor] não gravei o último job de export", error)
  }
  return parsed
}

export function clearLastExportJob(
  storage: StorageLike | null = defaultSessionStorage(),
): void {
  if (!storage) return
  try {
    storage.removeItem(LAST_EXPORT_JOB_KEY)
  } catch {
    // sessionStorage pode estar bloqueado
  }
}
