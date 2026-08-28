export function getRenderServerBase(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.RENDER_URL?.trim() || "http://127.0.0.1:4014"
  return raw.replace(/\/$/, "")
}

export function mapRenderPath(method: string, editorPath: string): string {
  const path = editorPath.replace(/\/$/, "") || "/"
  if (method === "POST" && path === "/api/render") return "/render"
  if (method === "GET" && path === "/api/render") return "/health"
  if (method === "POST" && path === "/api/render/cancel") return "/cancel"
  const progress = /^\/api\/render\/progress\/([^/]+)$/.exec(path)
  if (method === "GET" && progress) return `/progress/${progress[1]}`
  const status = /^\/api\/render\/status\/([^/]+)$/.exec(path)
  if (method === "GET" && status) return `/status/${status[1]}`
  const download = /^\/api\/render\/download\/([^/]+)$/.exec(path)
  if (method === "GET" && download) return `/download/${download[1]}`
  throw new Error(`rota de render desconhecida: ${method} ${editorPath}`)
}

export function isOfflineFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const text = `${error.name} ${error.message}`
  return /fetch failed|ECONNREFUSED|ENOTFOUND|ECONNRESET|socket hang up|network/i.test(text)
}

export async function proxyRenderRequest(
  editorPath: string,
  request: Request,
  env: Record<string, string | undefined> = process.env,
): Promise<Response> {
  const target = `${getRenderServerBase(env)}${mapRenderPath(request.method, editorPath)}`
  const headers = new Headers()
  const contentType = request.headers.get("content-type")
  if (contentType) headers.set("content-type", contentType)

  try {
    const init: RequestInit = {
      method: request.method,
      headers,
      signal: request.signal,
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body
      ;(init as RequestInit & { duplex: "half" }).duplex = "half"
    }
    const upstream = await fetch(target, init)
    const outHeaders = new Headers()
    const pass = [
      "content-type",
      "content-length",
      "content-disposition",
      "cache-control",
      "x-capcut-saved",
      "x-capcut-file",
    ]
    for (const name of pass) {
      const value = upstream.headers.get(name)
      if (value) outHeaders.set(name, value)
    }
    const upstreamContentType = upstream.headers.get("content-type") ?? ""
    const isEventStream = upstreamContentType.includes("text/event-stream")
    const isJson =
      upstreamContentType.includes("application/json") ||
      upstreamContentType.includes("+json") ||
      (upstream.status !== 204 &&
        upstream.status < 300 &&
        request.method === "GET" &&
        editorPath.includes("/status/"))

    if (isEventStream) {
      outHeaders.set("Cache-Control", "no-cache")
      outHeaders.set("Connection", "keep-alive")
      outHeaders.set("X-Accel-Buffering", "no")
      return new Response(upstream.body, {
        status: upstream.status,
        headers: outHeaders,
      })
    }

    if (isJson) {
      const text = await upstream.text()
      outHeaders.set("Cache-Control", "no-store")
      outHeaders.set("Connection", "close")
      outHeaders.set("Content-Length", String(new TextEncoder().encode(text).length))
      if (!outHeaders.get("content-type")) {
        outHeaders.set("Content-Type", "application/json; charset=utf-8")
      }
      return new Response(text, {
        status: upstream.status,
        headers: outHeaders,
      })
    }

    outHeaders.set("Cache-Control", "no-store")
    outHeaders.set("Connection", "close")
    return new Response(upstream.body, {
      status: upstream.status,
      headers: outHeaders,
    })
  } catch (error) {
    if (isOfflineFetchError(error) || error instanceof TypeError) {
      return Response.json(
        { error: "servidor de render offline" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      )
    }
    throw error
  }
}
