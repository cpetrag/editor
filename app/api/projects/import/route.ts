import { createDefaultComposition, parseComposition, type CompositionInsert } from "@/lib/composition"
import { isPrivateHost, downloadRemoteFile } from "@/lib/import/remote-asset"
import { runImportDownload } from "@/lib/import/run-download"
import { saveEditorProject } from "@/lib/projects/store"
import { applyImportedProduct } from "@/lib/shopee/apply"
import { loadShopeeProduct } from "@/lib/shopee/load"

export const runtime = "nodejs"
export const maxDuration = 300

function publicOrigin(req: Request): string {
  const fromEnv = String(process.env.EDITOR_PUBLIC_ORIGIN || "").trim().replace(/\/$/, "")
  if (fromEnv) return fromEnv
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || ""
  const proto = req.headers.get("x-forwarded-proto") || "https"
  if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) return `${proto}://${host}`
  return "https://editor.macmini-capture.cc"
}

function captionInserts(raw: unknown): CompositionInsert[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item, index) => {
    if (!item || typeof item !== "object") return []
    const row = item as { text?: unknown; start?: unknown; end?: unknown }
    if (typeof row.text !== "string" || !row.text.trim()) return []
    const start = typeof row.start === "number" ? row.start : 0
    const end = typeof row.end === "number" ? row.end : start + 2
    const duration = Math.max(0.3, end - start)
    return [{
      id: `cap-${index + 1}`,
      type: "legenda" as const,
      kind: "caption" as const,
      start,
      duration,
      text: row.text.trim(),
      words: [{ text: row.text.trim(), start, end: start + duration }],
      anchor: "bottom" as const,
      animIn: "none" as const,
      animOut: "none" as const,
    }]
  })
}

export async function POST(req: Request): Promise<Response> {
  let body: { videoUrl?: unknown; shopeeUrl?: unknown; voiceUrl?: unknown; captions?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }
  const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : ""
  if (!videoUrl) return Response.json({ error: "Falta videoUrl." }, { status: 400 })
  try {
    const video = await runImportDownload(videoUrl)
    let voiceJobId: string | undefined
    let voiceFileName: string | undefined
    if (typeof body.voiceUrl === "string" && body.voiceUrl.trim()) {
      const voice = await downloadRemoteFile({
        url: body.voiceUrl.trim(),
        allow: (host) => !isPrivateHost(host),
        fallbackName: "locucao.mp3",
      })
      voiceJobId = voice.jobId
      voiceFileName = voice.fileName
    }
    const captions = captionInserts(body.captions)
    const end = captions.reduce((max, insert) => Math.max(max, insert.start + insert.duration), 15)
    let composition = createDefaultComposition()
    composition = {
      ...composition,
      source: {
        ...composition.source,
        duration: end,
        fileName: video.title || "video.mp4",
        remoteUrl: videoUrl,
      },
      inserts: captions,
      ...(voiceJobId
        ? { audio: { ...composition.audio, original: { volume: composition.audio.original.volume, muted: true } } }
        : {}),
    }
    if (typeof body.shopeeUrl === "string" && body.shopeeUrl.trim()) {
      const product = await loadShopeeProduct(body.shopeeUrl.trim())
      composition = applyImportedProduct(composition, product)
    }
    const stored = parseComposition(composition)
    const project = saveEditorProject({
      videoJobId: video.jobId,
      videoFileName: `${video.title || "video"}.mp4`,
      ...(voiceJobId ? { voiceJobId, voiceFileName } : {}),
      composition: JSON.parse(JSON.stringify(stored)) as unknown,
    })
    const editorUrl = `${publicOrigin(req)}/?project=${project.id}`
    return Response.json({ editorUrl, projectId: project.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar o projeto."
    console.error("[projects/import]", message)
    return Response.json({ error: message }, { status: 422 })
  }
}
