import { proxyRenderRequest } from "@/lib/export/render-proxy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0
export const maxDuration = 600

export async function GET(request: Request): Promise<Response> {
  return proxyRenderRequest("/api/render", request)
}

export async function POST(request: Request): Promise<Response> {
  return proxyRenderRequest("/api/render", request)
}
