import assert from "node:assert/strict"
import test from "node:test"

import { getPresetStyle } from "../style/presets.ts"
import { brandKitOf, resolveColor } from "./kits.ts"
import { resolveStyleColors } from "./resolve-style-colors.ts"

test("slot muda com o kit e hex fica parado", () => {
  const shopee = resolveStyleColors(getPresetStyle("sticker"), brandKitOf("shopee"))
  const beleza = resolveStyleColors(getPresetStyle("sticker"), brandKitOf("beleza"))
  assert.equal(shopee.text.accent, "#EE4D2D")
  assert.equal(beleza.text.accent, "#E0569B")
  assert.equal(shopee.text.color, "#111111")
  const vazado = resolveStyleColors(getPresetStyle("vazado"), brandKitOf("shopee"))
  const vazadoBeleza = resolveStyleColors(getPresetStyle("vazado"), brandKitOf("beleza"))
  assert.equal(vazado.text.stroke.color, "#FFFFFF")
  assert.equal(vazadoBeleza.text.stroke.color, "#FFFFFF")
  assert.equal(resolveColor("#FFD400", brandKitOf("bebe")), "#FFD400")
})

test("editorial e bolha resolvem a fonte do anexo", () => {
  assert.equal(getPresetStyle("editorial").text.fontFamily, "playfair")
  assert.equal(getPresetStyle("editorial").text.italic, true)
  assert.equal(getPresetStyle("bolha").text.fontFamily, "fredoka")
  assert.equal(getPresetStyle("preco-gigante").text.priceLayout, true)
  assert.equal(getPresetStyle("vidro").text.glass, true)
})
