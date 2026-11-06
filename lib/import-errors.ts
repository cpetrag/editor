export type ImportErrorCode =
  | "PRIVATE"
  | "NOT_FOUND"
  | "GEO_BLOCKED"
  | "RATE_LIMITED"
  | "UNSUPPORTED"
  | "NOT_A_VIDEO"
  | "TOO_LARGE"
  | "NETWORK"
  | "TIMEOUT"
  | "EXTRACTOR_OUTDATED"
  | "UNKNOWN"

export type ImportErrorCopy = {
  title: string
  message: string
  retry: boolean
}

export const IMPORT_ERROR_COPY: Record<ImportErrorCode, ImportErrorCopy> = {
  PRIVATE: {
    title: "Vídeo privado",
    message:
      "Esse perfil não é público, então o link não pode ser baixado. Abra o vídeo no app, salve no seu aparelho e use “Escolher arquivo”.",
    retry: false,
  },
  NOT_FOUND: {
    title: "Vídeo não encontrado",
    message: "O link não existe mais ou foi removido pelo autor. Confira se copiou o link completo.",
    retry: false,
  },
  GEO_BLOCKED: {
    title: "Bloqueado na sua região",
    message: "Esse vídeo não está disponível aqui. Salve pelo app e use “Escolher arquivo”.",
    retry: false,
  },
  RATE_LIMITED: {
    title: "Muitas importações seguidas",
    message: "Espere alguns minutos e tente de novo, ou use “Escolher arquivo” enquanto isso.",
    retry: false,
  },
  UNSUPPORTED: {
    title: "Link não suportado",
    message:
      "Aceitamos YouTube, TikTok, Instagram, Facebook, Pinterest, X, Shopee Video e o catálogo do Mac Mini. Para outros, baixe o arquivo e use “Escolher arquivo”.",
    retry: false,
  },
  NOT_A_VIDEO: {
    title: "Esse link não é de vídeo",
    message: "Cole o link de um vídeo — perfil, hashtag e som não funcionam.",
    retry: false,
  },
  TOO_LARGE: {
    title: "Vídeo grande demais",
    message: "Acima de 200 MB não dá para processar no navegador. Corte antes ou use um trecho.",
    retry: false,
  },
  NETWORK: {
    title: "Falha ao baixar",
    message: "A conexão caiu no meio.",
    retry: true,
  },
  TIMEOUT: {
    title: "Demorou demais",
    message: "O servidor não respondeu.",
    retry: true,
  },
  EXTRACTOR_OUTDATED: {
    title: "TikTok bloqueou o download",
    message:
      "O TikTok às vezes barra o extractor. Tente de novo em alguns segundos, ou use “Escolher arquivo”.",
    retry: true,
  },
  UNKNOWN: {
    title: "Não foi possível importar",
    message: "O download falhou. Confira o link ou use “Escolher arquivo”.",
    retry: false,
  },
}

const RULES: Array<{ code: ImportErrorCode; pattern: RegExp }> = [
  {
    code: "EXTRACTOR_OUTDATED",
    pattern:
      /universal data for rehydration|no impersonate target is available|unexpected response from webpage request/i,
  },
  { code: "PRIVATE", pattern: /\bprivate\b/i },
  { code: "GEO_BLOCKED", pattern: /not available in your country|geo(?:graphic)?(?:ally)? blocked|region/i },
  { code: "RATE_LIMITED", pattern: /\b429\b|too many requests|rate.?limit/i },
  { code: "TIMEOUT", pattern: /\btimeout\b|timed out/i },
  { code: "NOT_FOUND", pattern: /\bunavailable\b|\b404\b|not found|removed/i },
  { code: "TOO_LARGE", pattern: /grande demais|too large/i },
  { code: "UNSUPPORTED", pattern: /unsupported url|host não permitido/i },
  { code: "NOT_A_VIDEO", pattern: /not a video|no video|unsupported file|não é um vídeo|não é vídeo/i },
  { code: "NETWORK", pattern: /failed to establish|econnreset|enotfound|network|connection/i },
]

export function mapImportError(raw: string): {
  code: ImportErrorCode
  title: string
  message: string
  retry: boolean
  detail: string
} {
  const detail = raw.trim()
  const lower = detail.toLowerCase()
  const matched = RULES.find((rule) => rule.pattern.test(lower))
  const code = matched?.code ?? "UNKNOWN"
  const copy = IMPORT_ERROR_COPY[code]
  return { code, title: copy.title, message: copy.message, retry: copy.retry, detail }
}
