import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"

import {
  downloadShopeeVideo,
  extractMediaInfo,
  parseNextData,
  resolveShareVideoUrl,
  shopeeVideoProxy,
} from "./shopee-video.ts"

const fixtureHtml = `<!doctype html><html><body>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: {
    pageProps: {
      query: { postId: "pid123" },
      mediaInfo: {
        video: {
          caption: "Legenda Top #oferta",
          hashtagContent: ["oferta"],
          watermarkVideoUrl: "https://cdn.example/v.mp4",
          watermarkCoverUrl: "https://cdn.example/c.jpg",
          duration: 15000,
        },
        count: { likeCount: 10, commentCount: 2 },
        userInfo: { videoUserName: "loja_x" },
      },
    },
  },
})}</script></body></html>`

test("parseNextData + extractMediaInfo", () => {
  const data = parseNextData(fixtureHtml)
  const media = extractMediaInfo(data)
  assert.equal(media.videoUrl, "https://cdn.example/v.mp4")
  assert.equal(media.caption, "Legenda Top #oferta")
  assert.equal(media.author, "loja_x")
  assert.equal(media.likes, 10)
  assert.equal(media.postId, "pid123")
  assert.equal(media.canonicalUrl, "https://sv.shopee.com.br/share-video/pid123")
  assert.deepEqual(media.hashtags, ["oferta"])
})

test("parseNextData sem script lança", () => {
  assert.throws(() => parseNextData("<html></html>"), /__NEXT_DATA__/)
})

test("resolveShareVideoUrl lê redir do universal-link", () => {
  const finalUrl =
    "https://shopee.com.br/universal-link?deep_and_web=1&redir=" +
    encodeURIComponent(
      "https://sv.shopee.com.br/share-video/22ZVEkBiCAB1sJoUAAAAAA==?c=share_web",
    )
  const got = resolveShareVideoUrl({ finalUrl, html: "<html></html>" })
  assert.equal(
    got,
    "https://sv.shopee.com.br/share-video/22ZVEkBiCAB1sJoUAAAAAA==?c=share_web",
  )
})

test("resolveShareVideoUrl lê CONFIG.httpUrl do HTML", () => {
  const html = `var CONFIG={httpUrl:"https:\\/\\/sv.shopee.com.br\\/share-video\\/abc==?c=share_web\\u0026pid=sv",deepLinkUrl:"x"};`
  const got = resolveShareVideoUrl({
    finalUrl: "https://shopee.com.br/universal-link",
    html,
  })
  assert.equal(got, "https://sv.shopee.com.br/share-video/abc==?c=share_web&pid=sv")
})

test("downloadShopeeVideo resolve universal-link e baixa mp4", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sv-uls-"))
  const dest = path.join(dir, "out.mp4")
  const bytes = Buffer.from("fake-mp4")
  const ulsHtml = `var CONFIG={httpUrl:"https:\\/\\/sv.shopee.com.br\\/share-video\\/pid123",deepLinkUrl:"x"};`
  const shareFinal =
    "https://shopee.com.br/universal-link?redir=" +
    encodeURIComponent("https://sv.shopee.com.br/share-video/pid123")
  const fetchImpl: typeof fetch = async (url) => {
    const href = String(url)
    if (href.includes("shp.ee")) {
      return {
        ok: true,
        status: 200,
        url: shareFinal,
        text: async () => ulsHtml,
        arrayBuffer: async () => new ArrayBuffer(0),
      } as Response
    }
    if (href.includes("share-video")) {
      return {
        ok: true,
        status: 200,
        url: href,
        text: async () => fixtureHtml,
        arrayBuffer: async () => new ArrayBuffer(0),
      } as Response
    }
    return {
      ok: true,
      status: 200,
      text: async () => "",
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    } as Response
  }
  const meta = await downloadShopeeVideo({
    shareUrl: "https://br.shp.ee/x",
    destMp4: dest,
    fetchImpl,
  })
  assert.equal(fs.readFileSync(dest).toString(), "fake-mp4")
  assert.equal(meta.postId, "pid123")
})

test("downloadShopeeVideo grava mp4 via fetchImpl", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sv-"))
  const dest = path.join(dir, "out.mp4")
  const bytes = Buffer.from("fake-mp4")
  const fetchImpl: typeof fetch = async (url) => {
    if (String(url).includes("shp.ee") || String(url).includes("share")) {
      return {
        ok: true,
        status: 200,
        text: async () => fixtureHtml,
        arrayBuffer: async () => new ArrayBuffer(0),
      } as Response
    }
    return {
      ok: true,
      status: 200,
      text: async () => "",
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    } as Response
  }
  const meta = await downloadShopeeVideo({
    shareUrl: "https://br.shp.ee/x",
    destMp4: dest,
    fetchImpl,
  })
  assert.equal(fs.readFileSync(dest).toString(), "fake-mp4")
  assert.equal(meta.watermarked, true)
  assert.equal(meta.title, "Legenda Top #oferta")
  assert.equal(meta.videoUrl, "https://cdn.example/v.mp4")
})

test("shopeeVideoProxy default vazio", () => {
  const prev = process.env.SHOPEE_VIDEO_PROXY
  delete process.env.SHOPEE_VIDEO_PROXY
  assert.equal(shopeeVideoProxy(), "")
  process.env.SHOPEE_VIDEO_PROXY = "socks5://127.0.0.1:8080"
  assert.equal(shopeeVideoProxy(), "socks5://127.0.0.1:8080")
  if (prev === undefined) delete process.env.SHOPEE_VIDEO_PROXY
  else process.env.SHOPEE_VIDEO_PROXY = prev
})
