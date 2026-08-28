export const GB = 1024 * 1024 * 1024
export const MIN_FREE_DISK_BYTES = 5 * GB

export function hasEnoughDisk(
  freeBytes: number,
  minBytes = MIN_FREE_DISK_BYTES,
): boolean {
  return freeBytes >= minBytes
}
