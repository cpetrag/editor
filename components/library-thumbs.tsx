import type { InsertType } from "@/lib/composition"
import type { Template } from "@/lib/inserts"
import { comboDuration, comboPreviewMarks } from "@/lib/library-preview"

export function ComboStagePreview({ template }: { template: Template }) {
  const marks = comboPreviewMarks(template)
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-sm bg-zinc-900 ring-1 ring-border"
      style={{ width: 56, aspectRatio: "9 / 16" }}
      aria-hidden
    >
      {marks.map((mark, index) => (
        <span
          key={`${mark.type}-${index}`}
          className="absolute left-1/2 h-1.5 w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ top: `${mark.topPct}%`, backgroundColor: mark.color }}
        />
      ))}
    </div>
  )
}

export function ComboMiniTimeline({ template }: { template: Template }) {
  const marks = comboPreviewMarks(template)
  return (
    <div className="flex flex-col gap-1" aria-hidden>
      {marks.map((mark, index) => (
        <div key={`${mark.type}-${index}`} className="relative h-1 overflow-hidden rounded-full bg-muted">
          <span
            className="absolute inset-y-0 rounded-full"
            style={{
              left: `${mark.leftPct}%`,
              width: `${Math.max(mark.widthPct, 8)}%`,
              backgroundColor: mark.color,
            }}
          />
        </div>
      ))}
    </div>
  )
}

export function ComboCardMeta({
  template,
  overflows,
  videoDuration = 0,
}: {
  template: Template
  overflows: boolean
  videoDuration?: number
}) {
  const count = template.beats?.length ?? template.inserts.length
  const duration = comboDuration(template, videoDuration)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-[0.65rem] text-muted-foreground">
        <span>
          {count} {count === 1 ? "elemento" : "elementos"}
        </span>
        <span className="font-mono tabular-nums">{duration.toFixed(1)}s</span>
      </div>
      {overflows ? (
        <p className="text-[0.65rem] text-destructive">Passa da duração do vídeo</p>
      ) : null}
    </div>
  )
}

export function ElementThumb({ type }: { type: InsertType }) {
  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted"
      aria-hidden
    >
      <ElementThumbArt type={type} />
    </span>
  )
}

function ElementThumbArt({ type }: { type: InsertType }) {
  switch (type) {
    case "logo-shopee":
      return (
        <span className="flex size-6 items-center justify-center rounded-md bg-track-shopee text-[0.55rem] font-black text-white">
          S
        </span>
      )
    case "selo-frete":
      return (
        <span className="rounded-full bg-track-frete px-1 py-0.5 text-[0.45rem] font-bold tracking-wide text-white">
          GRÁTIS
        </span>
      )
    case "alerta-desconto":
      return (
        <span className="rounded-sm bg-track-desconto px-1 py-0.5 text-[0.6rem] font-black leading-none text-zinc-900">
          50%
        </span>
      )
    case "preco-riscado":
      return (
        <span className="flex flex-col items-center leading-none">
          <span className="text-[0.45rem] text-muted-foreground line-through">R$99</span>
          <span className="text-[0.65rem] font-black text-track-preco">R$49</span>
        </span>
      )
    case "cupom":
      return (
        <span className="rounded-sm border border-dashed border-track-cupom bg-background px-1 py-0.5 text-[0.45rem] font-bold text-track-cupom">
          CUPOM
        </span>
      )
    case "contador":
      return (
        <span className="font-mono text-[0.7rem] font-bold tabular-nums text-track-contador">
          00:59
        </span>
      )
    case "barra-estoque":
      return (
        <span className="flex w-7 flex-col gap-0.5">
          <span className="h-1.5 overflow-hidden rounded-full bg-background">
            <span className="block h-full w-2/5 rounded-full bg-track-estoque" />
          </span>
          <span className="text-center text-[0.4rem] font-semibold text-track-estoque">3</span>
        </span>
      )
    case "estrelas":
      return (
        <span className="text-[0.55rem] leading-none tracking-tight text-track-estrelas">
          ★★★★★
        </span>
      )
    case "seta":
      return (
        <span className="text-lg leading-none text-track-seta" style={{ transform: "rotate(90deg)" }}>
          ➤
        </span>
      )
    case "tarja-frete":
      return (
        <span className="w-8 rounded-sm bg-track-frete px-0.5 py-1 text-center text-[0.4rem] font-black leading-tight text-white">
          FRETE
        </span>
      )
    case "seta-mao":
      return <span className="text-lg leading-none text-track-seta">↝</span>
    case "circulo-destaque":
      return <span className="size-5 rounded-full border-2 border-track-desconto" />
    case "bubble-comentario":
      return (
        <span className="rounded-md bg-white px-1 py-0.5 text-[0.4rem] font-semibold text-zinc-900">
          @
        </span>
      )
    case "divisor-antes-depois":
      return <span className="h-6 w-px bg-track-preco" />
    case "passo":
      return (
        <span className="rounded-full bg-zinc-900 px-1 py-0.5 text-[0.4rem] font-bold text-track-desconto">
          1/3
        </span>
      )
    case "tarja-espera":
      return (
        <span className="bg-track-desconto px-1 py-0.5 text-[0.4rem] font-extrabold text-zinc-900">
          final
        </span>
      )
    default:
      return <span className="size-2 rounded-full bg-muted-foreground" />
  }
}
