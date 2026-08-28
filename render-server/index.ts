import { statfs } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { createRenderApp } from "./app.ts"
import { MIN_FREE_DISK_BYTES } from "./disk.ts"
import { detectDockerDesktop } from "./docker.ts"
import { createRemotionEngine } from "./engine.ts"
import { resolveCapcutDir } from "../lib/export/capcut-path.ts"

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const tmpDir = path.join(PROJECT_ROOT, "tmp", "render")
const port = Number(process.env.RENDER_PORT ?? 4014)
const host = process.env.RENDER_HOST ?? "127.0.0.1"

async function main(): Promise<void> {
  const app = await createRenderApp({
    engine: createRemotionEngine(),
    tmpDir,
    getFreeDiskBytes: async (dir) => {
      const stats = await statfs(dir)
      return Number(stats.bavail) * Number(stats.bsize)
    },
    isDockerRunning: detectDockerDesktop,
    now: () => Date.now(),
    minFreeDiskBytes: MIN_FREE_DISK_BYTES,
    renderTimeoutMs: 10 * 60 * 1000,
    ttlMs: 60 * 60 * 1000,
    host,
    port,
    capcutDir: resolveCapcutDir(process.env),
  })

  console.log(`Servidor de render em ${app.url}`)

  const shutdown = () => {
    void app.close().finally(() => process.exit(0))
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
