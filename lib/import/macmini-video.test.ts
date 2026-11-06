import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"

import { downloadMacminiVideo, macminiCatalogVideo } from "./macmini-video.ts"

const VIDEO = "https://shopeevideos.macmini-capture.cc/media/gdjj0g5l/video.mp4"

function response({
  status = 200,
  body = "",
  json,
  headers = {},
  location,
}: {
  status?: number
  body?: string
  json?: unknown
  headers?: Record<string, string>
  location?: string
}): Response {
  const head = new Headers(headers)
  if (location) head.set("location", location)
  const payload = json !== undefined ? JSON.stringify(json) : body
  const bytes = Buffer.from(payload)
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: head,
    json: async () => (json !== undefined ? json : JSON.parse(payload)),
    text: async () => payload,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as Response
}

test("macminiCatalogVideo normaliza o id e recusa path fora do mp4", () => {
  assert.equal(
    macminiCatalogVideo(
      "https://shopeevideos.macmini-capture.cc/media/GDJJ0G5L/video.mp4?download=1",
    )?.href,
    VIDEO,
  )
  assert.equal(macminiCatalogVideo("https://shopeevideos.macmini-capture.cc/"), null)
  assert.equal(macminiCatalogVideo("https://shopeevideos.macmini-capture.cc/media/../data.json"), null)
  assert.equal(
    macminiCatalogVideo("https://evil.example/media/gdjj0g5l/video.mp4"),
    null,
  )
})

test("downloadMacminiVideo grava o mp4 e usa o nome do produto", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mm-"))
  const dest = path.join(dir, "out.mp4")
  const fetchImpl: typeof fetch = async (url) => {
    const href = String(url)
    if (href.endsWith("/data.json")) {
      return response({
        json: {
          items: [
            {
              code: "gdjj0g5l",
              product_name: "Rasteirinha Gaby Show",
              likes: 12,
              comments: 3,
              link: "https://br.shp.ee/gdjj0g5l",
              thumb: "gdjj0g5l/thumb.jpg",
            },
          ],
        },
        headers: { "content-type": "application/json" },
      })
    }
    return response({
      body: "fake-mp4",
      headers: { "content-type": "video/mp4", "content-length": "8" },
    })
  }
  const meta = await downloadMacminiVideo({ pageUrl: VIDEO, destMp4: dest, fetchImpl })
  assert.equal(fs.readFileSync(dest).toString(), "fake-mp4")
  assert.equal(meta.title, "Rasteirinha Gaby Show")
  assert.equal(meta.code, "gdjj0g5l")
  assert.equal(meta.likes, 12)
  assert.equal(meta.comments, 3)
  assert.equal(meta.canonicalUrl, "https://br.shp.ee/gdjj0g5l")
  assert.equal(
    meta.coverUrl,
    "https://shopeevideos.macmini-capture.cc/media/gdjj0g5l/thumb.jpg",
  )
})

test("downloadMacminiVideo recusa redirect para outro host", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mm-"))
  const dest = path.join(dir, "out.mp4")
  const seen: string[] = []
  const fetchImpl: typeof fetch = async (url) => {
    seen.push(String(url))
    return response({ status: 302, location: "https://evil.example/video.mp4" })
  }
  await assert.rejects(
    () => downloadMacminiVideo({ pageUrl: VIDEO, destMp4: dest, fetchImpl }),
    /redirect fora do catálogo/,
  )
  assert.deepEqual(seen, [VIDEO])
  assert.equal(fs.existsSync(dest), false)
})

test("downloadMacminiVideo pede download=1 se a primeira resposta for html", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mm-"))
  const dest = path.join(dir, "out.mp4")
  const fetchImpl: typeof fetch = async (url) => {
    const href = String(url)
    if (href.endsWith("/data.json")) return response({ status: 500, body: "nope" })
    if (href.includes("download=1")) {
      return response({ body: "real-mp4", headers: { "content-type": "video/mp4" } })
    }
    return response({
      body: "<html>player</html>",
      headers: { "content-type": "text/html" },
    })
  }
  const meta = await downloadMacminiVideo({ pageUrl: VIDEO, destMp4: dest, fetchImpl })
  assert.equal(fs.readFileSync(dest).toString(), "real-mp4")
  assert.equal(meta.title, "gdjj0g5l")
  assert.equal(meta.canonicalUrl, null)
})

test("downloadMacminiVideo recusa arquivo acima de 200 MB", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mm-"))
  const dest = path.join(dir, "out.mp4")
  const fetchImpl: typeof fetch = async () =>
    response({
      body: "x",
      headers: { "content-type": "video/mp4", "content-length": String(201 * 1024 * 1024) },
    })
  await assert.rejects(
    () => downloadMacminiVideo({ pageUrl: VIDEO, destMp4: dest, fetchImpl }),
    /grande demais/,
  )
  assert.equal(fs.existsSync(dest), false)
})
