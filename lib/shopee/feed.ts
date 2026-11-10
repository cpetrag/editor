import { spawn } from "node:child_process"
import fs from "node:fs"

import type { ShopeeBadges, ShopeeVariation } from "./types.ts"

export type FeedFacts = {
  title?: string
  category?: string[]
  rating?: number | null
  ratingCount?: number | null
  sold?: number | null
  images?: string[]
  variations?: ShopeeVariation[]
  badges?: ShopeeBadges
  shopId?: string
}

const QUERY = `
import json, sys
try:
    import duckdb
except Exception as exc:
    print(json.dumps({"error": str(exc)}))
    raise SystemExit
db, item_id = sys.argv[1], sys.argv[2]
con = duckdb.connect(db, read_only=True)
tables = {row[0] for row in con.execute("SHOW TABLES").fetchall()}
if "produtos" not in tables:
    print("{}")
    raise SystemExit
cols = [row[0] for row in con.execute("DESCRIBE produtos").fetchall()]
item_col = next((name for name in ("itemid", "item_id", "product_id") if name in cols), None)
if not item_col:
    print("{}")
    raise SystemExit
quoted = '"' + item_col.replace('"', '""') + '"'
row = con.execute(
    f"SELECT * FROM produtos WHERE CAST({quoted} AS VARCHAR) = ? LIMIT 1",
    [str(item_id)],
).fetchone()
if not row:
    print("{}")
    raise SystemExit
print(json.dumps({col: value for col, value in zip(cols, row)}, default=str))
`

function feedDatabase(): string | null {
  const candidates = [
    process.env.SHOPEE_FEED_DB,
    "/Volumes/HD 1Tb/Vibecoding/feed-shopee/data/feed.duckdb",
    "N:/Vibecoding/feed-shopee/data/feed.duckdb",
  ].filter((item): item is string => Boolean(item && item.trim()))
  return candidates.find((item) => fs.existsSync(item)) ?? null
}

function pythonBin(): string {
  const fromEnv = String(process.env.SHOPEE_FEED_PYTHON || "").trim()
  if (fromEnv) return fromEnv
  const venv = "/Volumes/HD 1Tb/Vibecoding/feed-shopee/venv/bin/python"
  if (fs.existsSync(venv)) return venv
  return "python3"
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  const text = value.trim()
  if (!text) return null
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function text(row: Record<string, unknown>, names: string[]): string {
  for (const name of names) {
    const value = row[name]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return ""
}

function badgesOf(row: Record<string, unknown>): ShopeeBadges {
  const blob = Object.values(row)
    .filter((value) => typeof value === "string")
    .join(" ")
    .toUpperCase()
  const badges: ShopeeBadges = {}
  if (/FREE.?SHIP|FRETE.?GRATIS|FRETE GRÁTIS/.test(blob)) badges.freeShipping = true
  if (/\bMALL\b/.test(blob)) badges.mall = true
  if (/OFFICIAL/.test(blob)) badges.officialStore = true
  if (/PREFERRED|PREFERIDO/.test(blob)) badges.preferred = true
  return badges
}

function mapRow(row: Record<string, unknown>): FeedFacts {
  const category = ["global_category1", "global_category2", "global_category3", "categoria", "category", "subcat"]
    .map((key) => text(row, [key]))
    .filter(Boolean)
  const image = text(row, ["imagem", "image_link", "image_url", "image"])
  const rating = asNumber(row.nota ?? row.item_rating ?? row.rating_star ?? row.rating)
  const sold = asNumber(row.vendidos ?? row.sales ?? row.item_sold ?? row.historical_sold)
  const ratingCount = asNumber(row.avaliacoes ?? row.rating_count ?? row.rating_total)
  return {
    ...(text(row, ["titulo", "title", "product_name", "item_name"])
      ? { title: text(row, ["titulo", "title", "product_name", "item_name"]) }
      : {}),
    ...(category.length ? { category } : {}),
    ...(rating != null ? { rating } : {}),
    ...(ratingCount != null ? { ratingCount } : {}),
    ...(sold != null ? { sold } : {}),
    ...(image ? { images: [image] } : {}),
    badges: badgesOf(row),
    ...(text(row, ["shopid", "shop_id"]) ? { shopId: text(row, ["shopid", "shop_id"]) } : {}),
  }
}

export type FeedRead =
  | { status: "ok"; data: FeedFacts }
  | { status: "miss" }
  | { status: "error"; error: string }

export async function readFeedProduct(itemId: string): Promise<FeedRead> {
  const database = feedDatabase()
  if (!database) return { status: "miss" }
  const raw = await new Promise<string>((resolve, reject) => {
    const child = spawn(pythonBin(), ["-c", QUERY, database, itemId], { windowsHide: true })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8")
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8")
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim() || `feed encerrou ${code}`))
        return
      }
      resolve(stdout.trim())
    })
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "falha no feed"
    console.error("[shopee] feed", message)
    return { error: message }
  })
  if (raw && typeof raw === "object" && "error" in raw) return { status: "error", error: raw.error }
  if (!raw || typeof raw !== "string") return { status: "error", error: "falha no feed" }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (parsed.error) {
      const message = String(parsed.error)
      console.error("[shopee] feed", message)
      return { status: "error", error: message }
    }
    if (!Object.keys(parsed).length) return { status: "miss" }
    return { status: "ok", data: mapRow(parsed) }
  } catch (error) {
    const message = error instanceof Error ? error.message : "json do feed inválido"
    console.error("[shopee] feed json", message)
    return { status: "error", error: message }
  }
}
