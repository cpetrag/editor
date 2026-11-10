import assert from "node:assert/strict"
import test from "node:test"

import { clampComposition, createDefaultComposition, parseComposition, serializeComposition } from "../composition.ts"
import { buildReadyInsert, priceGapCount, galleryRecipes } from "../content/gallery.ts"
import { emptyVariableWarnings } from "../content/empty-vars.ts"
import { createInsert } from "../inserts.ts"
import { acceptShortName, clipPhrase, fallbackShortName, presetUsesPrice } from "./format.ts"
import { nicheForCategory, unknownCategoryId } from "./category-niche.ts"
import { workerHttpError } from "./reviews-client.ts"
import { applyImportedProduct } from "./apply.ts"
import { parsePastedReviews, stripBuyerMarks } from "./paste.ts"
import { insertPaintRect, rectsIntersect } from "../paint/bounds.ts"
import { fitMarkedLayout, PAINT_MAX_WIDTH_PCT, spacedMeasure } from "../paint/layout.ts"
import { getPresetStyle } from "../style/presets.ts"
import { placeProofInserts } from "./place.ts"
import { buildProofInserts, sizeLine } from "./proof.ts"
import { shapeQuoteInsert } from "./quote-fit.ts"
import { mapOfferNode } from "./affiliate.ts"
import { describeFetchError } from "./reviews-client.ts"
import { formatSourceLine, openApiSource } from "./sources.ts"
import { pickReviews } from "./reviews.ts"
import { parseShopeeUrl } from "./url.ts"

test("parseShopeeUrl lê as três formas de link", () => {
  const expected = { shopId: "12345", itemId: "67890" }
  assert.deepEqual(parseShopeeUrl("https://shopee.com.br/Short-de-trico-i.12345.67890"), expected)
  assert.deepEqual(parseShopeeUrl("https://shopee.com.br/product/12345/67890?utm=1"), expected)
  assert.deepEqual(parseShopeeUrl("https://s.shopee.com.br/product/12345/67890"), expected)
})

test("parseShopeeUrl recusa link inválido", () => {
  assert.throws(() => parseShopeeUrl("https://example.com/product/1/2"), /produto da Shopee/)
  assert.throws(() => parseShopeeUrl("https://shopee.com.br/search?keyword=short"), /produto da Shopee/)
})

test("pickReviews filtra estrelas e tamanho, prioriza mídia e não devolve nome", () => {
  const picked = pickReviews([
    { id: "a", stars: 5, text: "tecido macio e não transparente", date: "2026-01-01", user: "Maria", media: [] },
    { id: "b", stars: 3, text: "não gostei do caimento da peça", date: "2026-08-01", media: [] },
    { id: "c", stars: 5, text: "curto", date: "2026-08-02", media: [{ type: "image", url: "https://cf.shopee.com.br/file/abc" }] },
    {
      id: "d",
      stars: 4,
      text: "chegou rápido e o tamanho 36 vestiu bem",
      date: "2026-09-01",
      author_username: "joao",
      media: [{ type: "image", url: "https://cf.shopee.com.br/file/def" }],
    },
  ])
  assert.deepEqual(picked.map((review) => review.id), ["d", "a"])
  const dumped = JSON.stringify(picked)
  assert.equal(dumped.includes("Maria"), false)
  assert.equal(dumped.includes("joao"), false)
  assert.equal("user" in picked[0], false)
})

test("buildProofInserts só com vendidos cria um card", () => {
  const cards = buildProofInserts({
    rating: null,
    sold: 130,
    variations: [],
    badges: {},
    reviews: [],
    fetchedAt: "2026-11-09T00:00:00.000Z",
  })
  assert.equal(cards.length, 1)
  assert.equal(cards[0]?.text, "+130 vendidos")
})

const BAG_TITLE = "Bolsa transversal / bolsa de mão / bolsa diária feminina de couro PU CHEXIAOHONG"

const PASTED = `Adorei demais essa bolsa @fulana, chegou certinha.

O tecido é macio e o zíper fecha bem.

A cor é igual à foto e o tamanho serviu bem.`

