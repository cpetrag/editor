import { mkdir, rm } from "node:fs/promises"
import path from "node:path"

export const HOUR_MS = 60 * 60 * 1000

export type JobStatus = "rendering" | "done" | "error"

export type JobPaths = {
  inputPath: string
  outputPath: string
}

export function jobPaths(tmpDir: string, jobId: string): JobPaths {
  return {
    inputPath: path.join(tmpDir, `${jobId}-in.mp4`),
    outputPath: path.join(tmpDir, `${jobId}.mp4`),
  }
}

export function isExpired(
  job: { createdAt: number; status: JobStatus },
  now: number,
  ttlMs: number,
): boolean {
  if (job.status === "rendering") return false
  return now - job.createdAt >= ttlMs
}

export async function cleanupJobFiles(paths: JobPaths): Promise<void> {
  await rm(paths.inputPath, { force: true })
  await rm(paths.outputPath, { force: true })
}

export async function resetTmpDir(tmpDir: string): Promise<void> {
  await rm(tmpDir, { recursive: true, force: true })
  await mkdir(tmpDir, { recursive: true })
}
