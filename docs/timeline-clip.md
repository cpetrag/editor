# Timeline: entrada, saída, mover e apagar

**Atualizado:** 2026-08-18  
**Produto:** Editor de Inserts  
**Status:** em produção. Abordagem **A** (o clipe na barra é o insert).  
**Não bumpa** `Composition.version`.

O operador ajusta **quando** o insert aparece no vídeo arrastando o bloco na timeline. O card (Início / Duração) continua válido; os dois caminhos passam pelo mesmo `clampInsert`.

---

## 1. Gestos

Cada insert é um bloco colorido na faixa (`components/timeline-clip.tsx`).

| Onde | Ação |
| --- | --- |
| Borda esquerda (~8 px, no máximo ⅓ da largura) | trim **entrada** (`in`) |
| Borda direita | trim **saída** (`out`) |
| Miolo | **move** (duração fixa) |
| Clique no bloco | seleciona o card e faz seek no início |
| Clique no vazio da trilha | seek no playhead |
| Delete / Backspace | apaga o insert selecionado (ignorado se o foco está em input/textarea) |

Passo **0,1 s**. Duração mínima **0,5 s** (`MIN_DURATION`). Tempo arredonda em décimos (`roundTenths`).

---

## 2. Regras de clamp

`lib/timeline-clip.ts` aplica `clampInsert` de `lib/composition.ts`:

| Gesto | Campo que manda | Efeito |
| --- | --- | --- |
| Move | `start` | recua/avança o início e **preserva a duração** (não vaza do fim do vídeo) |
| Trim in | `duration` | a saída fica fixa; o início não passa de `fim − 0,5 s` |
| Trim out | `duration` | o início fica fixo; o fim não passa da duração do vídeo nem de `início + 0,5 s` |

`clientXToTime` mapeia o ponteiro na largura da trilha para `[0, source.duration]`.

`hitTimelineHandle(localX, widthPx)` decide `in` | `out` | `move` quando o pointer desce no bloco.

---

## 3. Arquivos

| Arquivo | Papel |
| --- | --- |
| `lib/timeline-clip.ts` | tempo, trim, move, hit da borda |
| `lib/timeline-clip.test.ts` | passo 0,1; mín. 0,5; clamp in/out/move |
| `components/timeline-clip.tsx` | barra + handles visuais |
| `components/preview-panel.tsx` | pointer capture, seek, Delete → `onRemoveInsert` |
| `components/video-editor.tsx` | `onRemoveInsert={removeInsert}` |

---

## 4. Fora desta fatia

Ripple (empurrar os vizinhos), snap entre clipes, split, copiar/colar intervalo, faixas de vídeo/áudio, abordagem B (chips virarem outra coisa). O agrupamento Gancho / Prova / CTA pelo ponto médio **não muda**.
