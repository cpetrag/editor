import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, test } from "node:test"

import {
  HOUR_MS,
  cleanupJobFiles,
  isExpired,
  jobPaths,
  resetTmpDir,
} from "./jobs.ts"

const scratch = await mkdtemp(path.join(tmpdir(), "render-jobs-"))

after(async () => {
  await rm(scratch, { recursive: true, force: true })
})

test("isExpired usa TTL de 1h e ignora job ainda renderizando", () => {
  const createdAt = 1_000
  assert.equal(isExpired({ createdAt, status: "done" }, createdAt + HOUR_MS, HOUR_MS), true)
  assert.equal(isExpired({ createdAt, status: "done" }, createdAt + HOUR_MS - 1, HOUR_MS), false)
  assert.equal(isExpired({ createdAt, status: "rendering" }, createdAt + HOUR_MS * 3, HOUR_MS), false)
})

test("cleanupJobFiles apaga vídeo de entrada e MP4 de saída", async () => {
  const tmpDir = path.join(scratch, "cleanup")
  await mkdir(tmpDir, { recursive: true })
  const paths = jobPaths(tmpDir, "abc")
  await writeFile(paths.inputPath, "in")
  await writeFile(paths.outputPath, "out")

  await cleanupJobFiles(paths)
  await assert.rejects(() => readFile(paths.inputPath))
  await assert.rejects(() => readFile(paths.outputPath))
})

test("resetTmpDir apaga órfãos de um boot anterior", async () => {
  const tmpDir = path.join(scratch, "orphans")
  await mkdir(tmpDir, { recursive: true })
  const leftover = path.join(tmpDir, "old.mp4")
  await writeFile(leftover, "orphan")

  await resetTmpDir(tmpDir)
  await assert.rejects(() => readFile(leftover))
})
