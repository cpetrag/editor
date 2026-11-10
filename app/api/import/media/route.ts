import { downloadRemoteFile, isAllowedAssetHost } from "@/lib/import/remote-asset"

export const runtime = "nodejs"
export const maxDuration = 90

export async function POST(req: Request): Promise<Response> {
  let body: { url?: unknown }
  try {
    body = (await req.json()) as { url?: unknown }
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }
  const url = typeof body.url === "string" ? body.url.trim() : ""
  if (!url) return Response.json({ error: "URL inválida" }, { status: 400 })
  try {
    const saved = await downloadRemoteFile({
      url,
      allow: isAllowedAssetHost,
      fallbackName: "avaliacao",
    })
    return Response.json({ id: saved.jobId, mime: saved.mime })
  } catch (error) {
    const message = error instanceof Error ? error.message : "falha no download"
    console.error("[import/media]", message)
    return Response.json({ error: message }, { status: 422 })
  }
}
