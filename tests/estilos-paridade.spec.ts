import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { expect, test } from "@playwright/test"
import pixelmatch from "pixelmatch"
import { PNG } from "pngjs"

const PRESETS = [
  "sticker", "vazado", "sombra-longa", "duplo", "por-do-sol", "cromado", "editorial",
  "script-caps", "neon-rosa", "bolha", "pilula-marca", "grife", "contador-bold",
  "fita", "vidro", "marca-texto", "preco-gigante", "balao", "etiqueta", "selo", "bilhete", "tarja",
]

test("22 estilos Shopee ficam abaixo de 4% do protótipo", async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto("/dev/estilos")
  await page.locator("iframe").first().waitFor()
  const outDir = path.join("test-results", "estilos")
  mkdirSync(outDir, { recursive: true })
  const failures: string[] = []
  for (const id of PRESETS) {
    const row = page.locator(`[data-style-row="${id}"][data-kit="shopee"]`)
    const proto = row.locator("iframe")
    const canvas = row.locator("canvas")
    const protoPng = await proto.screenshot()
    const canvasPng = await canvas.screenshot()
    const left = PNG.sync.read(protoPng)
    const right = PNG.sync.read(canvasPng)
    const width = Math.min(left.width, right.width)
    const height = Math.min(left.height, right.height)
    const diff = new PNG({ width, height })
    const different = pixelmatch(left.data, right.data, diff.data, width, height, { threshold: 0.1 })
    const ratio = different / (width * height)
    writeFileSync(path.join(outDir, `${id}-proto.png`), PNG.sync.write(left))
    writeFileSync(path.join(outDir, `${id}-canvas.png`), PNG.sync.write(right))
    writeFileSync(path.join(outDir, `${id}-diff.png`), PNG.sync.write(diff))
    if (ratio > 0.04) failures.push(`${id} ${(ratio * 100).toFixed(1)}%`)
  }
  expect(failures, failures.join("\n")).toEqual([])
})
