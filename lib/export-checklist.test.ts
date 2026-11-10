import { test } from "node:test"
import assert from "node:assert/strict"

import {
  COMPOSITION_VERSION,
  DEFAULT_CAPTION_STYLE,
  DEFAULT_VIDEO_BITRATE,
  type Composition,
  type CompositionInsert,
} from "./composition.ts"
import { defaultCompositionAudio } from "./audio/types.ts"
import {
  collectExportWarnings,
  checklistItemsFromComposition,
  type ChecklistItem,
} from "./export-checklist.ts"

function box(left: number, top: number, right: number, bottom: number) {
  return { left, top, right, bottom }
}

function item(patch: Partial<ChecklistItem> & Pick<ChecklistItem, "id" | "kind">): ChecklistItem {
  return {
    start: 0,
    duration: 2,
    label: patch.id,
    hasText: patch.kind === "text" || patch.kind === "chip" || patch.kind === "caption",
    box: box(100, 800, 400, 900),
    fill: "#FFFFFF",
    background: "#111111",
    stroke: null,
    ...patch,
  }
}

function codes(items: ChecklistItem[]) {
  return collectExportWarnings(items).map((warning) => warning.code).sort()
}

test("chip curto avisa; legenda curta não", () => {
  assert.deepEqual(codes([item({ id: "c", kind: "chip", duration: 0.5, label: "50% OFF" })]), [
    "short",
  ])
  assert.deepEqual(codes([item({ id: "l", kind: "caption", duration: 0.4, label: "oferta" })]), [])
})

test("0,8 s exato não é curto", () => {
  assert.deepEqual(codes([item({ id: "c", kind: "chip", duration: 0.8 })]), [])
})

test("overlap só entre texto/chip/PNG; chip+legenda não", () => {
  const a = item({ id: "a", kind: "chip", start: 0, duration: 2, label: "50% OFF" })
  const b = item({
    id: "b",
    kind: "chip",
    start: 1,
    duration: 2,
    label: "Frete grátis",
    box: box(500, 800, 800, 900),
  })
  const caption = item({
    id: "cap",
    kind: "caption",
    start: 0,
    duration: 5,
    label: "sandália",
    box: box(200, 1400, 880, 1600),
  })
  const overlap = collectExportWarnings([a, b, caption])
  assert.equal(overlap.some((warning) => warning.code === "overlap"), true)
  assert.match(overlap.find((warning) => warning.code === "overlap")?.title ?? "", /50% OFF/)
  assert.equal(
    collectExportWarnings([a, caption]).some((warning) => warning.code === "overlap"),
    false,
  )
})

test("colisão insert×legenda avisa; duas legendas não", () => {
  const chip = item({
    id: "chip",
    kind: "chip",
    start: 0,
    duration: 2,
    label: "50% OFF",
    box: box(200, 1400, 500, 1550),
  })
  const capA = item({
    id: "ca",
    kind: "caption",
    start: 0,
    duration: 2,
    label: "oferta",
    box: box(180, 1380, 900, 1600),
  })
  const capB = item({
    id: "cb",
    kind: "caption",
    start: 0,
    duration: 2,
    label: "hoje",
    box: box(200, 1450, 800, 1620),
  })
  const hit = collectExportWarnings([chip, capA])
  assert.equal(hit.some((warning) => warning.code === "collision"), true)
  assert.match(hit.find((warning) => warning.code === "collision")?.title ?? "", /legenda/i)
  assert.equal(collectExportWarnings([capA, capB]).some((warning) => warning.code === "collision"), false)
})

test("safe area: chip embaixo avisa; legenda embaixo não; legenda no topo sim", () => {
  const chipBottom = item({
    id: "cta",
    kind: "chip",
    label: "CTA",
    box: box(400, 1800, 700, 1900),
  })
  const capBottom = item({
    id: "cap",
    kind: "caption",
    label: "fala",
    box: box(200, 1600, 880, 1850),
  })
  const capTop = item({
    id: "top",
    kind: "caption",
    label: "gancho",
    box: box(200, 0, 880, 200),
  })
  assert.equal(codes([chipBottom]).includes("safe-bottom"), true)
  assert.equal(codes([capBottom]).includes("safe-bottom"), false)
  assert.equal(codes([capTop]).includes("safe-top"), true)
})

test("contraste: sem fundo nem contorno; razão baixa; PNG silêncio", () => {
  const bare = item({
    id: "t",
    kind: "text",
    label: "Gancho",
    fill: "#FFFFFF",
    background: null,
    stroke: null,
  })
  const low = item({
    id: "low",
    kind: "chip",
    label: "50% OFF",
    fill: "#FFFF00",
    background: "#EEEE00",
    stroke: null,
  })
  const png = item({
    id: "png",
    kind: "sticker",
    hasText: false,
    fill: null,
    background: null,
    stroke: null,
  })
  assert.equal(codes([bare]).includes("contrast-bare"), true)
  assert.equal(codes([low]).includes("contrast-low"), true)
  assert.deepEqual(codes([png]), [])
})

