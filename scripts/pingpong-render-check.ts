/**
 * Render Final de verdade: clipe de 6 s com timecode + locução de 13,5 s,
 * ping-pong a 0,85×. Confere a duração e se o quadro em 7,5 s repete a ida.
 *
 * Roda no Mac, com o editor-render no ar:
 *   node --experimental-strip-types scripts/pingpong-render-check.ts
 */
import { spawn } from "node:child_process"
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { buildVideoTimeline, outputTimeForSource, sourceTimeAtOutput } from "../lib/video/timeline.ts"
import { defaultCompositionAudio } from "../lib/audio/types.ts"
import type { RenderProps } from "../remotion/types.ts"

const RENDER = process.env.RENDER_URL?.replace(/\/$/, "") || "http://127.0.0.1:4014"
const FPS = 30
const VIDEO_SECONDS = 6
const VOICE_SECONDS = 13.5
const BARS = 8
const BAR = 32

/** O ffmpeg do Mac não tem drawtext. Cada quadro ganha o número do frame em barras. */
function timecodeFilter(): string {
  const width = BARS * BAR
  const on = `gte(mod(floor(N/pow(2,floor((X-8)/${BAR}))),2),1)`
  const inside = `lt(Y,80)*between(X,8,${8 + width})`
  return [
    `lum='if(${inside},if(${on},235,16),lum(X,Y))'`,
    `cb='if(${inside},128,cb(X,Y))'`,
    `cr='if(${inside},128,cr(X,Y))'`,
  ].join(":")
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, ["-hide_banner", "-loglevel", "error", ...args], {
      stdio: ["ignore", "inherit", "inherit"],
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} saiu com ${code}`))
    })
  })
}

function probe(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=duration",
        "-of",
        "default=nw=1:nk=1",
        filePath,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
    let out = ""
    child.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString()
    })
    child.on("close", (code) => {
      const value = Number(out.trim())
      if (code === 0 && value > 0) resolve(value)
      else reject(new Error(`ffprobe falhou em ${filePath}`))
    })
  })
}

function readBurnedFrame(pngPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-v",
        "error",
        "-i",
        pngPath,
        "-vf",
        `crop=${BARS * BAR}:80:8:0,scale=${BARS}:1:flags=neighbor`,
        "-f",
        "rawvideo",
        "-pix_fmt",
        "gray",
        "-",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
    const chunks: Buffer[] = []
    let err = ""
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk))
    child.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString()
    })
    child.on("close", (code) => {
      const bytes = Buffer.concat(chunks)
      if (code !== 0 || bytes.length < BARS) {
        reject(new Error(err.trim() || "não leu o timecode"))
        return
      }
      let frame = 0
      for (let bit = 0; bit < BARS; bit += 1) {
        if ((bytes[bit] ?? 0) > 128) frame += 1 << bit
      }
      resolve(frame)
    })
  })
}

async function frameDiff(a: string, b: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-i",
        a,
        "-i",
        b,
        "-filter_complex",
        "blend=all_mode=difference,signalstats,metadata=print:file=-",
        "-f",
        "null",
        "-",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
    let text = ""
    child.stdout.on("data", (chunk: Buffer) => {
      text += chunk.toString()
    })
    child.stderr.on("data", (chunk: Buffer) => {
      text += chunk.toString()
    })
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error("não foi possível comparar os quadros"))
        return
      }
      const match = text.match(/lavfi\.signalstats\.YAVG=([0-9.]+)/)
      resolve(match ? Number(match[1]) : Number.NaN)
    })
  })
}

function props(): RenderProps {
  const audio = defaultCompositionAudio()
  return {
    video: {
      src: "http://127.0.0.1/clip.mp4",
      durationInSeconds: 37.59,
      sourceDurationInSeconds: VIDEO_SECONDS,
      sourceFps: FPS,
      usefulDuration: VIDEO_SECONDS,
      usefulStart: 0,
      width: 576,
      height: 1024,
      playback: { speed: 0.85, fill: "pingpong", fit: "audio" },
    },
    audio: {
      ...audio,
      tracks: [
        {
          id: "voice",
          kind: "voice",
          fileId: "voice",
          fileName: "voice.mp3",
          duration: VOICE_SECONDS,
          start: 0,
          trimIn: 0,
          trimOut: VOICE_SECONDS,
          volume: 1,
          fadeIn: 0,
          fadeOut: 0,
          loop: false,
          muted: false,
          src: "",
        },
      ],
    },
    fps: FPS,
    width: 576,
    height: 1024,
    inserts: [],
    brand: { fontId: "geist", logo: "" },
    captionPreset: "viral",
    captionStyle: {
      x: 50,
      y: 72,
      fontSize: 64,
      maxWidthPct: 84,
      fontFamily: "geist",
      fontWeight: 800,
      color: "#FFFFFF",
      highlightColor: "#FFE500",
      bgColor: "rgba(0,0,0,0.72)",
      strokeColor: "#000000",
      strokeWidth: 6,
      rotation: 0,
    },
    stickerSrcs: {},
  }
}

async function main(): Promise<void> {
  const dir = await mkdtemp(path.join(tmpdir(), "pingpong-check-"))
  const clip = path.join(dir, "clip.mp4")
  const voice = path.join(dir, "voice.mp3")
  const output = path.join(dir, "final.mp4")
  await run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `testsrc2=duration=${VIDEO_SECONDS}:size=576x1024:rate=${FPS}`,
    "-vf",
    `geq=${timecodeFilter()}`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    clip,
  ])
  await run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=440:duration=${VOICE_SECONDS}`,
    "-c:a",
    "libmp3lame",
    voice,
  ])

  const timeline = buildVideoTimeline(
    { duration: VIDEO_SECONDS, fps: FPS },
    { speed: 0.85, fill: "pingpong", fit: "audio" },
    VOICE_SECONDS,
  )
  const atReturn = sourceTimeAtOutput(timeline.segments, 7.5)
  const forwardOut = outputTimeForSource(timeline.segments, atReturn)
  if (forwardOut == null) throw new Error("sem ida correspondente")
  console.log(
    `linha ${timeline.duration.toFixed(3)}s ida em ${forwardOut.toFixed(3)}s = volta em 7.5s (arquivo ${atReturn.toFixed(3)}s)`,
  )
  const sample = path.join(dir, "fonte.png")
  await run("ffmpeg", ["-y", "-i", clip, "-ss", "3", "-frames:v", "1", sample])
  const burned = await readBurnedFrame(sample)
  if (Math.abs(burned - 90) > 1) {
    throw new Error(`timecode da fonte leu ${burned}, esperado 90`)
  }

  const form = new FormData()
  form.set(
    "props",
    new Blob([JSON.stringify(props())], { type: "application/json" }),
    "props.json",
  )
  form.set("video", new Blob([await readFile(clip)], { type: "video/mp4" }), "clip.mp4")
  form.set("audio_voice", new Blob([await readFile(voice)], { type: "audio/mpeg" }), "voice.mp3")
  const started = await fetch(`${RENDER}/render`, { method: "POST", body: form })
  const body = (await started.json()) as { jobId?: string; error?: string }
  if (!started.ok || !body.jobId) {
    throw new Error(body.error || `render recusou ${started.status}`)
  }
  const jobId = body.jobId
  console.log(`job ${jobId}`)
  const deadline = Date.now() + 8 * 60 * 1000
  let status = ""
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const poll = await fetch(`${RENDER}/status/${jobId}`)
    const state = (await poll.json()) as { stage?: string; error?: string; progress?: number }
    status = state.stage || ""
    console.log(`  ${status} ${Math.round((state.progress ?? 0) * 100)}%`)
    if (status === "error") throw new Error(state.error || "render falhou")
    if (status === "done") break
  }
  if (status !== "done") throw new Error("render não terminou")
  const downloaded = await fetch(`${RENDER}/download/${jobId}`)
  if (!downloaded.ok) throw new Error(`download ${downloaded.status}`)
  await writeFile(output, Buffer.from(await downloaded.arrayBuffer()))

  const duration = await probe(output)
  const expected = timeline.duration
  const drift = Math.abs(duration - expected)
  console.log(`ffprobe ${duration.toFixed(3)}s esperado ${expected.toFixed(3)}s`)
  if (drift > 1 / FPS + 0.02) {
    throw new Error(`duração ${duration.toFixed(3)} s fora de ${expected.toFixed(3)} s`)
  }

  await mkdir(path.join(dir, "frames"), { recursive: true })
  const frameAt = async (seconds: number, name: string) => {
    const file = path.join(dir, "frames", name)
    await run("ffmpeg", [
      "-y",
      "-i",
      output,
      "-ss",
      seconds.toFixed(3),
      "-frames:v",
      "1",
      file,
    ])
    return file
  }
  const going = await frameAt(forwardOut, "ida.png")
  const back = await frameAt(7.5, "volta.png")
  const early = await frameAt(3, "tres.png")
  const late = await frameAt(12, "doze.png")
  const codes = {
    ida: await readBurnedFrame(going),
    volta: await readBurnedFrame(back),
    tres: await readBurnedFrame(early),
    doze: await readBurnedFrame(late),
  }
  const expectAt = (seconds: number) => Math.round(sourceTimeAtOutput(timeline.segments, seconds) * FPS)
  console.log(
    `timecode ida ${codes.ida} volta ${codes.volta} 3s ${codes.tres} 12s ${codes.doze} (esperado volta ${expectAt(7.5)})`,
  )
  if (Math.abs(codes.volta - codes.ida) > 1) {
    throw new Error(`quadro em 7,5 s (frame ${codes.volta}) não repete a ida (frame ${codes.ida})`)
  }
  if (Math.abs(codes.volta - expectAt(7.5)) > 1) {
    throw new Error(`timecode em 7,5 s é ${codes.volta}, a linha pede ${expectAt(7.5)}`)
  }
  if (Math.abs(codes.tres - expectAt(3)) > 1) {
    throw new Error(`timecode em 3 s é ${codes.tres}, a linha pede ${expectAt(3)}`)
  }
  if (Math.abs(codes.doze - expectAt(12)) > 1) {
    throw new Error(`timecode em 12 s é ${codes.doze}, a linha pede ${expectAt(12)}`)
  }
  const same = await frameDiff(going, back)
  console.log(`diferença ida/volta ${same.toFixed(3)} OK ${output}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
