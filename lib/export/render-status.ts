export type RenderStatus = {
  progress: number
  stage: string
  error?: string
  capcutSaved?: boolean
  capcutFileName?: string
}

/** Aceita só o formato esperado; qualquer resposta estranha vira "sem novidade". */
export function parseRenderStatus(value: unknown): RenderStatus {
  if (!value || typeof value !== "object") return { progress: 0, stage: "rendering" }
  const parsed = value as {
    progress?: unknown
    stage?: unknown
    error?: unknown
    capcutSaved?: unknown
    capcutFileName?: unknown
  }
  return {
    progress:
      typeof parsed.progress === "number" && Number.isFinite(parsed.progress)
        ? Math.min(1, Math.max(0, parsed.progress))
        : 0,
    stage: typeof parsed.stage === "string" ? parsed.stage : "rendering",
    ...(typeof parsed.error === "string" ? { error: parsed.error } : {}),
    ...(typeof parsed.capcutSaved === "boolean" ? { capcutSaved: parsed.capcutSaved } : {}),
    ...(typeof parsed.capcutFileName === "string"
      ? { capcutFileName: parsed.capcutFileName }
      : {}),
  }
}
