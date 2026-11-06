import { isEditableTarget } from "./is-editable-target.ts"

export type EditorShortcutAction =
  | "help"
  | "edit-text"
  | "next-insert"
  | "previous-insert"
  | "deselect"
  | "seek-start"
  | "seek-end"
  | "seek-back"
  | "toggle-play"
  | "seek-forward"

export type ShortcutKeyEvent = {
  key: string
  target: EventTarget | null
  defaultPrevented: boolean
  shiftKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
}

/** Segundos que J e L andam por toque. */
export const JKL_SEEK_SECONDS = 1

const WORKSPACE_SELECTOR = "[data-preview-stage], [data-editor-timeline]"

/**
 * Alvos onde Enter, Espaço, Tab e Esc viram atalhos do editor. Fora deles
 * (botões, menus, cards) essas teclas mantêm o papel nativo de navegação.
 */
export function isWorkspaceTarget(target: EventTarget | null): boolean {
  if (typeof document !== "undefined" && target === document.body) return true
  if (typeof Element === "undefined" || !(target instanceof Element)) return false
  if (target.tagName === "BODY") return true
  return target.closest(WORKSPACE_SELECTOR) !== null
}

export function editorShortcutAction(event: ShortcutKeyEvent): EditorShortcutAction | null {
  if (event.defaultPrevented || isEditableTarget(event.target)) return null
  if (event.ctrlKey || event.metaKey || event.altKey) return null
  const workspace = isWorkspaceTarget(event.target)
  switch (event.key) {
    case "?":
      return "help"
    case "F2":
      return "edit-text"
    case "Enter":
      return workspace ? "edit-text" : null
    case "Tab":
      if (!workspace) return null
      return event.shiftKey ? "previous-insert" : "next-insert"
    case "Escape":
      return workspace ? "deselect" : null
    case "Home":
      return "seek-start"
    case "End":
      return "seek-end"
    case " ":
      return workspace ? "toggle-play" : null
  }
  const letter = event.key.toLowerCase()
  if (event.shiftKey) return null
  if (letter === "j") return "seek-back"
  if (letter === "k") return "toggle-play"
  if (letter === "l") return "seek-forward"
  return null
}

/** Próximo índice ao andar com Tab / Shift+Tab, dando a volta na lista. */
export function cycleIndex(current: number, length: number, direction: 1 | -1): number {
  if (length <= 0) return -1
  if (current < 0) return direction === 1 ? 0 : length - 1
  return (current + direction + length) % length
}

export type ShortcutHelpEntry = { keys: string[]; description: string }
export type ShortcutHelpGroup = { title: string; entries: ShortcutHelpEntry[] }

export const SHORTCUT_HELP: ShortcutHelpGroup[] = [
  {
    title: "Reprodução",
    entries: [
      { keys: ["K"], description: "Reproduzir / pausar (Espaço no preview)" },
      { keys: ["J"], description: `Voltar ${JKL_SEEK_SECONDS} s` },
      { keys: ["L"], description: `Avançar ${JKL_SEEK_SECONDS} s` },
      { keys: ["←", "→"], description: "Andar 1 quadro (Shift = 10)" },
      { keys: [",", "."], description: "Andar 1 quadro" },
      { keys: ["Home"], description: "Ir para o início" },
      { keys: ["End"], description: "Ir para o fim" },
    ],
  },
  {
    title: "Inserts",
    entries: [
      { keys: ["Tab"], description: "Próximo insert" },
      { keys: ["Shift", "Tab"], description: "Insert anterior" },
      { keys: ["Enter"], description: "Editar o texto selecionado" },
      { keys: ["F2"], description: "Editar o texto selecionado" },
      { keys: ["Esc"], description: "Tirar a seleção" },
      { keys: ["Delete"], description: "Apagar o insert selecionado" },
      { keys: ["↑", "↓", "←", "→"], description: "Mover o selecionado (Shift = passo maior)" },
      { keys: ["Duplo clique"], description: "Editar o texto ou criar um texto no vídeo" },
    ],
  },
  {
    title: "Linha do tempo",
    entries: [
      { keys: ["I"], description: "Marcar a entrada do corte" },
      { keys: ["O"], description: "Marcar a saída do corte" },
      { keys: ["S"], description: "Dividir o vídeo no ponto atual" },
      { keys: ["Ctrl", "Rolar"], description: "Zoom da linha do tempo" },
    ],
  },
  {
    title: "Edição",
    entries: [
      { keys: ["Ctrl", "Z"], description: "Desfazer" },
      { keys: ["Ctrl", "Shift", "Z"], description: "Refazer (ou Ctrl+Y)" },
      { keys: ["?"], description: "Mostrar esta ajuda" },
    ],
  },
]
