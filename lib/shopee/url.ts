export type ShopeeIds = {
  shopId: string
  itemId: string
}

const PRODUCT_PATH = /\/product\/(\d+)\/(\d+)/
const ITEM_PATH = /(?:^|[^\d])i\.(\d+)\.(\d+)(?:[^\d]|$)/

export function canonicalShopeeUrl(ids: ShopeeIds): string {
  return `https://shopee.com.br/product/${ids.shopId}/${ids.itemId}`
}

export function isShopeeHost(hostname: string): boolean {
  const host = hostname.replace(/\.$/, "").toLowerCase()
  return host === "shopee.com.br" || host.endsWith(".shopee.com.br") || host === "shp.ee" || host.endsWith(".shp.ee")
}

/** Link curto ainda sem shopId/itemId. O servidor segue o redirect e parseia de novo. */
export function isOpaqueShopeeShort(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return false
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false
  const host = url.hostname.replace(/\.$/, "").toLowerCase()
  if (host !== "s.shopee.com.br" && host !== "shp.ee" && host !== "br.shp.ee") return false
  return parseShopeeUrl(raw, { allowOpaque: true }) == null
}

/**
 * Lê shopId e itemId de um link de produto.
 * Formas: `...-i.<shop>.<item>`, `/product/<shop>/<item>` e o mesmo caminho em `s.shopee.com.br`.
 */
export function parseShopeeUrl(raw: string, options?: { allowOpaque?: boolean }): ShopeeIds | null {
  const text = String(raw ?? "").trim()
  if (!text) {
    if (options?.allowOpaque) return null
    throw new Error("Esse link não é um produto da Shopee.")
  }
  let url: URL
  try {
    url = new URL(text)
  } catch {
    if (options?.allowOpaque) return null
    throw new Error("Esse link não é um produto da Shopee.")
  }
  if (!isShopeeHost(url.hostname)) {
    if (options?.allowOpaque) return null
    throw new Error("Esse link não é um produto da Shopee.")
  }
  const path = `${url.pathname}${url.search}`
  const product = path.match(PRODUCT_PATH)
  if (product?.[1] && product[2]) return { shopId: product[1], itemId: product[2] }
  const item = path.match(ITEM_PATH)
  if (item?.[1] && item[2]) return { shopId: item[1], itemId: item[2] }
  const shopId = url.searchParams.get("shopId") || url.searchParams.get("shopid")
  const itemId = url.searchParams.get("itemId") || url.searchParams.get("itemid")
  if (shopId && itemId && /^\d+$/.test(shopId) && /^\d+$/.test(itemId)) {
    return { shopId, itemId }
  }
  if (options?.allowOpaque) return null
  throw new Error("Esse link não é um produto da Shopee.")
}

export function parseShopeeUrlStrict(raw: string): ShopeeIds {
  const ids = parseShopeeUrl(raw)
  if (!ids) throw new Error("Esse link não é um produto da Shopee.")
  return ids
}
