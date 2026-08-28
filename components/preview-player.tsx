"use client"

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react"
import { Player, type PlayerRef } from "@remotion/player"

import { Short } from "../remotion/Short.tsx"
import { calculateShortMetadata, type RenderProps } from "../remotion/types.ts"

export type PreviewPlayerHandle = {
  play: () => void
  pause: () => void
  seekToFrame: (frame: number) => void
  isPlaying: () => boolean
  getContainerNode: () => HTMLElement | null
}

export const PreviewPlayer = forwardRef<
  PreviewPlayerHandle,
  {
    renderProps: RenderProps
    onFrame: (frame: number) => void
    onPlayingChange: (playing: boolean) => void
  }
>(function PreviewPlayer({ renderProps, onFrame, onPlayingChange }, ref) {
  const playerRef = useRef<PlayerRef>(null)
  const meta = useMemo(
    () => calculateShortMetadata(renderProps),
    [renderProps],
  )

  useImperativeHandle(ref, () => ({
    play: () => {
      playerRef.current?.play()
    },
    pause: () => {
      playerRef.current?.pause()
    },
    seekToFrame: (frame: number) => {
      playerRef.current?.seekTo(Math.max(0, frame))
    },
    isPlaying: () => playerRef.current?.isPlaying() ?? false,
    getContainerNode: () => playerRef.current?.getContainerNode() ?? null,
  }))

  useEffect(() => {
    const player = playerRef.current
    if (!player) return

    const handleFrame = (event: { detail: { frame: number } }) => {
      onFrame(event.detail.frame)
    }
    const handlePlay = () => onPlayingChange(true)
    const handlePause = () => onPlayingChange(false)
    const handleEnded = () => onPlayingChange(false)

    player.addEventListener("frameupdate", handleFrame)
    player.addEventListener("play", handlePlay)
    player.addEventListener("pause", handlePause)
    player.addEventListener("ended", handleEnded)
    return () => {
      player.removeEventListener("frameupdate", handleFrame)
      player.removeEventListener("play", handlePlay)
      player.removeEventListener("pause", handlePause)
      player.removeEventListener("ended", handleEnded)
    }
  }, [onFrame, onPlayingChange])

  return (
    <Player
      ref={playerRef}
      component={Short}
      inputProps={renderProps as RenderProps & Record<string, unknown>}
      durationInFrames={meta.durationInFrames}
      fps={meta.fps}
      compositionWidth={meta.width}
      compositionHeight={meta.height}
      acknowledgeRemotionLicense
      controls={false}
      clickToPlay={false}
      doubleClickToFullscreen={false}
      spaceKeyToPlayOrPause={false}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "#000",
      }}
    />
  )
})
