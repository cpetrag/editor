export function isUsableBlob(blob: Blob | null | undefined): blob is Blob {
  return !!blob && blob.size > 0
}

export async function resolveExportVideoBlob(input: {
  memoryBlob: Blob | null
  storedBlob: Blob | null
  objectUrl?: string
  fileId?: string | null
  loadByFileId?: (fileId: string) => Promise<Blob | null>
  fetchImpl?: typeof fetch
}): Promise<Blob> {
  if (isUsableBlob(input.memoryBlob)) return input.memoryBlob
  if (isUsableBlob(input.storedBlob)) return input.storedBlob
  if (input.fileId && input.loadByFileId) {
    const loaded = await input.loadByFileId(input.fileId)
    if (isUsableBlob(loaded)) return loaded
  }

  const url = input.objectUrl?.trim() ?? ""
  if (!url) {
    throw new Error("Vídeo de origem não encontrado — reabra o arquivo")
  }

  try {
    const response = await (input.fetchImpl ?? fetch)(url)
    if (!response.ok) {
      throw new Error("fetch failed")
    }
    const blob = await response.blob()
    if (!isUsableBlob(blob)) {
      throw new Error("empty")
    }
    return blob
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Vídeo de origem")) throw error
    throw new Error("Vídeo de origem não encontrado — reabra o arquivo")
  }
}
