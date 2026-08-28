import fs from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"

import { pngThumbnail } from "@/lib/compose/sticker-thumb"
import {
  deleteSticker,
  renameSticker,
  resolveStickerPath,
  stickerRoot,
} from "@/lib/compose/sticker-library"

export const runtime = "nodejs"

function parseWidth(req: Request): number {
  const raw = new URL(req.url).searchParams.get("w")
  if (!raw) return 0
  const width = Number(raw)
  if (!Number.isFinite(width) || width < 16 || width > 640) return 0
  return Math.round(width)
}

function pngResponse(body: Buffer, cacheSeconds: number): Response {
  return new Response(body, {
    headers: {
      "content-type": "image/png",
      "content-length": String(body.length),
      "cache-control": `public, max-age=${cacheSeconds}`,
    },
  })
}

function cachedThumbnail(filePath: string, id: string, width: number): Buffer | null {
  const cacheDir = path.join(stickerRoot(), ".thumbs")
  const cachePath = path.join(cacheDir, `${id}-w${width}.png`)
  try {
    const sourceTime = fs.statSync(filePath).mtimeMs
    if (fs.existsSync(cachePath) && fs.statSync(cachePath).mtimeMs >= sourceTime) {
      return fs.readFileSync(cachePath)
    }
  } catch {
    // rebuild
  }
  const thumb = pngThumbnail(fs.readFileSync(filePath), width)
  if (!thumb) return null
  try {
    fs.mkdirSync(cacheDir, { recursive: true })
    fs.writeFileSync(cachePath, thumb)
  } catch (error) {
    console.error("[editor] falha ao gravar miniatura PNG", error)
  }
  return thumb
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params
  const filePath = resolveStickerPath(id)
  if (!filePath) {
    return Response.json({ error: "insert PNG inexistente" }, { status: 404 })
  }

  const width = parseWidth(req)
  if (width) {
    const thumb = cachedThumbnail(filePath, id, width)
    if (thumb) return pngResponse(thumb, 86_400)
  }

  const { size } = fs.statSync(filePath)
  const stream = Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream<Uint8Array>
  return new Response(stream, {
    headers: {
      "content-type": "image/png",
      "content-length": String(size),
      "cache-control": "public, max-age=3600",
    },
  })
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params
  try {
    const body = (await req.json()) as { name?: unknown }
    if (typeof body.name !== "string" || !body.name.trim()) {
      return Response.json({ error: "nome inválido" }, { status: 400 })
    }
    const item = renameSticker(id, body.name)
    if (!item) return Response.json({ error: "insert PNG inexistente" }, { status: 404 })
    return Response.json({ ok: true, item })
  } catch (error) {
    console.error("[editor] falha ao renomear PNG", error)
    return Response.json({ error: "não foi possível renomear" }, { status: 400 })
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params
  try {
    if (!deleteSticker(id)) {
      return Response.json({ error: "insert PNG inexistente" }, { status: 404 })
    }
    return Response.json({ ok: true })
  } catch (error) {
    console.error("[editor] falha ao excluir PNG", error)
    return Response.json({ error: "não foi possível excluir" }, { status: 400 })
  }
}
