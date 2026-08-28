export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  return Response.json(
    {
      version: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
      buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || null,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
