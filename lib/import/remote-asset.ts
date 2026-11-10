import fs from "node:fs"

import { createJob, mp4Path, updateJob, writeMeta } from "./store.ts"

const MAX_BYTES = 25 * 1024 * 1024

export function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/\.+$/, "").toLowerCase()
  if (host === "localhost" || host.endsWith(".local") || host === "::1") return true
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true
  return false
}

export function isAllowedAssetHost(hostname: string): boolean {
  const host = hostname.replace(/\.+$/, "").toLowerCase()
  if (isPrivateHost(host)) return false
  return (
    host === "shopee.com.br" ||
    host.endsWith(".shopee.com.br") ||
    host === "susercontent.com" ||
    host.endsWith(".susercontent.com") ||
    host === "shp.ee" ||
    host.endsWith(".shp.ee")
  )
}

export async function downloadRemoteFile(input: {
  url: string
  allow: (hostname: string) => boolean
  fallbackName: string
}): Promise<{ jobId: string; mime: string; fileName: string }> {
  let current = new URL(input.url)
  if (current.protocol !== "https:" && current.protocol !== "http:") {
    throw new Error("URL inválida")
  }
  if (!input.allow(current.hostname) || isPrivateHost(current.hostname)) {
    throw new Error("host não permitido")
  }
  const response = await fetch(current.href, { redirect: "follow", signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`download falhou (${response.status})`)
  const finalUrl = new URL(response.url || current.href)
  if (!input.allow(finalUrl.hostname) || isPrivateHost(finalUrl.hostname)) {
    throw new Error("host não permitido")
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.byteLength === 0) throw new Error("arquivo vazio")
  if (bytes.byteLength > MAX_BYTES) throw new Error("arquivo grande demais")
  const mime = (response.headers.get("content-type") || "application/octet-stream").split(";")[0]?.trim() || "application/octet-stream"
  const job = createJob({
    status: "running",
    sourceUrl: finalUrl.href,
    platform: null,
    title: input.fallbackName,
    error: null,
  })
  const dest = mp4Path(job.id)
  if (!dest) throw new Error("id inválido")
  fs.writeFileSync(dest, bytes)
  writeMeta(job.id, {
    title: input.fallbackName,
    platform: "asset",
    sourceUrl: finalUrl.href,
    createdAt: Date.now(),
    bytes: bytes.byteLength,
    mime,
  })
  updateJob(job.id, { status: "done", title: input.fallbackName })
  return { jobId: job.id, mime, fileName: input.fallbackName }
}
