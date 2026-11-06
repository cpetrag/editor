"use client"

import { useCallback, useEffect, useState } from "react"

import { APP_VERSION, formatAppVersion, isStaleTab, parseAppVersion } from "@/lib/app-version"
import { Button } from "@/components/ui/button"

const CHECK_INTERVAL_MS = 60_000

export function AppVersionBadge() {
  const [stale, setStale] = useState(false)

  const check = useCallback(async () => {
    try {
      const response = await fetch("/api/version", { cache: "no-store" })
      if (!response.ok) return
      const served = parseAppVersion(await response.json())
      setStale(isStaleTab(APP_VERSION, served))
    } catch {
      // sem rede não faz sentido avisar nada
    }
  }, [])

  useEffect(() => {
    void check()
    const timer = setInterval(() => void check(), CHECK_INTERVAL_MS)
    const onFocus = () => void check()
    window.addEventListener("focus", onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener("focus", onFocus)
    }
  }, [check])

  if (stale) {
    return (
      <div className="mt-2 flex items-center justify-center gap-2" role="status">
        <span className="text-xs text-muted-foreground">
          Versão nova publicada. Esta aba ainda roda a {formatAppVersion(APP_VERSION)}.
        </span>
        <Button type="button" variant="outline" size="xs" onClick={() => location.reload()}>
          Atualizar
        </Button>
      </div>
    )
  }

  return (
    <p className="mt-2 text-center text-[0.65rem] text-muted-foreground/70">
      {formatAppVersion(APP_VERSION)}
    </p>
  )
}
