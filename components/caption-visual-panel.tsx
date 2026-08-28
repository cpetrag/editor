"use client"

import { useState } from "react"

import { CaptionStyleCard } from "@/components/caption-style-card"
import {
  StyleCustomizePanel,
  type PresetLibraryHandlers,
} from "@/components/style-customize-panel"
import { cn } from "@/lib/utils"
import type { CaptionPreset, CaptionStyle, CompositionInsert } from "@/lib/composition"
import type { Insert } from "@/lib/inserts"
import type { StyleLayer, TrackId, UserPreset } from "@/lib/style/types"

type VisualTab = "style" | "motion"

const TABS: Array<{ id: VisualTab; label: string }> = [
  { id: "style", label: "Estilo" },
  { id: "motion", label: "Movimento" },
]

export function CaptionVisualPanel({
  host,
  inserts,
  videoDuration,
  captionStyle,
  captionPreset = "viral",
  userPresets = [],
  onSelectLook,
  tracks,
  projectStyle,
  onPatchStyle,
  onResetField,
  onResetOverrides,
  onResetPosition,
  onApplyPreset,
  onApplyToTrack,
  onBeginGesture,
  onEndGesture,
  presetLibrary,
}: {
  host: CompositionInsert
  inserts: Insert[]
  videoDuration: number
  captionStyle: CaptionStyle
  captionPreset?: CaptionPreset
  userPresets?: UserPreset[]
  onSelectLook: (lookId: string) => void
  tracks?: Partial<Record<TrackId, StyleLayer>>
  projectStyle?: StyleLayer
  onPatchStyle: (path: string, value: unknown) => void
  onResetField: (path: string) => void
  onResetOverrides: () => void
  onResetPosition: () => void
  onApplyPreset: (presetId: string, mode: "preserve" | "clean") => void
  onApplyToTrack: () => void
  onBeginGesture?: () => void
  onEndGesture?: () => void
  presetLibrary?: PresetLibraryHandlers
}) {
  const [tab, setTab] = useState<VisualTab>("style")

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
        Visual · todas as linhas
      </p>
      <CaptionStyleCard
        inserts={inserts}
        captionStyle={captionStyle}
        captionPreset={captionPreset}
        userPresets={userPresets}
        onSelectLook={onSelectLook}
      />
      <div
        role="tablist"
        aria-label="Estilo e movimento das legendas"
        className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
      >
        {TABS.map((item) => {
          const selected = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                selected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <StyleCustomizePanel
        insert={host}
        videoDuration={videoDuration}
        tracks={tracks}
        project={projectStyle}
        captionStyle={captionStyle}
        captionPreset={captionPreset}
        tab={tab}
        context="caption"
        onPatchStyle={onPatchStyle}
        onResetField={onResetField}
        onResetOverrides={onResetOverrides}
        onResetPosition={onResetPosition}
        onApplyPreset={onApplyPreset}
        onApplyToTrack={onApplyToTrack}
        onBeginGesture={onBeginGesture}
        onEndGesture={onEndGesture}
        presetLibrary={presetLibrary}
      />
    </div>
  )
}
