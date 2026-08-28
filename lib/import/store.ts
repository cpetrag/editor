import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { downloadDir, ensureImportDirs, jobsDir } from "./paths.ts"
import type { ImportJob, ImportMeta } from "./types.ts"

export { downloadDir, ensureImportDirs, jobsDir } from "./paths.ts"
export type { ImportJob, ImportJobStatus, ImportMeta } from "./types.ts"

const ID_PATTERN = /^[a-f0-9]{24}$/i

function newId(): string {
  return crypto.randomBytes(12).toString("hex")
}

export function validId(id: string | undefined | null): boolean {
  return Boolean(id && ID_PATTERN.test(id))
}

export function mp4Path(id: string): string | null {
  if (!validId(id)) return null
  return path.join(downloadDir(), `${id}.mp4`)
}

export function metaPath(id: string): string | null {
  if (!validId(id)) return null
  return path.join(downloadDir(), `${id}.meta.json`)
}

export function writeMeta(id: string, meta: ImportMeta): ImportMeta | null {
  const filePath = metaPath(id)
  if (!filePath) return null
  ensureImportDirs()
  fs.writeFileSync(filePath, JSON.stringify(meta, null, 2))
  return meta
}

export function getMeta(id: string): ImportMeta | null {
  const filePath = metaPath(id)
  if (!filePath || !fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as ImportMeta
  } catch {
    return null
  }
}

export function deleteImport(id: string): { ok: true } | { ok: false; error: string } {
  const mp4 = mp4Path(id)
  if (!mp4 || !fs.existsSync(mp4)) {
    return { ok: false, error: "not_found" }
  }
  for (const filePath of [mp4, metaPath(id)]) {
    if (!filePath) continue
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch {
      /* best effort */
    }
  }
  return { ok: true }
}

export function createJob(
  payload: Partial<Omit<ImportJob, "id" | "createdAt" | "updatedAt">> = {},
): ImportJob {
  ensureImportDirs()
  const now = Date.now()
  const job: ImportJob = {
    id: newId(),
    status: "queued",
    error: null,
    sourceUrl: null,
    platform: null,
    title: null,
    createdAt: now,
    updatedAt: now,
    ...payload,
  }
  fs.writeFileSync(path.join(jobsDir(), `${job.id}.json`), JSON.stringify(job, null, 2))
  return job
}

export function getJob(jobId: string): ImportJob | null {
  if (!validId(jobId)) return null
  const filePath = path.join(jobsDir(), `${jobId}.json`)
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as ImportJob
  } catch {
    return null
  }
}

export function updateJob(jobId: string, patch: Partial<ImportJob>): ImportJob | null {
  const job = getJob(jobId)
  if (!job) return null
  const next: ImportJob = { ...job, ...patch, updatedAt: Date.now() }
  fs.writeFileSync(path.join(jobsDir(), `${jobId}.json`), JSON.stringify(next, null, 2))
  return next
}
