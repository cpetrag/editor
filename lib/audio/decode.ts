import { peaksFromChannel } from "./peaks.ts"

export async function inspectAudioBlob(blob: Blob): Promise<{ duration: number; peaks: number[] }> {
  const context = new AudioContext()
  try {
    const bytes = await blob.arrayBuffer()
    const buffer = await context.decodeAudioData(bytes.slice(0))
    return {
      duration: buffer.duration,
      peaks: peaksFromChannel(buffer.getChannelData(0), buffer.sampleRate),
    }
  } finally {
    await context.close()
  }
}

/** Recorta `trimIn..trimOut` para um WAV cujo tempo 0 é o início do recorte. */
export async function sliceAudioBlob(blob: Blob, trimIn: number, trimOut: number): Promise<Blob> {
  const context = new AudioContext()
  try {
    const bytes = await blob.arrayBuffer()
    const buffer = await context.decodeAudioData(bytes.slice(0))
    const rate = buffer.sampleRate
    const start = Math.max(0, Math.min(buffer.length, Math.floor(trimIn * rate)))
    const end = Math.max(start + 1, Math.min(buffer.length, Math.ceil(trimOut * rate)))
    const length = end - start
    const sliced = context.createBuffer(buffer.numberOfChannels, length, rate)
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      sliced.copyToChannel(buffer.getChannelData(channel).subarray(start, end), channel)
    }
    return audioBufferToWav(sliced)
  } finally {
    await context.close()
  }
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels
  const rate = buffer.sampleRate
  const length = buffer.length
  const dataSize = length * channels * 2
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const write = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index))
    }
  }
  write(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  write(8, "WAVE")
  write(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  write(36, "data")
  view.setUint32(40, dataSize, true)
  const pcm = new DataView(new ArrayBuffer(dataSize))
  const data = Array.from({ length: channels }, (_, index) => buffer.getChannelData(index))
  let offset = 0
  for (let index = 0; index < length; index += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, data[channel]?.[index] ?? 0))
      pcm.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([header, pcm.buffer], { type: "audio/wav" })
}
