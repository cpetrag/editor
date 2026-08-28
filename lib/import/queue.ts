let busy = false
let currentJobId: string | null = null

export function tryAcquireImport(
  jobId: string,
): { ok: true } | { ok: false; currentJobId: string | null } {
  if (busy) return { ok: false, currentJobId }
  busy = true
  currentJobId = jobId
  return { ok: true }
}

export function releaseImport(): void {
  busy = false
  currentJobId = null
}

export function getImportQueue(): { busy: boolean; currentJobId: string | null } {
  return { busy, currentJobId }
}
