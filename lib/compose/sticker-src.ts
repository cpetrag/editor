import type { CompositionInsert } from "../composition.ts"

export function stickerThumbUrl(id: string, width: number): string {
  return `/api/compose/stickers/media/${encodeURIComponent(id)}?w=${width}`
}

export function stickerMediaSrc(
  insert: CompositionInsert,
  blobUrls: Record<string, string> = {},
): string | null {
  if (insert.libraryId) {
    return `/api/compose/stickers/media/${encodeURIComponent(insert.libraryId)}`
  }
  if (insert.fileId && blobUrls[insert.fileId]) return blobUrls[insert.fileId]
  return null
}
