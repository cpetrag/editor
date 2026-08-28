import { proxyRenderRequest } from "@/lib/export/render-proxy"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(request: Request): Promise<Response> {
  return proxyRenderRequest("/api/render/cancel", request)
}