test("colar três blocos vira três avaliações sem @", () => {
  const reviews = parsePastedReviews(PASTED, { stars: [5, null, 4], pastedAt: "2026-11-10T00:00:00.000Z" })
  assert.equal(reviews.length, 3)
  assert.equal(reviews.every((review) => review.source?.kind === "manual"), true)
  assert.equal(JSON.stringify(reviews).includes("@fulana"), false)
  assert.equal(reviews.some((review) => review.stars == null), true)
})

test("avaliação colada sem estrelas entra no montar prova", () => {
  const [review] = parsePastedReviews("Adorei demais essa bolsa, chegou certinha hoje.", {
    stars: [null],
    pastedAt: "2026-11-10T00:00:00.000Z",
  })
  assert.ok(review)
  const cards = buildProofInserts({
    rating: null,
    sold: null,
    variations: [],
    badges: {},
    reviews: [review],
    fetchedAt: "2026-11-10T00:00:00.000Z",
  })
  const quote = cards.find((card) => card.field === "quote")
  assert.equal(quote?.text.includes("⭐"), false)
  const placed = placeProofInserts(cards, [], 20, null, "2026-11-10T00:00:00.000Z")
  assert.equal(placed.length, 1)
  assert.equal(placed[0]?.source?.pasted, true)
  const current = createDefaultComposition()
  current.shopee = {
    itemId: "1",
    shopId: "1",
    url: "",
    fetchedAt: "2026-11-10T00:00:00.000Z",
    title: "Bolsa",
    shortName: "Bolsa",
    category: [],
    rating: null,
    ratingCount: null,
    sold: null,
    variations: [],
    badges: {},
    images: [],
    reviews: [review],
  }
  const refreshed = applyImportedProduct(current, { ...current.shopee, reviews: [] })
  assert.equal(refreshed.shopee?.reviews.length, 1)
  assert.equal(refreshed.shopee?.reviews[0]?.source?.kind, "manual")
})

test("nome curto da bolsa não vira couro sem PU", () => {
  assert.equal(acceptShortName(BAG_TITLE, "Bolsa de couro"), fallbackShortName(BAG_TITLE))
  assert.equal(acceptShortName(BAG_TITLE, "Bolsa Couro PU"), "Bolsa Couro PU")
  assert.equal(acceptShortName(BAG_TITLE, "Bolsa feminina"), "Bolsa feminina")
})

test("id 0 sai da trilha e o 1º nível conhecido vira nicho", () => {
  assert.equal(nicheForCategory(["0", "100016"])?.niche, "moda")
  assert.equal(nicheForCategory(["Women Bags"])?.name, "Women Bags")
  assert.equal(nicheForCategory(["999001"]), null)
  assert.equal(unknownCategoryId(["0", "999001"]), "999001")
})

test("erro HTTP do worker não se confunde com a porta recusada", () => {
  assert.equal(workerHttpError(500, "fetch failed", "http://127.0.0.1:3019/reviews"), "worker: 500 fetch failed")
  assert.equal(workerHttpError(422, "fetch failed", "https://reviews.macmini-capture.cc/api/reviews"), "fetch failed")
})

test("node da Open API converte ratingStar texto e productCatIds", () => {
  const mapped = mapOfferNode({
    ratingStar: "4.8",
    sales: "130",
    productCatIds: [100630, 100644],
  })
  assert.equal(mapped.rating, 4.8)
  assert.equal(mapped.sold, 130)
  assert.deepEqual(mapped.category, ["100630", "100644"])
})

test("erro de conexão das avaliações guarda o código", () => {
  const error = new TypeError("fetch failed")
  error.cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:3019"), { code: "ECONNREFUSED" })
  const reviewsError = describeFetchError(error, "http://127.0.0.1:3019/reviews")
  assert.match(reviewsError, /ECONNREFUSED/)
  assert.match(reviewsError, /3019/)
})

test("openapi sem credenciais fica not_configured", () => {
  assert.equal(openApiSource({ configured: false }).openapi, "not_configured")
  assert.equal(formatSourceLine({
    feed: "ok",
    openapi: "not_configured",
    reviews: "error",
    reviewsError: "fetch failed",
  }), "Feed ✓ · API sem credenciais · Avaliações ✗ (fetch failed)")
})

