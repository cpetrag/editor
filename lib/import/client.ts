import type { ImportJob } from "./types.ts"

export interface StartImportResponse {
  jobId: string
  status: string
  attached?: boolean
}

export type ParsedStartImport =
  | { ok: true; jobId: string; status: string; attached: boolean }
  | { ok: false; error: string }

export function parseStartImportResponse(status: number, body: unknown): ParsedStartImport {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const jobId = typeof record.jobId === "string" ? record.jobId : ""
  const currentJobId = typeof record.currentJobId === "string" ? record.currentJobId : ""
  const jobStatus = typeof record.status === "string" ? record.status : "running"
  const error = typeof record.error === "string" && record.error.trim() ? record.error : `HTTP ${status}`

  if (status >= 200 && status < 300 && jobId) {
    return { ok: true, jobId, status: jobStatus, attached: false }
  }
  if (status === 429 && currentJobId) {
    return { ok: true, jobId: currentJobId, status: "running", attached: true }
  }
  return { ok: false, error }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

async function readError(res: Response): Promise<string> {
  const body = await readJson(res)
  if (body && typeof body === "object") {
    const error = (body as { error?: unknown }).error
    if (typeof error === "string" && error.trim()) return error
  }
  return `HTTP ${res.status}`
}

export async function startImportDownload(url: string): Promise<StartImportResponse> {
  const res = await fetch("/api/import/download", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  })
  const body = await readJson(res)
  const parsed = parseStartImportResponse(res.status, body)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }
  return { jobId: parsed.jobId, status: parsed.status, attached: parsed.attached }
}

export async function getImportJob(jobId: string): Promise<ImportJob> {
  const res = await fetch(`/api/import/download/${jobId}`)
  if (!res.ok) {
    throw new Error(await readError(res))
  }
  return (await res.json()) as ImportJob
}

export async function fetchImportedFile(jobId: string, fileName: string): Promise<File> {
  const res = await fetch(`/api/import/media/${jobId}`)
  if (!res.ok) {
    throw new Error(await readError(res))
  }
  const blob = await res.blob()
  return new File([blob], fileName, { type: "video/mp4" })
}

export async function waitForImportJob(
  jobId: string,
  {
    intervalMs = 1500,
    signal,
    onStatus,
  }: {
    intervalMs?: number
    signal?: AbortSignal
    onStatus?: (job: ImportJob) => void
  } = {},
): Promise<ImportJob> {
  const delay = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"))
        return
      }
      const onAbort = () => {
        clearTimeout(timer)
        reject(new DOMException("Aborted", "AbortError"))
      }
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort)
        resolve()
      }, ms)
      signal?.addEventListener("abort", onAbort, { once: true })
    })

  while (true) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError")
    const job = await getImportJob(jobId)
    onStatus?.(job)
    if (job.status === "done" || job.status === "error") return job
    await delay(intervalMs)
  }
}
