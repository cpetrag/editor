import { readFile } from "node:fs/promises"
import path from "node:path"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params
  if (!/^[a-f0-9]{16,64}$/.test(id)) {
    return Response.json({ error: "id inválido" }, { status: 400 })
  }
  try {
    const bytes = await readFile(path.join(process.cwd(), "tmp", "reverse-cache", `${id}.mp4`))
    return new Response(bytes, {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "private, max-age=86400",
      },
    })
  } catch {
    return Response.json({ error: "volta não encontrada" }, { status: 404 })
  }
}
