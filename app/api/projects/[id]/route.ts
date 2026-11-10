import { readEditorProject } from "@/lib/projects/store"

export const runtime = "nodejs"

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params
  const project = readEditorProject(id)
  if (!project) return Response.json({ error: "projeto inexistente" }, { status: 404 })
  return Response.json(project)
}