test("buildProofInserts omite a nota sem rating e monta a faixa de tamanho", () => {
  const withoutRating = buildProofInserts({
    rating: null,
    sold: 12000,
    variations: [],
    badges: {},
    reviews: [],
    fetchedAt: "2026-11-09T00:00:00.000Z",
  })
  assert.equal(withoutRating.some((card) => card.field === "rating"), false)
  assert.equal(sizeLine(["36", "38", "40", "42", "44", "46", "48"]), "Do 36 ao 48")
  const withSizes = buildProofInserts({
    rating: 4.9,
    sold: 12000,
    variations: [{ name: "Tamanho", options: ["36", "38", "40", "42", "44", "46", "48"] }],
    badges: {},
    reviews: [],
    fetchedAt: "2026-11-09T00:00:00.000Z",
  })
  assert.equal(withSizes.find((card) => card.field === "sizes")?.text, "Do 36 ao 48")
  assert.match(withSizes.find((card) => card.field === "rating")?.text ?? "", /4,9/)
  assert.match(withSizes.find((card) => card.field === "rating")?.text ?? "", /\+12 mil vendidos/)
})

test("pricing off esconde prontos com token de preço e não avisa preço", () => {
  const hidden = galleryRecipes({ niche: "shopee", slot: "todos", query: "preço", productData: {}, pricing: "off" })
  assert.equal(hidden.some((preset) => presetUsesPrice(preset.text)), false)
  const visible = galleryRecipes({ niche: "shopee", slot: "todos", query: "", productData: {}, pricing: "off" })
  assert.equal(priceGapCount(visible, {}, "off"), 0)
  const priced = createInsert("texto-livre")
  priced.text = "Só {preco}"
  assert.equal(emptyVariableWarnings([priced], {}, "off").length, 0)
  assert.equal(emptyVariableWarnings([priced], {}, "on").length, 1)
})

test("migração v7 para v8 preserva source.transform e liga pricing off", () => {
  const current = createDefaultComposition()
  current.source.transform = { scale: 1.5, x: -8, y: 4, space: "offset" }
  current.productData = { produto: "short de tricô" }
  const stored = JSON.parse(serializeComposition(current)) as { version: number; pricing?: string }
  stored.version = 7
  delete stored.pricing
  const parsed = parseComposition(stored)
  assert.equal(parsed.version, 8)
  assert.equal(parsed.pricing, "off")
  assert.equal(parsed.productData?.produto, "short de tricô")
  assert.equal(parsed.source.transform?.scale, 1.5)
  assert.equal(parsed.source.transform?.x, -8)
  assert.equal(parsed.source.transform?.y, 4)
})

test("assinatura sai e a frase curta para na vírgula", () => {
  assert.equal(
    stripBuyerMarks("Maria S. - chegou super rapido e a bolsa e muito linda, cabe tudo..."),
    "chegou super rapido e a bolsa e muito linda, cabe tudo...",
  )
  assert.equal(stripBuyerMarks("Ana: chegou hoje cedo demais"), "chegou hoje cedo demais")
  assert.equal(stripBuyerMarks("— João chegou hoje cedo demais"), "chegou hoje cedo demais")
  assert.equal(stripBuyerMarks("chegou hoje cedo demais Maria Silva –"), "chegou hoje cedo demais")
  const [review] = parsePastedReviews(
    "Maria S. - chegou super rapido e a bolsa e muito linda, cabe tudo...",
    { stars: [5], pastedAt: "2026-11-10T00:00:00.000Z" },
  )
  assert.equal(review?.phrase, "Chegou super rapido e a bolsa e muito linda")
  assert.equal(
    clipPhrase("chegou super rapido e a bolsa e muito linda, cabe tudo..."),
    "Chegou super rapido e a bolsa e muito linda",
  )
})

test("montar prova segue em sequência e espera o gancho da mesma faixa", () => {
  const fetchedAt = "2026-11-10T00:00:00.000Z"
  const cards = buildProofInserts({
    rating: 4.9,
    sold: 130,
    variations: [],
    badges: {},
    reviews: [{ id: "r1", stars: 5, text: "Adorei a bolsa", phrase: "Adorei a bolsa", date: fetchedAt, media: [] }],
    fetchedAt,
  })
  const cuts = { ganchoEnd: 2, ctaStart: 11.9 }
  const clear = placeProofInserts(cards, [], 20, cuts, fetchedAt)
  assert.equal(clear[0]?.start, 2)
  assert.equal(clear[0]?.duration, 2.5)
  assert.equal(clear[1]?.start, 4.6)
  assert.equal(clear[1]?.duration, 3.4)
  assert.ok((clear[1]?.maxWidthPct ?? 100) <= 86)

  const hook = createInsert("texto-livre")
  hook.start = 0
  hook.duration = 3
  hook.y = 22
  hook.role = "gancho"
  const shifted = placeProofInserts(cards, [hook], 20, cuts, fetchedAt)
  assert.ok((shifted[0]?.start ?? 0) >= 3)
  assert.ok((shifted[1]?.start ?? 0) >= (shifted[0]?.start ?? 0) + (shifted[0]?.duration ?? 0))
  assert.ok((shifted[1]?.start ?? 0) + (shifted[1]?.duration ?? 0) <= 11.9)
})

