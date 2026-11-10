"use client"

import { Component, type ReactNode } from "react"

type BoundaryProps = {
  children: ReactNode
  /** "preview" mostra "Erro no preview: …". "panel" mostra o erro só na aba. */
  variant: "preview" | "panel"
  resetKey?: string
}

type BoundaryState = { error: Error | null }

export class PanelErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error("[editor] erro isolado na interface", error)
  }

  componentDidUpdate(prev: BoundaryProps) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    const error = this.state.error
    if (!error) return this.props.children
    const message = error.message || "Erro inesperado"
    const text = this.props.variant === "preview" ? `Erro no preview: ${message}` : `Não foi possível abrir esta aba. ${message}`
    return (
      <div
        role="alert"
        className={
          this.props.variant === "preview"
            ? "absolute inset-0 z-20 flex items-center justify-center bg-zinc-950 p-4 text-center text-sm text-red-200"
            : "flex h-full min-h-0 items-center justify-center p-6 text-center text-sm text-destructive"
        }
      >
        {text}
      </div>
    )
  }
}
