"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { parseMaxChars, parseMaxWords } from "@/lib/captions"
import { countCaptionMatches } from "@/lib/caption-vocab"
import type { CaptionPrefs } from "@/lib/caption-prefs"
import type { Insert } from "@/lib/inserts"

export function CaptionDesk({
  inserts,
  prefs,
  vocabulary,
  exceptionCount,
  onPrefs,
  onVocabulary,
  onReplace,
  onShift,
  onClearExceptions,
  onRevealException,
}: {
  inserts: Insert[]
  prefs: CaptionPrefs
  vocabulary: string[]
  exceptionCount: number
  onPrefs: (patch: Partial<CaptionPrefs>) => void
  onVocabulary: (terms: string[]) => void
  onReplace: (query: string, replacement: string, mode: "one" | "all") => void
  onShift: (deltaSeconds: number) => void
  onClearExceptions: () => void
  onRevealException: () => void
}) {
  const [query, setQuery] = useState("")
  const [replacement, setReplacement] = useState("")
  const [shiftMs, setShiftMs] = useState("0")
  const [term, setTerm] = useState("")
  const matches = useMemo(() => countCaptionMatches(inserts, query), [inserts, query])

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Field className="gap-1">
          <FieldLabel htmlFor="caption-max-words" className="text-[0.65rem] text-muted-foreground">
            Palavras por card
            <span className="ml-1 font-mono tabular-nums text-foreground">{prefs.maxWords}</span>
          </FieldLabel>
          <input
            id="caption-max-words"
            type="range"
            min={1}
            max={6}
            step={1}
            value={prefs.maxWords}
            onChange={(event) => onPrefs({ maxWords: parseMaxWords(event.target.value) })}
            className="h-5 w-full accent-brand"
          />
        </Field>
        <Field className="gap-1">
          <FieldLabel htmlFor="caption-max-chars" className="text-[0.65rem] text-muted-foreground">
            Máx. caracteres
            <span className="ml-1 font-mono tabular-nums text-foreground">{prefs.maxChars}</span>
          </FieldLabel>
          <input
            id="caption-max-chars"
            type="range"
            min={8}
            max={48}
            step={1}
            value={prefs.maxChars}
            onChange={(event) => onPrefs({ maxChars: parseMaxChars(event.target.value) })}
            className="h-5 w-full accent-brand"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-1 rounded-md border border-border p-2">
        <p className="text-[0.65rem] font-medium text-foreground">Localizar e substituir</p>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Localizar" aria-label="Localizar nas legendas" className="h-7 text-xs" />
        <Input value={replacement} onChange={(event) => setReplacement(event.target.value)} placeholder="Substituir por" aria-label="Substituir nas legendas" className="h-7 text-xs" />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.65rem] text-muted-foreground">{matches} ocorrência{matches === 1 ? "" : "s"}</span>
          <div className="flex gap-1">
            <Button type="button" size="xs" variant="outline" disabled={matches === 0} onClick={() => onReplace(query, replacement, "one")}>
              Uma
            </Button>
            <Button type="button" size="xs" variant="outline" disabled={matches === 0} onClick={() => onReplace(query, replacement, "all")}>
              Todas
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-md border border-border p-2">
        <p className="text-[0.65rem] font-medium text-foreground">Sincronia</p>
        <div className="flex items-center gap-1">
          <Button type="button" size="xs" variant="outline" onClick={() => onShift(-0.1)}>−0,1 s</Button>
          <Button type="button" size="xs" variant="outline" onClick={() => onShift(0.1)}>+0,1 s</Button>
          <Input
            aria-label="Deslocar legendas em milissegundos"
            value={shiftMs}
            onChange={(event) => setShiftMs(event.target.value)}
            className="h-7 w-20 text-xs"
          />
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => {
              const parsed = Number(shiftMs.replace(",", "."))
              if (!Number.isFinite(parsed) || parsed === 0) return
              onShift(parsed / 1000)
            }}
          >
            ms
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-md border border-border p-2">
        <p className="text-[0.65rem] font-medium text-foreground">Dicionário</p>
        <div className="flex gap-1">
          <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Novo termo" aria-label="Termo do dicionário" className="h-7 text-xs" />
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => {
              const next = term.trim()
              if (!next || vocabulary.some((item) => item.toLocaleLowerCase("pt-BR") === next.toLocaleLowerCase("pt-BR"))) return
              onVocabulary([...vocabulary, next])
              setTerm("")
            }}
          >
            Adicionar
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {vocabulary.map((item) => (
            <button
              key={item}
              type="button"
              className="rounded bg-muted px-1.5 py-0.5 text-[0.65rem] text-foreground"
              onClick={() => onVocabulary(vocabulary.filter((term) => term !== item))}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {exceptionCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-2 text-[0.7rem]">
          <span>{exceptionCount} legenda{exceptionCount === 1 ? "" : "s"} com estilo próprio</span>
          <Button type="button" size="xs" variant="outline" onClick={onRevealException}>Ver</Button>
          <Button type="button" size="xs" variant="outline" onClick={onClearExceptions}>Voltar todas ao estilo geral</Button>
          <span className="text-muted-foreground">Exceções não são afetadas</span>
        </div>
      ) : null}
    </div>
  )
}
