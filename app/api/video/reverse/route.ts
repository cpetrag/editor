import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { pruneReverseCache, reverseCacheId, reverseUsefulRange } from "@/lib/video/reverse-file"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function cacheDir(): string {
  return path.join(process.cwd(), "tmp", "reverse-cache")
}

export async function POST(request: Request): Promise<Response> {
  try {
    const form = await request.formData()
    const file = form.get("video")
    if (!(file instanceof File) || file.size <= 0) {
      return Response.json({ error: "vídeo ausente" }, { status: 400 })
    }
    const start = Number(form.get("start") ?? 0)
    const endRaw = Number(form.get("end") ?? 0)
    const bytes = Buffer.from(await file.arrayBuffer())
    const hash = createHash("sha256").update(bytes).digest("hex")
    const end = endRaw > start ? endRaw : start + 0.5
    const reverseId = reverseCacheId(hash, start, end)
    const dir = cacheDir()
    await mkdir(dir, { recursive: true })
    const outputPath = path.join(dir, `${reverseId}.mp4`)
    try {
      await readFile(outputPath)
    } catch {
      const inputPath = path.join(dir, `${reverseId}-in`)
      await writeFile(inputPath, bytes)
      try {
        await reverseUsefulRange(inputPath, outputPath, { start, end })
      } finally {
        await writeFile(inputPath, Buffer.alloc(0)).catch(() => undefined)
        const { rm } = await import("node:fs/promises")
        await rm(inputPath, { force: true })
      }
    }
    await pruneReverseCache(dir)
    const url = new URL(`/api/video/reverse/${reverseId}`, request.url)
    return Response.json({ reverseId, url: url.pathname })
  } catch (error) {
    console.error("[reverse] falha ao inverter", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "falha ao inverter o vídeo" },
      { status: 500 },
    )
  }
}
