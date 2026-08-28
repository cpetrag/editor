export class RenderExportError extends Error {
  readonly status: number | null
  readonly fallbackToDraft: boolean

  constructor(message: string, status: number | null, fallbackToDraft: boolean) {
    super(message)
    this.name = "RenderExportError"
    this.status = status
    this.fallbackToDraft = fallbackToDraft
  }
}

export function errorFromRenderNetwork(): RenderExportError {
  return new RenderExportError(
    "Não consegui falar com o Mac. Se o vídeo já foi gerado, use Recuperar último export.",
    null,
    false,
  )
}

export function errorFromRenderResponse(
  status: number,
  body: { error?: unknown } | null,
): RenderExportError {
  if (status === 409) {
    const fromBody = typeof body?.error === "string" ? body.error.trim() : ""
    const message =
      !fromBody || /andamento/i.test(fromBody)
        ? "Já tem um render rodando. Espere terminar e tente de novo."
        : fromBody
    return new RenderExportError(message, 409, false)
  }
  if (status === 507) {
    return new RenderExportError(
      "Disco insuficiente no Mac. Liberar espaço e tentar de novo.",
      507,
      false,
    )
  }
  if (status === 503) {
    return new RenderExportError(
      "Não consegui falar com o Mac. Se o vídeo já foi gerado, use Recuperar último export.",
      503,
      false,
    )
  }
  const fromBody = typeof body?.error === "string" ? body.error.trim() : ""
  return new RenderExportError(
    fromBody || `Falha no render final (HTTP ${status})`,
    status,
    false,
  )
}
