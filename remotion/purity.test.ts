import { test } from "node:test"
import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const FORBIDDEN = [
  "Date.now",
  "Math.random",
  "requestAnimationFrame",
  "setTimeout",
  "transition:",
  "@keyframes",
]

const ROOT = path.dirname(new URL(import.meta.url).pathname)

function normalizeDir(dir: string): string {
  if (process.platform === "win32" && dir.startsWith("/")) {
    return decodeURIComponent(dir.slice(1))
  }
  return decodeURIComponent(dir)
}

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(full)))
      continue
    }
    if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) continue
    if (/\.(ts|tsx)$/.test(entry.name)) files.push(full)
  }
  return files
}

test("remotion/ source has no wall-clock or CSS animation APIs", async () => {
  const dir = normalizeDir(ROOT)
  const files = await listSourceFiles(dir)
  assert.ok(files.length > 0, "expected remotion source files")

  const hits: string[] = []
  for (const file of files) {
    const source = await readFile(file, "utf8")
    for (const token of FORBIDDEN) {
      if (source.includes(token)) {
        hits.push(`${path.relative(dir, file)}: ${token}`)
      }
    }
  }

  assert.deepEqual(hits, [])
})
