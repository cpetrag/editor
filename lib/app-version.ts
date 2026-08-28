export type AppVersion = {
  version: string
  buildTime: string | null
}

/**
 * Versão embutida no bundle no momento do build. O servidor devolve a mesma
 * coisa em /api/version, então uma diferença significa aba com código velho.
 */
export const APP_VERSION: AppVersion = {
  version: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
  buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || null,
}

export function formatAppVersion(input: AppVersion): string {
  if (!input.buildTime) return `v${input.version}`
  const built = new Date(input.buildTime)
  if (Number.isNaN(built.getTime())) return `v${input.version}`
  const time = built.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  const day = built.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  return `v${input.version} · ${day} ${time}`
}

export function parseAppVersion(value: unknown): AppVersion | null {
  if (!value || typeof value !== "object") return null
  const parsed = value as { version?: unknown; buildTime?: unknown }
  if (typeof parsed.version !== "string" || !parsed.version.trim()) return null
  return {
    version: parsed.version.trim(),
    buildTime: typeof parsed.buildTime === "string" ? parsed.buildTime : null,
  }
}

/** Só acusa versão nova quando as duas pontas são conhecidas e diferentes. */
export function isStaleTab(loaded: AppVersion, served: AppVersion | null): boolean {
  if (!served) return false
  if (loaded.version === "dev" || served.version === "dev") return false
  if (loaded.version !== served.version) return true
  return Boolean(loaded.buildTime && served.buildTime && loaded.buildTime !== served.buildTime)
}
