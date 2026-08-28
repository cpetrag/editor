export function isUsableBlob(blob: Blob | null | undefined): blob is Blob {
  return !!blob && blob.size > 0
}

export async function resolveExportVideoBlob(input: {
  memoryBlob: Blob | null
  storedBlob: Blob | null
  objectUrl: string
  fetchImpl?: typeof fetch
}): Promise<Blob> {
  if (isUsableBlob(input.memoryBlob)) return input.memoryBlob
  if (isUsableBlob(input.storedBlob)) return input.storedBlob

  const url = input.objectUrl.trim()
  if (!url) {
    throw new Error("Não achei o arquivo do vídeo para o render final. Reimporte o arquivo.")
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
  } catch {
    throw new Error("Não achei o arquivo do vídeo para o render final. Reimporte o arquivo.")
  }
}
