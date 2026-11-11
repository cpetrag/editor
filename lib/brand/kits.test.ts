import assert from "node:assert/strict"
import test from "node:test"

import { getPresetStyle } from "../style/presets.ts"
import { createInsert } from "../inserts.ts"
import {
  brandKitOf,
  colorsOf,
  mergeBrandColors,
  paintBrandKit,
  parseCustomBrandKit,
  resolveBrandKit,
  resolveColor,
  type CustomBrandKit,
} from "./kits.ts"
import { resolveStyleColors } from "./resolve-style-colors.ts"
import { insertWithSlotHex, slotsInStyle } from "./slot-colors.ts"

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

test("snapshot do projeto vence uma paleta personalizada editada depois", () => {
  const saved: CustomBrandKit = {
    id: "custom-11111111-1111-4111-8111-111111111111",
    label: "Natura verde",
    baseKitId: "contraste",
    ...colorsOf(brandKitOf("contraste")),
    primary: "#00C853",
  }
  const edited = { ...saved, primary: "#000000" }
  const painted = paintBrandKit({
    brandKitId: saved.id,
    brandColors: colorsOf(saved),
    customKits: [edited],
  })
  assert.equal(painted.primary, "#00C853")
  assert.equal(edited.primary, "#000000")
  assert.equal(brandKitOf("contraste").primary, "#FFE600")
  assert.equal(resolveBrandKit(saved.id, []).id, "shopee")
  assert.equal(parseCustomBrandKit(saved)?.label, "Natura verde")
})

test("override do insert não altera a paleta do projeto", () => {
  const project = colorsOf(brandKitOf("shopee"))
  const painted = paintBrandKit({
    brandKitId: "shopee",
    brandColors: project,
    paletteOverride: { primary: "#00C853" },
  })
  assert.equal(painted.primary, "#00C853")
  assert.equal(painted.accent, project.accent)
  assert.equal(project.primary, "#EE4D2D")
  const resolved = resolveStyleColors(getPresetStyle("sticker"), painted)
  assert.equal(resolved.text.accent, "#00C853")
})

test("cor pontual da sombra longa grava hex no override e não mexe no kit", () => {
  const style = getPresetStyle("sombra-longa")
  assert.ok(slotsInStyle(style).includes("primary"))
  const insert = createInsert("texto-livre")
  insert.styleRef = { presetId: "sombra-longa", overrides: {} }
  const next = insertWithSlotHex(insert, "primary", "#00C853")
  assert.equal(next.styleRef?.overrides.text?.longShadow?.color, "#00C853")
  assert.equal(brandKitOf("contraste").primary, "#FFE600")
  const kit = colorsOf(brandKitOf("contraste"))
  assert.equal(mergeBrandColors(kit, { primary: "#00C853" }).primary, "#00C853")
  assert.equal(kit.primary, "#FFE600")
})

test("editorial e bolha resolvem a fonte do anexo", () => {
  assert.equal(getPresetStyle("editorial").text.fontFamily, "playfair")
  assert.equal(getPresetStyle("editorial").text.italic, true)
  assert.equal(getPresetStyle("bolha").text.fontFamily, "fredoka")
  assert.equal(getPresetStyle("preco-gigante").text.priceLayout, true)
  assert.equal(getPresetStyle("vidro").text.glass, true)
})
