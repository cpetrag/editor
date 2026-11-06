import { proxyRenderRequest } from "@/lib/export/render-proxy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const JOB_ID = /^[0-9a-f-]{36}$/i

export async function GET(
  request: Request,
  ctx: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const { jobId } = await ctx.params
  if (!JOB_ID.test(jobId)) {
    return Response.json({ error: "job inválido" }, { status: 400 })
  }
  return proxyRenderRequest(`/api/render/status/${jobId}`, request)
}
