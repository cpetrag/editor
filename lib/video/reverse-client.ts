import type { VideoFileStore } from "../project-store.ts"

const inflight = new Map<string, Promise<Blob>>()

export function reverseStoreKey(fileId: string, start: number, end: number): string {
  return `${fileId}:rev:${start.toFixed(3)}:${end.toFixed(3)}`
}

/** Chave curta pedida para o preview e o rascunho acharem a mesma volta. */
export function reverseStoreAlias(fileId: string): string {
  return `${fileId}:rev`
}

async function readCached(store: VideoFileStore, fileId: string, start: number, end: number): Promise<Blob | null> {
  const exact = await store.load(reverseStoreKey(fileId, start, end))
  if (exact?.blob) return exact.blob
  const alias = await store.load(reverseStoreAlias(fileId))
  return alias?.blob ?? null
}

async function createReverse(fileId: string, fileName: string, blob: Blob, start: number, end: number): Promise<Blob> {
  const body = new FormData()
  body.append("video", blob, fileName || "video.mp4")
  body.append("start", String(start))
  body.append("end", String(end))
  const created = await fetch("/api/video/reverse", { method: "POST", body })
  if (!created.ok) throw new Error(await created.text())
  const meta = (await created.json()) as { url?: string }
  if (!meta.url) throw new Error("volta sem url")
  const file = await fetch(meta.url)
  if (!file.ok) throw new Error("não foi possível baixar a volta")
  return file.blob()
}

/** Lê `<fileId>:rev` no IndexedDB ou gera a volta da faixa útil e grava as duas chaves. */
export function loadOrCreateReverseBlob(input: {
  store: VideoFileStore
  fileId: string
  fileName: string
  start: number
  end: number
}): Promise<Blob> {
  const key = reverseStoreKey(input.fileId, input.start, input.end)
  const pending = inflight.get(key)
  if (pending) return pending
  const job = (async () => {
    const cached = await readCached(input.store, input.fileId, input.start, input.end)
    if (cached) return cached
    const original = await input.store.load(input.fileId)
    if (!original?.blob) throw new Error("vídeo original ausente")
    const blob = await createReverse(
      input.fileId,
      original.fileName || input.fileName,
      original.blob,
      input.start,
      input.end,
    )
    const meta = { fileName: "video__reverso.mp4", mimeType: "video/mp4" }
    await input.store.save(key, blob, meta)
    await input.store.save(reverseStoreAlias(input.fileId), blob, meta)
    return blob
  })()
  inflight.set(key, job)
  void job.finally(() => {
    if (inflight.get(key) === job) inflight.delete(key)
  })
  return job
}
