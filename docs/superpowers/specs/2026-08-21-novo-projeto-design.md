# Novo projeto e Limpar inserts

**Data:** 2026-08-21  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`)  
**Status:** implementado e no ar (2026-08-21)  
**Ops:** [`docs/novo-projeto.md`](../../novo-projeto.md), Origem em [`docs/inserts-ui.md`](../../inserts-ui.md)  
**Não bumpa** `Composition.version` (continua **4**).  
**Não é** a Fase 3 de `docs/inserts-ui.md`. Sem encoder.

## Objetivo

O operador termina um anúncio e começa outro **no mesmo navegador**, sem F5 / limpar site. Dois botões, papéis distintos.

## Decisões

| Tema | Escolha |
| --- | --- |
| Recorte | **C:** os dois botões |
| Novo projeto | Cabeçalho do painel esquerdo (ao lado de “Configuração de Inserts”) |
| Limpar inserts | Card Origem, ao lado de **Trocar** |
| Confirmação Novo projeto | Dois cliques no próprio botão (sem Dialog). Primeiro: ghost “Novo projeto”. Segundo: destructive “Confirmar” + ghost “Cancelar”. Timeout 6 s desarma |
| Confirmação Limpar inserts | Nenhuma. Undo (Ctrl+Z / toast **Desfazer**), igual apagar um insert |
| Inserts de exemplo (`SEED_INSERTS`) | **Não** voltam no Novo projeto. F5 depois do reset **não** reidrata o seed |
| Presets “meus” (IndexedDB `presets`) | Ficam |
| URLs recentes | Ficam |
| Pasta `import-downloads` no Mac | Não apaga |
| Schema / encoder / Fase 3 | Fora |

## O que o operador vê

### Novo projeto

Cabeçalho: título à esquerda, botão à direita (`ml-auto`). Sempre visível na aba Editor. Desabilitado enquanto `exporting`.

Confirmar:

1. Composição vira `createDefaultComposition()` (inserts `[]`, `source.duration` 0, sem `fileId`).
2. Grava **na hora** em `localStorage` (`saveCompositionJson`). Não esperar o debounce de 300 ms — senão F5 em <300 ms reabre o projeto velho. **Não** usar `removeItem`: hydrate sem JSON volta ao seed.
3. Apaga no IndexedDB (`files`) o `source.fileId` atual, o `previousSource.fileId` se houver, e todo `fileId` de insert `sticker`.
4. Revoga blob URLs do vídeo e dos PNGs. Zera histórico, seleção, playhead, draft URL, import (abort), `previousSource`, `missingFile`, `quotaWarning`, `replacingSource`.
5. Painel volta ao estado Origem vazio (colar URL / enviar arquivo). Live region: **“Projeto novo”**. Sem undo.

### Limpar inserts

Só com vídeo pronto (`hasPlayableSource`). Ao lado de **Trocar**. Desabilitado se `inserts.length === 0`.

Clique:

1. `clearInsertsArt`: `inserts = []`; `captionStyle` e `captionPreset` nos defaults; `tracks` no default (`carrinhoLaranja` na CTA); tira `styleRef` de projeto. **Mantém** `source`, `brand`, `batch`, `output`, `customPresets`.
2. Um `commitDiscrete` no histórico. Toast **“Inserts apagados”** + **Desfazer**.
3. **Não** apaga PNGs no IndexedDB aqui — o undo precisa dos blobs. Quem faxina arquivos é **Novo projeto**. O MP4 fica.

## Persistência

Schema **v4**. Sem campo novo.

Funções puras em `lib/project-reset.ts` (não inchar `composition.ts`):

```ts
projectFileIds(composition: Composition, extraIds?: string[]): string[]
// source.fileId + sticker.fileId + extraIds; únicos; ignora vazio

clearInsertsArt(composition: Composition): Composition
newProjectComposition(): Composition  // === createDefaultComposition()
```

`createDefaultComposition()` já existe e é o documento vazio correto.

## UI / estado

- Chrome HTML. Não entra no MP4.
- `ControlPanel` header: estado local `newProjectArmed` + timer 6 s.
- `BackgroundSourceCard`: prop `onClearInserts` + `canClearInserts`.
- `VideoEditor` orquestra delete IndexedDB, revoke, `saveCompositionJson` imediato, `emptyHistory()`.

## Testes

TDD em `lib/project-reset.test.ts` e acréscimo em `lib/project-store.test.ts`:

1. `newProjectComposition()`: inserts vazio, sem `fileId`, duration 0, version 4.
2. `clearInsertsArt` zera inserts e `captionStyle.rotation`; **não** mexe `source.fileId` / duration.
3. `projectFileIds` junta vídeo + dois PNGs, sem duplicar, ignora insert sem `fileId`.
4. `saveCompositionJson(newProjectComposition())` + `loadCompositionJson` **não** traz seed; round-trip sem `fileId`.

UI: sem teste de pixel. Smoke: Novo projeto → Origem vazio → F5 continua vazio; Limpar inserts → Ctrl+Z restaura.

## Fora desta fatia

- Dialog shadcn, atalho de teclado, apagar presets, faxina de blobs órfãos sem id conhecido, `import-downloads` no disco.
- Mudar o primeiro load (ainda pode mostrar `SEED_INSERTS` se nunca houve JSON).

## Aceite

1. **Novo projeto** (Confirmar) some vídeo, inserts e legendas; card Origem vazio; F5 não revive o projeto anterior nem o seed.
2. Presets “meus” e lista de URLs recentes continuam.
3. **Limpar inserts** some a arte, o MP4 toca; **Desfazer** / Ctrl+Z devolve inserts e `captionStyle`.
4. Export **não** pinta os botões. Schema continua 4.
