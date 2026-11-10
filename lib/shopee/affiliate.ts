import { createHash } from "node:crypto"

import { cleanCategoryTrail } from "./category-niche.ts"
import type { FeedFacts } from "./feed.ts"

const HOST = "https://open-api.affiliate.shopee.com.br/graphql"

function credentials(): { appId: string; secret: string } | null {
  const appId = String(process.env.SHOPEE_APP_ID || "").trim()
  const secret = String(process.env.SHOPEE_APP_SECRET || "").trim()
  if (!appId || !secret) return null
  return { appId, secret }
}

async function signedQuery(payload: string): Promise<unknown> {
  const creds = credentials()
  if (!creds) return null
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = createHash("sha256").update(`${creds.appId}${timestamp}${payload}${creds.secret}`, "utf8").digest("hex")
  const response = await fetch(HOST, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `SHA256 Credential=${creds.appId}, Timestamp=${timestamp}, Signature=${signature}`,
    },
    body: payload,
    signal: AbortSignal.timeout(20_000),
  })
  return response.json()
}

export function affiliateConfigured(): boolean {
  return credentials() != null
}

function errorText(errors: unknown): string {
  if (!Array.isArray(errors) || errors.length === 0) return "Open API recusou a consulta"
  const first = errors[0] as { message?: unknown }
  return typeof first?.message === "string" && first.message.trim() ? first.message.trim() : "Open API recusou a consulta"
}

function asDecimal(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  const parsed = Number(value.trim().replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

function labelsFrom(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()]
  if (!Array.isArray(value)) return []
  const labels: string[] = []
  for (const item of value) {
    if (typeof item === "string" && item.trim()) labels.push(item.trim())
    else if (typeof item === "number" && Number.isFinite(item)) labels.push(String(item))
    else if (item && typeof item === "object") {
      const row = item as Record<string, unknown>
      const name = [row.path, row.name, row.displayName].find((part) => typeof part === "string" && part.trim())
      if (typeof name === "string") labels.push(name.trim())
    }
  }
  return labels
}

/** Nota vem como texto ("4.8"). A trilha é o nome, se existir, ou os productCatIds. */
export function mapOfferNode(node: Record<string, unknown>): FeedFacts {
  const rating = asDecimal(node.ratingStar)
  const sold = asDecimal(node.sales)
  const named = labelsFrom(node.categoryName)
  const path = labelsFrom(node.categoryPath)
  const category = cleanCategoryTrail(named.length > 0 ? named : path.length > 0 ? path : labelsFrom(node.productCatIds))
  const title = typeof node.productName === "string" ? node.productName : ""
  const image = typeof node.imageUrl === "string" ? node.imageUrl : ""
  const shopId = node.shopId == null ? "" : String(node.shopId)
  return {
    ...(title ? { title } : {}),
    ...(category.length ? { category } : {}),
    ...(rating != null ? { rating } : {}),
    ...(sold != null ? { sold } : {}),
    ...(image ? { images: [image] } : {}),
    ...(shopId ? { shopId } : {}),
  }
}

const OFFER_FIELDS = ["itemId", "shopId", "productName", "sales", "ratingStar", "imageUrl", "productCatIds", "categoryName", "categoryPath"]

function unknownField(errors: unknown): string | null {
  const match = /Cannot query field "([^"]+)"/i.exec(errorText(errors))
  return match?.[1] ?? null
}

export async function readOfferProduct(itemId: string): Promise<{ data: FeedFacts | null; error?: string }> {
  if (!credentials()) return { data: null }
  let fields = [...OFFER_FIELDS]
  try {
    let json: {
      data?: { productOfferV2?: { nodes?: Array<Record<string, unknown>> } }
      errors?: unknown
    } | null = null
    for (let attempt = 0; attempt < 6; attempt += 1) {
      json = (await signedQuery(
        JSON.stringify({
          query: `{ productOfferV2(itemId: ${Number(itemId)}, limit: 1) { nodes { ${fields.join(" ")} } } }`,
        }),
      )) as typeof json
      if (!json?.errors) break
      const field = unknownField(json.errors)
      if (!field || !fields.includes(field) || field === "ratingStar" || field === "productCatIds") {
        const message = errorText(json.errors)
        console.error("[shopee] productOfferV2", message)
        return { data: null, error: message }
      }
      fields = fields.filter((item) => item !== field)
    }
    const node = json?.data?.productOfferV2?.nodes?.[0]
    if (!node) return { data: null }
    console.log("[shopee] productOfferV2 node", JSON.stringify(node))
    return { data: mapOfferNode(node) }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Open API indisponível"
    console.error("[shopee] productOfferV2", message)
    return { data: null, error: message }
  }
}
