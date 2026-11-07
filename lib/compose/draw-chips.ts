import type { ChipLayout } from "../insert-layout.ts"
import { animAt, applyAnimPose } from "./anim.ts"
import { animatedPoseAt } from "../style/anim-engine.ts"
import { drawElement } from "../elements/paint.ts"

function applyFactoryChipPose(
  ctx: CanvasRenderingContext2D,
  chip: ChipLayout,
  time: number,
  fps: number,
): void {
  const anim = chip.factoryAnim
  if (!anim) return
  const pose = animatedPoseAt({
    anim,
    indexInCard: 0,
    cardStartFrame: chip.start * fps,
    cardDurationFrames: Math.max(0, chip.duration * fps),
    frame: time * fps,
    fps,
  })
  const cx = chip.x + chip.width / 2
  const cy = chip.y + chip.height / 2
  ctx.translate(cx, cy)
  ctx.translate(pose.x, pose.y)
  const rotateX = ((pose.rotateX ?? 0) * Math.PI) / 180
  const rotateY = ((pose.rotateY ?? 0) * Math.PI) / 180
  if (rotateX !== 0 || rotateY !== 0) ctx.scale(Math.cos(rotateY), Math.cos(rotateX))
  ctx.rotate((pose.rotate * Math.PI) / 180)
  const skew = ((pose.skewX ?? 0) * Math.PI) / 180
  if (skew !== 0) ctx.transform(1, 0, Math.tan(skew), 1, 0, 0)
  ctx.scale(pose.scale * (pose.scaleX ?? 1), pose.scale * (pose.scaleY ?? 1))
  ctx.globalAlpha *= pose.opacity
  const filters: string[] = []
  if (pose.blur > 0) filters.push(`blur(${pose.blur}px)`)
  if ((pose.brightness ?? 1) !== 1) filters.push(`brightness(${pose.brightness})`)
  if (filters.length > 0) ctx.filter = filters.join(" ")
  ctx.translate(-cx, -cy)
}

export function drawChips(
  ctx: CanvasRenderingContext2D,
  chips: ChipLayout[],
  time: number,
  getLogo?: (src: string) => CanvasImageSource | null,
  fps = 30,
): void {
  for (const chip of chips) {
    const cx = chip.x + chip.width / 2
    const cy = chip.y + chip.height / 2
    ctx.save()
    if (chip.factoryAnim) {
      applyFactoryChipPose(ctx, chip, time, fps)
    } else {
      applyAnimPose(ctx, animAt(chip, time), {
        cx,
        cy,
        w: chip.width,
        h: chip.height,
      })
    }
    ctx.save()
    ctx.translate(cx, cy)
    if (chip.paint.rotation) ctx.rotate((chip.paint.rotation * Math.PI) / 180)
    ctx.globalAlpha *= chip.paint.opacity
    ctx.translate(-cx, -cy)
    drawElement(
      ctx,
      {
        id: chip.id,
        type: chip.id,
        shape: chip.shape,
        x: chip.x,
        y: chip.y,
        width: chip.width,
        height: chip.height,
        text: chip.text,
        primary: chip.primary,
        secondary: chip.secondary,
        fontFamily: chip.fontFamily,
        fontWeight: chip.paint.fontWeight,
        uppercase: chip.paint.uppercase,
        fontPx: chip.fontPx,
        radius: chip.radius,
        shadow: chip.elementShadow,
        logoSrc: chip.logoSrc,
      },
      getLogo,
    )
    ctx.restore()
    ctx.restore()
  }
}
