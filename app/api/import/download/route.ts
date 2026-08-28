import fs from "node:fs"

import { parseAllowedImportUrl } from "@/lib/import/allowlist"
import { tryAcquireImport, releaseImport } from "@/lib/import/queue"
import { downloadShopeeVideo } from "@/lib/import/shopee-video"
import {
  createJob,
  mp4Path,
  updateJob,
  writeMeta,
} from "@/lib/import/store"
import type { ImportMeta } from "@/lib/import/types"
import { runYtDlp } from "@/lib/import/ytdlp"

export const runtime = "nodejs"

export async function POST(req: Request): Promise<Response> {
  let body: { url?: unknown }
  try {
    body = (await req.json()) as { url?: unknown }
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = parseAllowedImportUrl(body?.url)
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 })
  }

  const job = createJob({
    status: "queued",
    sourceUrl: parsed.href,
    platform: parsed.platform,
    title: null,
    error: null,
  })

  const acquired = tryAcquireImport(job.id)
  if (!acquired.ok) {
    updateJob(job.id, { status: "error", error: "fila ocupada" })
    return Response.json(
      { error: "download em andamento", currentJobId: acquired.currentJobId },
      { status: 429 },
    )
  }

  updateJob(job.id, { status: "running" })

  const jobId = job.id
  const dest = mp4Path(jobId)
  if (!dest) {
    releaseImport()
    updateJob(jobId, { status: "error", error: "id inválido" })
    return Response.json({ error: "id inválido" }, { status: 500 })
  }

  const finishOk = (title: string, extraMeta: Partial<ImportMeta> = {}) => {
    const bytes = fs.existsSync(dest) ? fs.statSync(dest).size : 0
    writeMeta(jobId, {
      title,
      platform: parsed.platform,
      sourceUrl: parsed.href,
      createdAt: Date.now(),
      bytes,
      ...extraMeta,
    })
    updateJob(jobId, { status: "done", title })
  }

  const finishErr = (error: unknown) => {
    const message = error instanceof Error ? error.message : "falha no download"
    console.error("[import/download]", message)
    updateJob(jobId, { status: "error", error: message })
    try {
      if (fs.existsSync(dest)) fs.unlinkSync(dest)
    } catch (unlinkErr) {
      console.error("[import/download] cleanup", unlinkErr)
    }
  }

  setImmediate(() => {
    const run =
      parsed.platform === "shopee-video"
        ? downloadShopeeVideo({ shareUrl: parsed.href, destMp4: dest }).then((meta) =>
            finishOk(meta.title, {
              postId: meta.postId ?? null,
              author: meta.author ?? null,
              likes: meta.likes ?? null,
              comments: meta.comments ?? null,
              hashtags: meta.hashtags ?? [],
              durationMs: meta.durationMs ?? null,
              coverUrl: meta.coverUrl ?? null,
              canonicalUrl: meta.canonicalUrl ?? null,
              watermarked: true,
            }),
          )
        : runYtDlp({ url: parsed.href, destMp4: dest }).then(({ title }) => finishOk(title))

    run.catch(finishErr).finally(() => {
      releaseImport()
    })
  })

  return Response.json({ jobId, status: "running" })
}
