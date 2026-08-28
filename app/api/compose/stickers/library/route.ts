import { listStickerLibrary, MAX_STICKER_UPLOAD_BYTES, saveUploadedSticker } from "@/lib/compose/sticker-library"

export const runtime = "nodejs"

export async function GET(): Promise<Response> {
  try {
    return Response.json({ ok: true, items: listStickerLibrary() })
  } catch (error) {
    console.error("[editor] falha ao listar stickers PNG", error)
    return Response.json({ ok: true, items: [] })
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return Response.json({ error: "arquivo ausente" }, { status: 400 })
    }
    if (file.size > MAX_STICKER_UPLOAD_BYTES) {
      return Response.json({ error: "PNG maior que 5 MB" }, { status: 400 })
    }
    const bytes = Buffer.from(await file.arrayBuffer())
    const item = saveUploadedSticker(file.name || "sticker.png", bytes)
    return Response.json({ ok: true, item })
  } catch (error) {
    console.error("[editor] falha ao enviar PNG", error)
    const message = error instanceof Error ? error.message : "não foi possível enviar"
    return Response.json({ error: message }, { status: 400 })
  }
}
