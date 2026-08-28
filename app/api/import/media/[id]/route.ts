import fs from "node:fs"
import { Readable } from "node:stream"

import { mp4Path } from "@/lib/import/store"

export const runtime = "nodejs"

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params
  const filePath = mp4Path(id)
  if (!filePath || !fs.existsSync(filePath)) {
    return Response.json({ error: "vídeo inexistente" }, { status: 404 })
  }

  const { size } = fs.statSync(filePath)
  const stream = Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream<Uint8Array>
  return new Response(stream, {
    headers: {
      "content-type": "video/mp4",
      "content-length": String(size),
      "accept-ranges": "bytes",
      "cache-control": "private, no-store",
    },
  })
}
