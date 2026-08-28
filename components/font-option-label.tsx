import type { FontOption } from "@/lib/fonts"

export function FontOptionLabel({
  font,
  fallback,
}: {
  font: FontOption | undefined
  fallback: string
}) {
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5">
      <span
        className="truncate text-base leading-tight text-foreground"
        style={{ fontFamily: font?.family }}
      >
        {font?.label ?? fallback}
      </span>
      {font?.vibe ? (
        <span className="truncate font-sans text-[0.65rem] text-muted-foreground">{font.vibe}</span>
      ) : null}
    </span>
  )
}
