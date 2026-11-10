import fs from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

import { parseStoredShopee } from "./stored.ts"
import type { ShopeeProduct } from "./types.ts"

const TTL_MS = 24 * 60 * 60 * 1000

function cachePath(): string {
  const fromEnv = String(process.env.SHOPEE_CACHE_PATH || "").trim()
  if (fromEnv) return path.resolve(fromEnv)
  return path.join(process.cwd(), "data", "shopee-cache.sqlite")
}

let database: DatabaseSync | null = null

function db(): DatabaseSync {
  if (database) return database
  const file = cachePath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  database = new DatabaseSync(file)
  database.exec(`
    CREATE TABLE IF NOT EXISTS shopee_product (
      item_id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    )
  `)
  return database
}

export function readShopeeCache(itemId: string, now = Date.now()): ShopeeProduct | null {
  try {
    const row = db().prepare("SELECT payload, fetched_at FROM shopee_product WHERE item_id = ?").get(itemId) as
      | { payload?: string; fetched_at?: string }
      | undefined
    if (!row?.payload || !row.fetched_at) return null
    const at = Date.parse(row.fetched_at)
    if (!Number.isFinite(at) || now - at > TTL_MS) return null
    return parseStoredShopee(JSON.parse(row.payload)) ?? null
  } catch (error) {
    console.error("[shopee] cache leitura", error instanceof Error ? error.message : error)
    return null
  }
}

export function writeShopeeCache(product: ShopeeProduct): void {
  try {
    db()
      .prepare(
        `INSERT INTO shopee_product (item_id, payload, fetched_at)
         VALUES (?, ?, ?)
         ON CONFLICT(item_id) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
      )
      .run(product.itemId, JSON.stringify(product), product.fetchedAt)
  } catch (error) {
    console.error("[shopee] cache escrita", error instanceof Error ? error.message : error)
  }
}
