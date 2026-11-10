import type { ShopeeSources } from "./types.ts"

/** Sem SHOPEE_APP_ID e SHOPEE_APP_SECRET a Open API nem é chamada. */
export function openApiSource(input: { configured: boolean; error?: string | null }): Pick<ShopeeSources, "openapi" | "openapiError"> {
  if (!input.configured) return { openapi: "not_configured" }
  if (input.error) return { openapi: "error", openapiError: input.error }
  return { openapi: "ok" }
}

export function formatSourceLine(sources: ShopeeSources): string {
  const feed =
    sources.feed === "ok" ? "Feed ✓" : sources.feed === "miss" ? "Feed não achou" : `Feed ✗${tail(sources.feedError)}`
  const api =
    sources.openapi === "ok"
      ? "API ✓"
      : sources.openapi === "not_configured"
        ? "API sem credenciais"
        : `API ✗${tail(sources.openapiError)}`
  const reviews = sources.reviews === "ok" ? "Avaliações ✓" : `Avaliações ✗${tail(sources.reviewsError)}`
  return `${feed} · ${api} · ${reviews}`
}

function tail(message: string | undefined): string {
  const text = message?.trim()
  return text ? ` (${text})` : ""
}