test("aceitação: curto + overlap + colisão com legenda; export não entra na função", () => {
  const short = item({
    id: "s",
    kind: "chip",
    start: 0,
    duration: 0.5,
    label: "50% OFF",
    box: box(100, 800, 300, 880),
  })
  const other = item({
    id: "o",
    kind: "chip",
    start: 0,
    duration: 2,
    label: "Frete",
    box: box(400, 800, 700, 880),
  })
  const cap = item({
    id: "cap",
    kind: "caption",
    start: 0,
    duration: 2,
    label: "oferta",
    box: box(80, 760, 320, 900),
  })
  const found = new Set(codes([short, other, cap]))
  assert.equal(found.has("short"), true)
  assert.equal(found.has("overlap"), true)
  assert.equal(found.has("collision"), true)
})

test("só legendas curtas na faixa de baixo → zero avisos", () => {
  assert.deepEqual(
    codes([
      item({
        id: "l1",
        kind: "caption",
        duration: 0.4,
        label: "sandália",
        box: box(200, 1600, 880, 1800),
      }),
      item({
        id: "l2",
        kind: "caption",
        duration: 0.3,
        start: 0.4,
        label: "anabela",
        box: box(200, 1620, 880, 1820),
      }),
    ]),
    [],
  )
})

function sampleInsert(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "i1",
    type: "alerta-desconto",
    start: 0,
    duration: 0.5,
    text: "50% OFF",
    anchor: "center",
    animIn: "pop",
    animOut: "none",
    ...patch,
  }
}

function sampleComposition(inserts: CompositionInsert[]): Composition {
  return {
    version: COMPOSITION_VERSION,
    source: {
      duration: 20,
      fps: 30,
      width: 1080,
      height: 1920,
      fileName: "anuncio.mp4",
      fileId: "file-1",
    },
    brand: { fontId: "geist", primary: "#EE4D2D", logo: "" },
    inserts,
    batch: { hooks: [], fonts: ["geist"], positions: ["top"], baseName: "" },
    output: {
      width: 1080,
      height: 1920,
      fps: 30,
      videoBitrate: DEFAULT_VIDEO_BITRATE,
    },
    captionPreset: "viral",
    captionStyle: DEFAULT_CAPTION_STYLE,
    audio: defaultCompositionAudio(),
  }
}

test("checklistItemsFromComposition marca chip curto a partir da composition", () => {
  const items = checklistItemsFromComposition(sampleComposition([sampleInsert()]))
  const warnings = collectExportWarnings(items)
  assert.equal(warnings.some((warning) => warning.code === "short"), true)
})

function captionInButtonColumn(id: string, label: string): ChecklistItem {
  return item({
    id,
    kind: "caption",
    label,
    box: box(80, 1400, 1020, 1580),
  })
}

test("várias legendas na coluna dos botões viram um aviso só", () => {
  const warnings = collectExportWarnings([
    captionInButtonColumn("c1", "calça eu comprei logo"),
    captionInButtonColumn("c2", "Amigas olhem esse kit"),
    captionInButtonColumn("c3", "de pantalonas duna que"),
  ])
  const rights = warnings.filter((warning) => warning.code === "safe-right")
  assert.equal(rights.length, 1)
  assert.equal(rights[0]?.title, "As legendas entram na coluna dos botões.")
  assert.deepEqual(rights[0]?.insertIds, ["c1", "c2", "c3"])
})

test("uma legenda na coluna dos botões mantém o título com a frase", () => {
  const warnings = collectExportWarnings([
    captionInButtonColumn("c1", "calça eu comprei logo"),
  ])
  const rights = warnings.filter((warning) => warning.code === "safe-right")
  assert.equal(rights.length, 1)
  assert.equal(rights[0]?.title, "“calça eu comprei logo” entra na coluna dos botões.")
})

test("chip na coluna dos botões não some quando as legendas colapsam", () => {
  const warnings = collectExportWarnings([
    captionInButtonColumn("c1", "linha um"),
    captionInButtonColumn("c2", "linha dois"),
    item({
      id: "chip",
      kind: "chip",
      label: "50% OFF",
      box: box(900, 800, 1040, 920),
    }),
  ])
  const rights = warnings.filter((warning) => warning.code === "safe-right")
  assert.equal(rights.length, 2)
  assert.equal(
    rights.some((warning) => warning.title === "As legendas entram na coluna dos botões."),
    true,
  )
  assert.equal(
    rights.some((warning) => warning.title === "“50% OFF” entra na coluna dos botões."),
    true,
  )
})