test("citação encolhe a fonte e fica na área segura", () => {
  const quote = createInsert("texto-livre")
  quote.fontSize = 56
  quote.y = 4
  quote.text = "linha ".repeat(80)
  const shaped = shapeQuoteInsert(quote)
  assert.ok((shaped.maxWidthPct ?? 100) <= 86)
  assert.ok(shaped.fontSize < 56)
  assert.ok(shaped.fontSize >= 40)
  assert.ok(shaped.y >= 12)
  assert.ok(shaped.text.length < quote.text.length)
})

test("balão, selo, pílula e sticker quebram em até 86% e 3 linhas", () => {
  const phrase = "chegou super rapido e a bolsa e muito linda"
  const limit = (PAINT_MAX_WIDTH_PCT / 100) * 1080
  for (const id of ["balao", "selo", "pilula-marca", "sticker"]) {
    const style = getPresetStyle(id)
    const pct = Math.min(PAINT_MAX_WIDTH_PCT, style.text.maxWidth)
    const fitted = fitMarkedLayout({
      text: id === "balao" ? `“${phrase}”\ncliente Shopee` : phrase,
      style,
      maxWidth: (pct / 100) * 1080,
      measure: spacedMeasure,
      editPreview: true,
    })
    assert.ok(fitted.layout.lines.length <= 3, id)
    assert.ok(fitted.style.text.fontSize >= 40, id)
    assert.ok(
      fitted.layout.lines.every((line) => line.width <= limit + 0.5),
      `${id} ${fitted.layout.lines.map((line) => line.width).join(",")}`,
    )
  }
})

test("selo não cruza o gancho POV que está na mesma hora", () => {
  const fetchedAt = "2026-11-10T00:00:00.000Z"
  const hook = buildReadyInsert(
    { text: "POV", styleId: "sticker", packId: "estouro", y: 22, role: "gancho" },
    0,
    20,
  )
  hook.start = 0
  hook.duration = 3
  const cards = buildProofInserts({
    rating: 4.8,
    sold: 130,
    variations: [],
    badges: {},
    reviews: [{ id: "r1", stars: 5, text: "Adorei a bolsa", phrase: "Adorei a bolsa", date: fetchedAt, media: [] }],
    fetchedAt,
  })
  const placed = placeProofInserts(cards, [hook], 20, { ganchoEnd: 2, ctaStart: 11.9 }, fetchedAt)
  const selo = placed.find((insert) => insert.source?.field === "rating")
  assert.ok((selo?.start ?? 0) >= 3)
  const visible = [hook, ...placed]
  for (let i = 0; i < visible.length; i += 1) {
    for (let j = i + 1; j < visible.length; j += 1) {
      const a = visible[i]
      const b = visible[j]
      if (!a || !b) continue
      const together = a.start < b.start + b.duration - 1e-3 && b.start < a.start + a.duration - 1e-3
      if (!together) continue
      const ra = insertPaintRect(a)
      const rb = insertPaintRect(b)
      assert.equal(Boolean(ra && rb && rectsIntersect(ra, rb)), false)
    }
  }
})

test("insert que passa da Saída termina na Saída", () => {
  const composition = createDefaultComposition()
  composition.source.duration = 20
  composition.source.trim = { start: 0, end: 14.2 }
  const insert = createInsert("texto-livre")
  insert.start = 11.8
  insert.duration = 3
  composition.inserts = [insert]
  const clamped = clampComposition(composition)
  const placed = clamped.inserts[0]
  assert.ok(placed)
  assert.equal(Math.round((placed.start + placed.duration) * 10) / 10, 14.2)
})
