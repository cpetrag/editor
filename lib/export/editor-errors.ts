export function errorMessageOf(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === "string" && error.trim()) return error
  return "Falha inesperada no editor"
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

/** Listeners globais: nenhuma rejeição some sem log. */
export function installEditorErrorListeners(
  onUnhandled: (message: string, error: unknown) => void,
  target: Pick<Window, "addEventListener" | "removeEventListener"> | null = typeof window === "undefined"
    ? null
    : window,
): () => void {
  if (!target) return () => {}

  const onRejection = (event: PromiseRejectionEvent) => {
    const error = event.reason
    console.error("[editor]", error)
    if (!isAbortError(error)) onUnhandled(errorMessageOf(error), error)
  }
  const onError = (event: ErrorEvent) => {
    const error = event.error ?? event.message
    console.error("[editor]", error)
    onUnhandled(errorMessageOf(error), error)
  }

  target.addEventListener("unhandledrejection", onRejection as EventListener)
  target.addEventListener("error", onError as EventListener)
  return () => {
    target.removeEventListener("unhandledrejection", onRejection as EventListener)
    target.removeEventListener("error", onError as EventListener)
  }
}
