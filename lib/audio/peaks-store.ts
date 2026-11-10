import { AUDIO_PEAKS_STORE, openEditorDb } from "../project-store.ts"

export async function loadAudioPeaks(fileId: string): Promise<number[] | null> {
  if (!fileId || typeof indexedDB === "undefined") return null
  const db = await openEditorDb()
  try {
    const record = await new Promise<{ peaks?: number[] } | undefined>((resolve, reject) => {
      const tx = db.transaction(AUDIO_PEAKS_STORE, "readonly")
      const request = tx.objectStore(AUDIO_PEAKS_STORE).get(fileId)
      request.onsuccess = () => resolve(request.result as { peaks?: number[] } | undefined)
      request.onerror = () => reject(request.error ?? new Error("falha ao ler picos"))
    })
    return Array.isArray(record?.peaks) ? record.peaks : null
  } finally {
    db.close()
  }
}

export async function saveAudioPeaks(fileId: string, peaks: number[]): Promise<void> {
  if (!fileId || typeof indexedDB === "undefined") return
  const db = await openEditorDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AUDIO_PEAKS_STORE, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error("falha ao gravar picos"))
      tx.objectStore(AUDIO_PEAKS_STORE).put({ peaks }, fileId)
    })
  } finally {
    db.close()
  }
}
