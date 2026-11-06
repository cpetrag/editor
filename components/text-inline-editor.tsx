"use client"

import { useLayoutEffect, useRef } from "react"

import type { InlineEditorCss, InlineEditorPlacement } from "@/lib/compose/inline-editor-style"

const BLOCK_TAGS = new Set(["DIV", "P"])

/**
 * `innerText` aplicaria o `text-transform` do estilo (ex.: maiúsculas) e
 * salvaria o texto transformado; aqui lemos o conteúdo cru do DOM.
 */
function readEditableText(root: HTMLElement): string {
  let text = ""
  const walk = (node: Node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.nodeValue ?? ""
      } else if (child instanceof HTMLBRElement) {
        text += "\n"
      } else if (child instanceof HTMLElement) {
        if (BLOCK_TAGS.has(child.tagName) && text && !text.endsWith("\n")) text += "\n"
        walk(child)
      }
    }
  }
  walk(root)
  // Chrome mantém um <br> final só para a última linha vazia ficar visível.
  return root.lastChild instanceof HTMLBRElement && text.endsWith("\n") ? text.slice(0, -1) : text
}

/**
 * Editor não controlado: o React nunca escreve dentro do div depois do mount.
 * Re-renderizar `children` a cada tecla reescreveria o nó de texto e jogaria o
 * cursor para o início.
 */
export function TextInlineEditor({
  initialText,
  css,
  placement,
  onChange,
  onCommit,
  onCancel,
}: {
  initialText: string
  css: InlineEditorCss
  placement: InlineEditorPlacement
  onChange: (text: string) => void
  onCommit: (text: string) => void
  onCancel: (originalText: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const originalRef = useRef(initialText)
  const finishedRef = useRef(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.textContent = originalRef.current
    el.focus({ preventScroll: true })
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, [])

  function finish(kind: "commit" | "cancel") {
    if (finishedRef.current) return
    finishedRef.current = true
    if (kind === "cancel") {
      onCancel(originalRef.current)
      return
    }
    onCommit(ref.current ? readEditableText(ref.current) : originalRef.current)
  }

  return (
    <div
      ref={ref}
      role="textbox"
      aria-label="Editar texto"
      aria-multiline
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck={false}
      tabIndex={0}
      data-text-inline-editor
      className="absolute z-30 cursor-text outline-1 outline-offset-2 outline-sky-400/80 outline-dashed selection:bg-sky-400/35 selection:text-(--inline-editor-color)"
      style={{
        ["--inline-editor-color" as string]: css.color,
        left: placement.centerX,
        top: placement.centerY,
        transform: `translate(-50%, -50%)${placement.rotation ? ` rotate(${placement.rotation}deg)` : ""}`,
        transformOrigin: "center",
        boxSizing: "content-box",
        width: "max-content",
        minWidth: "1ch",
        maxWidth: css.maxWidth,
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
        fontFamily: css.fontFamily,
        fontWeight: css.fontWeight,
        fontSize: css.fontSize,
        lineHeight: css.lineHeight,
        letterSpacing: css.letterSpacing,
        textTransform: css.textTransform,
        textAlign: css.textAlign,
        color: css.color,
        caretColor: css.caretColor,
        padding: css.padding,
        borderRadius: css.borderRadius,
        backgroundColor: css.backgroundColor,
        WebkitTextStroke: css.WebkitTextStroke,
        paintOrder: css.paintOrder,
        textShadow: css.textShadow,
      }}
      onInput={(event) => onChange(readEditableText(event.currentTarget))}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === "Escape") {
          event.preventDefault()
          finish("cancel")
          return
        }
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault()
          finish("commit")
        }
      }}
      onBlur={() => finish("commit")}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    />
  )
}
