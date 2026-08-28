export async function materializeBlob(blob: Blob): Promise<Blob> {
  const buffer = await blob.arrayBuffer()
  return new Blob([buffer], { type: blob.type || "application/octet-stream" })
}
