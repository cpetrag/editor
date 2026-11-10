import fs from "node:fs"

import { parseAllowedImportUrl } from "./allowlist.ts"
import { downloadMacminiVideo } from "./macmini-video.ts"
import { downloadShopeeVideo } from "./shopee-video.ts"
import { createJob, mp4Path, updateJob, writeMeta } from "./store.ts"
import { runYtDlp } from "./ytdlp.ts"

export async function runImportDownload(url: string): Promise<{ jobId: string; title: string }> {
  const parsed = parseAllowedImportUrl(url)
  if (!parsed.ok) throw new Error(parsed.error)
  const job = createJob({
    status: "running",
    sourceUrl: parsed.href,
    platform: parsed.platform,
    title: null,
    error: null,
  })
  const dest = mp4Path(job.id)
  if (!dest) throw new Error("id inválido")
  try {
    let title = "vídeo"
    let extra: { canonicalUrl?: string | null; watermarked?: boolean } = {}
    if (parsed.platform === "shopee-video") {
      const meta = await downloadShopeeVideo({ shareUrl: parsed.href, destMp4: dest })
      title = meta.title
      extra = { canonicalUrl: meta.canonicalUrl ?? null, watermarked: true }
    } else if (parsed.platform === "macmini-catalog") {
      const meta = await downloadMacminiVideo({ pageUrl: parsed.href, destMp4: dest })
      title = meta.title
      extra = { canonicalUrl: meta.canonicalUrl, watermarked: false }
    } else {
      const result = await runYtDlp({ url: parsed.href, destMp4: dest })
      title = result.title
    }
    const bytes = fs.existsSync(dest) ? fs.statSync(dest).size : 0
    writeMeta(job.id, {
      title,
      platform: parsed.platform,
      sourceUrl: parsed.href,
      createdAt: Date.now(),
      bytes,
      mime: "video/mp4",
      ...extra,
    })
    updateJob(job.id, { status: "done", title })
    return { jobId: job.id, title }
  } catch (error) {
    const message = error instanceof Error ? error.message : "falha no download"
    updateJob(job.id, { status: "error", error: message })
    try {
      if (fs.existsSync(dest)) fs.unlinkSync(dest)
    } catch {
      /* o arquivo parcial não impede o erro */
    }
    throw new Error(message)
  }
}
