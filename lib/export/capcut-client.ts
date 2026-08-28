export type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>

export function shouldCopyBrowserExportToCapcut(_input: {
  wanted: boolean
  source: "draft" | "final"
}): boolean {
  return false
}

export type CapcutCopyResult = {
  saved: boolean
  fileName?: string
  error?: string
}

export function capcutFromDownloadHeaders(headers: Headers): {
  saved: boolean
  fileName: string | null
} {
  const saved = headers.get("x-capcut-saved") === "1"
  const raw = headers.get("x-capcut-file")
  if (!raw) return { saved, fileName: null }
  try {
    return { saved, fileName: decodeURIComponent(raw) }
  } catch {
    return { saved, fileName: raw }
  }
}

function isMp4Blob(blob: Blob, fileName: string): boolean {
  const mime = blob.type.toLowerCase()
  const name = fileName.toLowerCase()
  if (mime.includes("webm") || name.endsWith(".webm")) return false
  return mime.includes("mp4") || name.endsWith(".mp4") || mime === ""
}

export async function saveBlobToCapcut(
  blob: Blob,
  fileName: string,
  fetchImpl: FetchImpl = fetch,
): Promise<CapcutCopyResult> {
  if (!isMp4Blob(blob, fileName)) {
    return { saved: false, error: "A pasta CapCut só aceita MP4." }
  }
  try {
    const form = new FormData()
    form.set("fileName", fileName)
    form.set("video", blob, fileName)
    const response = await fetchImpl("/api/export/capcut", {
      method: "POST",
      body: form,
    })
    const body = (await response.json().catch(() => ({}))) as {
      saved?: unknown
      fileName?: unknown
      error?: unknown
    }
    if (!response.ok) {
      return {
        saved: false,
        error:
          typeof body.error === "string" ? body.error : "Pasta CapCut indisponível",
      }
    }
    return {
      saved: body.saved === true,
      fileName: typeof body.fileName === "string" ? body.fileName : undefined,
    }
  } catch (error) {
    return {
      saved: false,
      error: error instanceof Error ? error.message : "Pasta CapCut indisponível",
    }
  }
}

export async function applyCapcutCopy(input: {
  wanted: boolean
  alreadySaved?: boolean
  skipClientUpload?: boolean
  blob: Blob
  fileName: string
  fetchImpl?: FetchImpl
}): Promise<"saved" | "failed" | "skipped"> {
  if (!input.wanted) return "skipped"
  if (input.alreadySaved) return "saved"
  if (input.skipClientUpload) return "failed"
  const result = await saveBlobToCapcut(input.blob, input.fileName, input.fetchImpl)
  return result.saved ? "saved" : "failed"
}
