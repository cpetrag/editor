import type { ImportPlatform } from "./allowlist.ts"

export type ImportJobStatus = "queued" | "running" | "done" | "error"

export interface ImportJob {
  id: string
  status: ImportJobStatus
  error: string | null
  sourceUrl: string | null
  platform: ImportPlatform | null
  title: string | null
  createdAt: number
  updatedAt: number
}

export interface ImportMeta {
  title: string
  platform: ImportPlatform
  sourceUrl: string
  createdAt: number
  bytes: number
  postId?: string | null
  author?: string | null
  likes?: number | null
  comments?: number | null
  hashtags?: string[]
  durationMs?: number | null
  coverUrl?: string | null
  canonicalUrl?: string | null
  watermarked?: boolean
}
