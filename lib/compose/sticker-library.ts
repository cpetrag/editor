import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

export interface StickerLibraryItem {
  id: string
  name: string
  mediaUrl: string
}

export function stickerRoot(): string {
  const fromEnv = String(process.env.STICKER_PNG_DIR || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
  if (fromEnv) return path.resolve(fromEnv)
  return path.join(process.cwd(), "data", "stickers")
}

export function stickerIdFromName(fileName: string): string {
  const base = path.parse(fileName).name
  const slug =
    base
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "sticker"
  const hash = createHash("sha1").update(fileName).digest("hex").slice(0, 10)
  return `${slug}-${hash}`
}

export function isSafeStickerId(id: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)
}

export function listStickerLibrary(): StickerLibraryItem[] {
  const root = stickerRoot()
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return []
  const names = fs
    .readdirSync(root)
    .filter((name) => name.toLowerCase().endsWith(".png") && !name.startsWith("."))
  return names.map((name) => {
    const id = stickerIdFromName(name)
    return {
      id,
      name,
      mediaUrl: `/api/compose/stickers/media/${id}`,
    }
  })
}

export const MAX_STICKER_UPLOAD_BYTES = 5 * 1024 * 1024

function safeFileBase(fileName: string): string {
  const base = path.parse(fileName).name.replace(/[\\/:*?"<>|]/g, "").replace(/^\.+/, "").trim()
  return base || "sticker"
}

function uniquePngName(root: string, fileName: string): string {
  const base = safeFileBase(fileName)
  let name = `${base}.png`
  let index = 2
  while (fs.existsSync(path.join(root, name))) {
    name = `${base}-${index}.png`
    index += 1
  }
  return name
}

function ensureRoot(): string {
  const root = stickerRoot()
  fs.mkdirSync(root, { recursive: true })
  return root
}

function isPngBuffer(bytes: Buffer): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10
  )
}

export function saveUploadedSticker(fileName: string, bytes: Buffer): StickerLibraryItem {
  if (bytes.length > MAX_STICKER_UPLOAD_BYTES) {
    throw new Error("PNG maior que 5 MB")
  }
  if (!isPngBuffer(bytes)) {
    throw new Error("Arquivo não é um PNG válido")
  }
  const root = ensureRoot()
  const name = uniquePngName(root, fileName)
  fs.writeFileSync(path.join(root, name), bytes)
  const id = stickerIdFromName(name)
  return { id, name, mediaUrl: `/api/compose/stickers/media/${id}` }
}

export function renameSticker(id: string, nextName: string): StickerLibraryItem | null {
  const filePath = resolveStickerPath(id)
  if (!filePath) return null
  const root = stickerRoot()
  const current = path.basename(filePath)
  const desired = `${safeFileBase(nextName)}.png`
  const name =
    current.toLowerCase() === desired.toLowerCase() ? current : uniquePngName(root, desired)
  const dest = path.resolve(root, name)
  const relative = path.relative(root, dest)
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null
  if (dest !== filePath) fs.renameSync(filePath, dest)
  const nextId = stickerIdFromName(name)
  return { id: nextId, name, mediaUrl: `/api/compose/stickers/media/${nextId}` }
}

export function deleteSticker(id: string): boolean {
  const filePath = resolveStickerPath(id)
  if (!filePath) return false
  fs.unlinkSync(filePath)
  const thumbs = path.join(stickerRoot(), ".thumbs")
  if (fs.existsSync(thumbs)) {
    for (const name of fs.readdirSync(thumbs)) {
      if (name.startsWith(`${id}-w`) && name.endsWith(".png")) {
        fs.unlinkSync(path.join(thumbs, name))
      }
    }
  }
  return true
}

export function resolveStickerPath(id: string): string | null {
  if (!isSafeStickerId(id)) return null
  const root = stickerRoot()
  const match = listStickerLibrary().find((item) => item.id === id)
  if (!match) return null
  const resolved = path.resolve(root, match.name)
  const relative = path.relative(root, resolved)
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null
  if (!fs.existsSync(resolved)) return null
  return resolved
}

