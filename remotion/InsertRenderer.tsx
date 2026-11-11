import { useEffect, useRef } from "react"
import { AbsoluteFill, continueRender, delayRender } from "remotion"

import { drawPlayInserts } from "../lib/compose/draw-play.ts"
import { stickerMediaSrc } from "../lib/compose/sticker-src.ts"
import { insertKind } from "../lib/composition.ts"
import { waitForRenderFonts } from "./load-fonts.ts"
import type { RenderProps } from "./types.ts"

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const image = new Image()
    if (/^https?:\/\//i.test(src)) image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => resolve(image)
    image.src = src
  })
}

async function loadAssets(props: RenderProps): Promise<{
  stickers: Map<string, HTMLImageElement>
  logo: HTMLImageElement | null
}> {
  const stickers = new Map<string, HTMLImageElement>()
  const pending: Array<Promise<void>> = []

  for (const insert of props.inserts) {
    if (insertKind(insert) !== "sticker") continue
    const src = stickerMediaSrc(insert, props.stickerSrcs)
    if (!src) continue
    pending.push(
      loadImage(src).then((image) => {
        stickers.set(insert.id, image)
      }),
    )
  }

  let logo: HTMLImageElement | null = null
  if (props.brand.logo) {
    pending.push(
      loadImage(props.brand.logo).then((image) => {
        logo = image.naturalWidth > 0 ? image : null
      }),
    )
  }

  await Promise.all(pending)
  return { stickers, logo }
}

function paintInserts(
  canvas: HTMLCanvasElement,
  props: RenderProps,
  time: number,
  assets: { stickers: Map<string, HTMLImageElement>; logo: HTMLImageElement | null },
): void {
  canvas.width = props.width
  canvas.height = props.height
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.clearRect(0, 0, props.width, props.height)
  drawPlayInserts(
    ctx,
    props.inserts,
    time,
    props.brand.fontId,
    props.brand.logo,
    assets.stickers,
    (src) => {
      if (src !== props.brand.logo) return null
      const logo = assets.logo
      if (logo && logo.naturalWidth > 0) return logo
      return null
    },
    props.captionPreset,
    props.captionStyle,
    {
      fps: props.fps,
      videoDuration: props.video.sourceDurationInSeconds ?? props.video.durationInSeconds,
      project: props.styleRef ? { styleRef: props.styleRef } : {},
      tracks: props.tracks,
      customPresets: props.customPresets ? Object.values(props.customPresets) : undefined,
      productData: props.productData,
      brandKitId: props.brandKitId,
      brandColors: props.brandColors,
    },
    props.watermark ?? null,
  )
}

export function InsertRenderer({
  props,
  time,
}: {
  props: RenderProps
  time: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const assetsRef = useRef<{
    stickers: Map<string, HTMLImageElement>
    logo: HTMLImageElement | null
  } | null>(null)
  const timeRef = useRef(time)
  timeRef.current = time

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handle = delayRender("inserts-assets")
    let cancelled = false

    void (async () => {
      try {
        await waitForRenderFonts(props)
        if (cancelled) return
        const assets = await loadAssets(props)
        if (cancelled) return
        assetsRef.current = assets
        paintInserts(canvas, props, timeRef.current, assets)
      } finally {
        continueRender(handle)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [props])

  useEffect(() => {
    const canvas = canvasRef.current
    const assets = assetsRef.current
    if (!canvas || !assets) return
    paintInserts(canvas, props, time, assets)
  }, [props, time])

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <canvas
        ref={canvasRef}
        width={props.width}
        height={props.height}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: props.width,
          height: props.height,
          display: "block",
        }}
      />
    </AbsoluteFill>
  )
}
