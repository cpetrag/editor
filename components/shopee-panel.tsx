"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { unknownCategoryId } from "@/lib/shopee/category-niche"
import { nicheFromCategories } from "@/lib/shopee/niche"
import { parsePastedReviews } from "@/lib/shopee/paste"
import { buildProofInserts } from "@/lib/shopee/proof"
import { formatSourceLine } from "@/lib/shopee/sources"
import type { ShopeeProduct, ShopeeReview } from "@/lib/shopee/types"

export function ShopeeProductPanel({
  product,
  nicheManual,
  busy,
  error,
  onImport,
  onUsePhrase,
  onUseMedia,
  onMountProof,
  onReviews,
  onAttachPhoto,
}: {
  product?: ShopeeProduct
  nicheManual?: boolean
  busy: boolean
  error: string
  onImport: (url: string, refresh: boolean) => void
  onUsePhrase: (review: ShopeeReview) => void
  onUseMedia: (review: ShopeeReview, media: ShopeeReview["media"][number]) => void
  onMountProof: () => void
  onReviews?: (reviews: ShopeeReview[]) => void
  onAttachPhoto?: (review: ShopeeReview, file: File) => void
}) {
  const [link, setLink] = useState(product?.url ?? "")
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState("")
  const [pasteStars, setPasteStars] = useState<Array<string>>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const suggestion = product ? nicheFromCategories(product.category) : null
  const cards = product ? buildProofInserts(product) : []
  const canMount = cards.some((card) => card.field === "rating" || card.field === "sold" || card.field === "quote")
  const pasted = (product?.reviews ?? []).filter((review) => review.source?.kind === "manual")
  const blocks = pasteText.trim() ? pasteText.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean) : []
  function commitManual(nextManual: ShopeeReview[]) {
    const imported = (product?.reviews ?? []).filter((review) => review.source?.kind !== "manual")
    onReviews?.([...imported, ...nextManual])
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-[0.7rem] text-muted-foreground">
        Link Shopee
        <span className="flex gap-1">
          <input
            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            placeholder="https://shopee.com.br/..."
            value={link}
            onChange={(event) => setLink(event.target.value)}
          />
          <Button type="button" size="sm" disabled={busy || !link.trim()} onClick={() => onImport(link.trim(), false)}>
            {busy ? "Importando…" : "Importar"}
          </Button>
        </span>
      </label>
      {product ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 text-[0.7rem] text-muted-foreground">
            <span>{product.shortName || product.title || "Produto importado"}</span>
            <button type="button" className="underline" disabled={busy} onClick={() => onImport(product.url || link, true)}>
              Atualizar
            </button>
          </div>
          {product.sources ? <p className="text-[0.7rem] text-muted-foreground">{formatSourceLine(product.sources)}</p> : null}
          {product.category.length === 0 ? (
            <p className="text-[0.7rem] text-muted-foreground">categoria não encontrada</p>
          ) : unknownCategoryId(product.category) ? (
            <p className="text-[0.7rem] text-muted-foreground">categoria {unknownCategoryId(product.category)}</p>
          ) : null}
        </div>
      ) : null}
      <button type="button" className="text-left text-[0.7rem] text-foreground underline" onClick={() => setPasteOpen((open) => !open)}>
        Colar avaliações
      </button>
      {pasteOpen ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-2">
          <textarea
            className="min-h-24 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            placeholder={"Uma avaliação por bloco, com linha em branco entre elas."}
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
          />
          {blocks.map((block, index) => (
            <label key={block.slice(0, 24) + index} className="flex items-center gap-2 text-[0.7rem] text-muted-foreground">
              <span className="min-w-0 flex-1 truncate">{block}</span>
              <input
                aria-label={`Estrelas da avaliação ${index + 1}`}
                className="h-7 w-14 rounded-md border border-border bg-background px-1 text-sm text-foreground"
                inputMode="numeric"
                placeholder="1–5"
                value={pasteStars[index] ?? ""}
                onChange={(event) => {
                  const next = [...pasteStars]
                  next[index] = event.target.value
                  setPasteStars(next)
                }}
              />
            </label>
          ))}
          <Button
            type="button"
            size="sm"
            disabled={blocks.length === 0}
            onClick={() => {
              const stars = blocks.map((_, index) => {
                const raw = pasteStars[index]?.trim()
                if (!raw) return null
                const value = Number(raw)
                return value >= 1 && value <= 5 ? value : null
              })
              const added = parsePastedReviews(pasteText, { stars })
              if (added.length === 0) return
              commitManual([...pasted, ...added])
              setPasteText("")
              setPasteStars([])
              setPasteOpen(false)
            }}
          >
            Adicionar
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-[0.7rem] text-red-600">{error}</p> : null}
      {nicheManual && suggestion && suggestion.niche !== "shopee" ? (
        <p className="text-[0.7rem] text-muted-foreground">Sugestão de nicho: {suggestion.niche}. O seu nicho manual foi mantido.</p>
      ) : null}
      <button
        type="button"
        className="h-8 rounded-md border border-border text-xs text-foreground disabled:opacity-50"
        disabled={!canMount}
        onClick={onMountProof}
      >
        Montar prova
      </button>
      {canMount ? null : (
        <p className="text-[0.7rem] text-muted-foreground">Sem nota, vendidos ou avaliações — importe ou preencha os campos</p>
      )}
      {product && product.reviews.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-foreground">Avaliações</p>
          {[...product.reviews.filter((review) => review.source?.kind === "manual"), ...product.reviews.filter((review) => review.source?.kind !== "manual")].slice(0, 12).map((review) => (
            <article key={review.id} className="rounded-md border border-border p-2">
              {review.source?.kind === "manual" ? <p className="text-[0.65rem] text-muted-foreground">colada</p> : null}
              {editingId === review.id ? (
                <textarea
                  className="min-h-16 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                  value={editText}
                  onChange={(event) => setEditText(event.target.value)}
                />
              ) : (
                <p className="text-sm text-foreground">“{review.phrase || review.text}”</p>
              )}
              <p className="text-[0.65rem] text-muted-foreground">
                {review.stars != null ? "⭐".repeat(review.stars) : "sem estrelas"}
                {review.variation ? ` · ${review.variation}` : ""} · cliente Shopee
              </p>
              {review.media.length > 0 ? (
                <div className="mt-1 flex gap-1">
                  {review.media.slice(0, 4).map((media) => (
                    <button
                      key={media.url}
                      type="button"
                      className="rounded border border-border px-1.5 py-0.5 text-[0.65rem]"
                      onClick={() => onUseMedia(review, media)}
                    >
                      {media.type === "video" ? "Usar vídeo" : "Usar foto"}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mt-1 flex flex-wrap gap-1">
                <Button type="button" size="xs" variant="outline" onClick={() => onUsePhrase(review)}>
                  Usar frase
                </Button>
                {review.source?.kind === "manual" ? (
                  editingId === review.id ? (
                    <Button
                      type="button"
                      size="xs"
                      onClick={() => {
                        const next = parsePastedReviews(editText, { pastedAt: review.source?.pastedAt, stars: [review.stars] })
                        const replacement = next[0] ? { ...next[0], id: review.id, media: review.media } : { ...review, text: editText }
                        commitManual(pasted.map((item) => (item.id === review.id ? replacement : item)))
                        setEditingId(null)
                      }}
                    >
                      Salvar
                    </Button>
                  ) : (
                    <Button type="button" size="xs" variant="outline" onClick={() => { setEditingId(review.id); setEditText(review.text) }}>
                      Editar
                    </Button>
                  )
                ) : null}
                {review.source?.kind === "manual" ? (
                  <Button type="button" size="xs" variant="outline" onClick={() => commitManual(pasted.filter((item) => item.id !== review.id))}>
                    Apagar
                  </Button>
                ) : null}
                <label className="cursor-pointer rounded-md border border-border px-2 py-0.5 text-[0.65rem] text-foreground">
                  Anexar foto
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ""
                      if (file) onAttachPhoto?.(review, file)
                    }}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  )
}
