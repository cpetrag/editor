import { parseHooksPayload } from "@/lib/ai-hooks"
import { completeHooks, getOpenAiApiKey } from "@/lib/ai-openai"
import { AI_FAILURE_STATUS } from "@/lib/ai-schema"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request): Promise<Response> {
  if (!getOpenAiApiKey()) {
    return Response.json({ error: "IA não configurada no servidor." }, { status: 503 })
  }

  let body: { prompt?: unknown }
  try {
    body = (await req.json()) as { prompt?: unknown }
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
  if (!prompt) {
    return Response.json({ error: "Descreva o produto." }, { status: 400 })
  }

  try {
    const raw = await completeHooks(prompt)
    const hooks = parseHooksPayload({ hooks: raw })
    if (hooks.length === 0) {
      return Response.json({ error: "Não foi possível sugerir ganchos." }, { status: AI_FAILURE_STATUS })
    }
    return Response.json({ hooks })
  } catch (error) {
    console.error("[editor] falha em /api/ai/hooks", error instanceof Error ? error.message : error)
    return Response.json({ error: "Não foi possível sugerir ganchos." }, { status: AI_FAILURE_STATUS })
  }
}
