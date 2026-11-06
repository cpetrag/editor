import { LIBRARY_FONT_STORE, openEditorDb } from "./project-store.ts"

export type StoredLibraryFont = {
  id: string
  label: string
  family: string
  mimeType: string
}

type FontRecord = StoredLibraryFont & { data: ArrayBuffer }

export async function listLibraryFonts(): Promise<StoredLibraryFont[]> {
  if (typeof indexedDB === "undefined") return []
  try {
    const db = await openEditorDb()
    const records = await new Promise<FontRecord[]>((resolve, reject) => {
      const tx = db.transaction(LIBRARY_FONT_STORE, "readonly")
      const request = tx.objectStore(LIBRARY_FONT_STORE).getAll()
      request.onsuccess = () => resolve((request.result as FontRecord[]) ?? [])
      request.onerror = () => reject(request.error)
    })
    db.close()
    for (const record of records) {
      await registerLibraryFont(record.family, record.data)
    }
    return records.map(({ id, label, family, mimeType }) => ({ id, label, family, mimeType }))
  } catch (error) {
    console.warn("[editor] não foi possível ler as fontes", error)
    return []
  }
}

export async function saveLibraryFont(file: File): Promise<StoredLibraryFont | null> {
  const lower = file.name.toLowerCase()
  if (!lower.endsWith(".ttf") && !lower.endsWith(".otf")) return null
  const data = await file.arrayBuffer()
  const label = file.name.replace(/\.(ttf|otf)$/i, "")
  const family = label
  const record: FontRecord = {
    id: `font-${crypto.randomUUID()}`,
    label,
    family,
    mimeType: file.type || "font/ttf",
    data,
  }
  await registerLibraryFont(family, data)
  const db = await openEditorDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LIBRARY_FONT_STORE, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(LIBRARY_FONT_STORE).put(record)
  })
  db.close()
  return { id: record.id, label, family, mimeType: record.mimeType }
}

export async function registerLibraryFont(family: string, data: ArrayBuffer): Promise<void> {
  if (typeof FontFace === "undefined" || !document.fonts) return
  try {
    const face = new FontFace(family, data)
    await face.load()
    document.fonts.add(face)
  } catch (error) {
    console.warn("[editor] não foi possível registrar a fonte", error)
  }
}
