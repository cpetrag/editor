import { getJob } from "@/lib/import/store"

export const runtime = "nodejs"

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params
  const job = getJob(id)
  if (!job) {
    return Response.json({ error: "job inexistente" }, { status: 404 })
  }
  return Response.json(job)
}
