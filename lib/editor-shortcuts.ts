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

export type TransportShortcut =
  | "help"
  | "toggle-play"
  | "split"
  | "mark-in"
  | "mark-out"
  | "step-back-frame"
  | "step-forward-frame"
  | "step-back-second"
  | "step-forward-second"
  | "seek-start"
  | "seek-end"
  | "delete-selection"
  | "undo"
  | "redo"
  | "export"

/**
 * Atalhos de transporte do editor. Ignora campo de texto e atalho já tratado.
 * Setas com Shift andam 1 segundo; sem Shift, 1 quadro.
 */
export function transportShortcut(event: ShortcutKeyEvent): TransportShortcut | null {
  if (event.defaultPrevented || isEditableTarget(event.target)) return null
  const command = Boolean(event.ctrlKey || event.metaKey)
  const key = event.key
  if (command && !event.altKey && key.toLowerCase() === "z") {
    return event.shiftKey ? "redo" : "undo"
  }
  if (command && !event.altKey && !event.shiftKey && key.toLowerCase() === "y") return "redo"
  if (command && !event.altKey && !event.shiftKey && key.toLowerCase() === "e") return "export"
  if (command || event.altKey) return null
  if (key === "?") return "help"
  if (key === " " && !event.shiftKey) return "toggle-play"
  if (event.shiftKey) {
    if (key === "ArrowLeft") return "step-back-second"
    if (key === "ArrowRight") return "step-forward-second"
    return null
  }
  switch (key.toLowerCase()) {
    case "s":
      return "split"
    case "i":
      return "mark-in"
    case "o":
      return "mark-out"
    case "home":
      return "seek-start"
    case "end":
      return "seek-end"
    case "delete":
    case "backspace":
      return "delete-selection"
    case "arrowleft":
      return "step-back-frame"
    case "arrowright":
      return "step-forward-frame"
    default:
      return null
  }
}

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
      { keys: ["Espaço", "K"], description: "Reproduzir / pausar" },
      { keys: ["J"], description: `Voltar ${JKL_SEEK_SECONDS} s` },
      { keys: ["L"], description: `Avançar ${JKL_SEEK_SECONDS} s` },
      { keys: ["←", "→"], description: "Andar 1 quadro" },
      { keys: ["Shift", "←", "→"], description: "Andar 1 segundo" },
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
      { keys: ["Delete"], description: "Apagar a seleção" },
      { keys: ["Ctrl", "A"], description: "Selecionar tudo na timeline" },
      { keys: ["Ctrl", "D"], description: "Duplicar a seleção" },
      { keys: ["Alt", "←", "→"], description: "Mover a seleção 1 quadro" },
      { keys: ["Shift", "Alt", "←", "→"], description: "Mover a seleção 10 quadros" },
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
      { keys: ["Ctrl", "E"], description: "Abrir exportar" },
      { keys: ["?"], description: "Mostrar esta ajuda" },
    ],
  },
]
