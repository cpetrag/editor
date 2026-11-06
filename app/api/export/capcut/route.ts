import { copyExportToCapcut } from "@/lib/export/capcut-copy"
import { resolveCapcutDir } from "@/lib/export/capcut-path"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0
export const maxDuration = 120

export async function POST(request: Request): Promise<Response> {
  try {
    const form = await request.formData()
    const fileNameRaw = form.get("fileName")
    const fileName = typeof fileNameRaw === "string" ? fileNameRaw : "video.mp4"
    const video = form.get("video")
    if (typeof File === "undefined" || !(video instanceof File) || video.size === 0) {
      return Response.json({ error: "vídeo ausente" }, { status: 400 })
    }
    const mime = video.type.toLowerCase()
    const name = fileName.toLowerCase()
    if (mime.includes("webm") || name.endsWith(".webm")) {
      return Response.json(
        { error: "A pasta CapCut só aceita MP4." },
        { status: 415 },
      )
    }
    const copied = await copyExportToCapcut({
      destDir: resolveCapcutDir(process.env),
      fileName,
      bytes: new Uint8Array(await video.arrayBuffer()),
    })
    return Response.json({ saved: true, fileName: copied.fileName })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pasta CapCut indisponível"
    console.error("[export/capcut]", message)
    return Response.json({ error: message }, { status: 500 })
  }
}
