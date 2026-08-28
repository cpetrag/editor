export type SaveTarget = {
  write: (data: Blob) => Promise<void>
}

export type SavePicker = (options: {
  suggestedName: string
  mime: string
  ext: string
}) => Promise<SaveTarget | null>

export type SaveExportResult = "picked" | "download" | "cancelled"

type SaveFilePickerWindow = {
  showSaveFilePicker?: (options: {
    suggestedName?: string
    types?: Array<{
      description?: string
      accept: Record<string, string[]>
    }>
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>
      close: () => Promise<void>
    }>
  }>
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

function extensionOf(fileName: string): "webm" | "mp4" {
  return fileName.toLowerCase().endsWith(".webm") ? "webm" : "mp4"
}

async function browserPick(options: {
  suggestedName: string
  mime: string
  ext: string
}): Promise<SaveTarget | null> {
  const picker = (globalThis as SaveFilePickerWindow).showSaveFilePicker
  if (typeof picker !== "function") return null

  try {
    const handle = await picker({
      suggestedName: options.suggestedName,
      types: [
        {
          description: "Vídeo",
          accept: { [options.mime]: [`.${options.ext}`] },
        },
      ],
    })
    const writable = await handle.createWritable()
    return {
      async write(data) {
        await writable.write(data)
        await writable.close()
      },
    }
  } catch (error) {
    if (isAbortError(error)) return null
    throw error
  }
}

export const BLOB_REVOKE_DELAY_MS = 60_000

export function fallbackDownload(blob: Blob, fileName: string): void {
  if (typeof document === "undefined") return
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.rel = "noopener"
  anchor.style.display = "none"
  document.body?.appendChild(anchor)
  anchor.click()
  window.setTimeout(() => {
    anchor.remove()
    URL.revokeObjectURL(url)
  }, BLOB_REVOKE_DELAY_MS)
}

function defaultPick(): SavePicker | undefined {
  const picker = (globalThis as SaveFilePickerWindow).showSaveFilePicker
  if (typeof picker !== "function") return undefined
  return browserPick
}

function resolveUserActivation(
  explicit?: { isActive: boolean },
): { isActive: boolean } {
  if (explicit) return explicit
  if (typeof navigator !== "undefined" && navigator.userActivation) {
    return navigator.userActivation
  }
  return { isActive: true }
}

export async function saveExportBlob(
  blob: Blob,
  fileName: string,
  deps: {
    pick?: SavePicker
    download?: (data: Blob, name: string) => void
    userActivation?: { isActive: boolean }
  } = {},
): Promise<SaveExportResult> {
  const ext = extensionOf(fileName)
  const mime = blob.type || (ext === "webm" ? "video/webm" : "video/mp4")
  const activation = resolveUserActivation(deps.userActivation)
  const pickFn = deps.pick !== undefined ? deps.pick : defaultPick()
  const pick = activation.isActive ? pickFn : undefined
  const download = deps.download ?? fallbackDownload

  if (pick) {
    try {
      const target = await pick({ suggestedName: fileName, mime, ext })
      if (!target) return "cancelled"
      await target.write(blob)
      return "picked"
    } catch (error) {
      if (isAbortError(error)) return "cancelled"
    }
  }

  download(blob, fileName)
  return "download"
}
