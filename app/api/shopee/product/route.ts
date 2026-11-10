import { loadShopeeProduct } from "@/lib/shopee/load"

export const runtime = "nodejs"
export const maxDuration = 180

export async function POST(req: Request): Promise<Response> {
  let body: { url?: unknown; refresh?: unknown }
  try {
    body = (await req.json()) as { url?: unknown; refresh?: unknown }
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }
  const url = typeof body.url === "string" ? body.url.trim() : ""
  if (!url) return Response.json({ error: "Cole o link do produto." }, { status: 400 })
  try {
    const product = await loadShopeeProduct(url, body.refresh === true)
    return Response.json(product)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível importar o produto."
    console.error("[shopee] product", message)
    const status = /produto da Shopee/.test(message) ? 400 : 422
    return Response.json({ error: message }, { status })
  }
}
