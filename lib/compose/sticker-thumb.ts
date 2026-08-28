import { crc32, deflateSync, inflateSync } from "node:zlib"

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

type DecodedPng = {
  width: number
  height: number
  rgba: Buffer
}

function readChunk(buf: Buffer, offset: number) {
  const length = buf.readUInt32BE(offset)
  const type = buf.subarray(offset + 4, offset + 8).toString("ascii")
  const data = buf.subarray(offset + 8, offset + 8 + length)
  return { length, type, data, next: offset + 12 + length }
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function unfilterRow(filter: number, row: Buffer, prev: Buffer | null, bpp: number): Buffer {
  const out = Buffer.alloc(row.length)
  for (let i = 0; i < row.length; i += 1) {
    const x = row[i] ?? 0
    const a = i >= bpp ? (out[i - bpp] ?? 0) : 0
    const b = prev ? (prev[i] ?? 0) : 0
    const c = prev && i >= bpp ? (prev[i - bpp] ?? 0) : 0
    let val = x
    if (filter === 1) val = x + a
    else if (filter === 2) val = x + b
    else if (filter === 3) val = x + Math.floor((a + b) / 2)
    else if (filter === 4) val = x + paeth(a, b, c)
    else if (filter !== 0) throw new Error("png filter")
    out[i] = val & 255
  }
  return out
}

function decodePng(buf: Buffer): DecodedPng | null {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIG)) return null
  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idat: Buffer[] = []
  let palette: Buffer | null = null
  let trns: Buffer | null = null
  try {
    while (offset + 12 <= buf.length) {
      const chunk = readChunk(buf, offset)
      offset = chunk.next
      if (chunk.type === "IHDR") {
        width = chunk.data.readUInt32BE(0)
        height = chunk.data.readUInt32BE(4)
        bitDepth = chunk.data[8] ?? 0
        colorType = chunk.data[9] ?? 0
        interlace = chunk.data[12] ?? 0
      } else if (chunk.type === "PLTE") {
        palette = chunk.data
      } else if (chunk.type === "tRNS") {
        trns = chunk.data
      } else if (chunk.type === "IDAT") {
        idat.push(chunk.data)
      } else if (chunk.type === "IEND") {
        break
      }
    }
    if (!(width > 0) || !(height > 0) || bitDepth !== 8 || interlace !== 0) return null
    if (colorType !== 2 && colorType !== 3 && colorType !== 6) return null
    const inflated = inflateSync(Buffer.concat(idat))
    const samples = colorType === 6 ? 4 : colorType === 2 ? 3 : 1
    const stride = width * samples
    const rows: Buffer[] = []
    let cursor = 0
    let prev: Buffer | null = null
    for (let y = 0; y < height; y += 1) {
      const filter = inflated[cursor] ?? 0
      cursor += 1
      const raw = inflated.subarray(cursor, cursor + stride)
      cursor += stride
      const recon = unfilterRow(filter, raw, prev, samples)
      rows.push(recon)
      prev = recon
    }
    const rgba = Buffer.alloc(width * height * 4)
    for (let y = 0; y < height; y += 1) {
      const row = rows[y]
      if (!row) continue
      for (let x = 0; x < width; x += 1) {
        const dest = (y * width + x) * 4
        if (colorType === 6) {
          rgba[dest] = row[x * 4] ?? 0
          rgba[dest + 1] = row[x * 4 + 1] ?? 0
          rgba[dest + 2] = row[x * 4 + 2] ?? 0
          rgba[dest + 3] = row[x * 4 + 3] ?? 255
        } else if (colorType === 2) {
          rgba[dest] = row[x * 3] ?? 0
          rgba[dest + 1] = row[x * 3 + 1] ?? 0
          rgba[dest + 2] = row[x * 3 + 2] ?? 0
          rgba[dest + 3] = 255
        } else {
          const index = row[x] ?? 0
          rgba[dest] = palette?.[index * 3] ?? 0
          rgba[dest + 1] = palette?.[index * 3 + 1] ?? 0
          rgba[dest + 2] = palette?.[index * 3 + 2] ?? 0
          rgba[dest + 3] = trns?.[index] ?? 255
        }
      }
    }
    return { width, height, rgba }
  } catch {
    return null
  }
}

function writeChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, "ascii")
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0)
  return Buffer.concat([length, typeBuf, data, crc])
}

export function encodeRgbaPng(width: number, height: number, rgba: Buffer): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const rows = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y += 1) {
    const offset = y * (1 + width * 4)
    rows[offset] = 0
    rgba.copy(rows, offset + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    PNG_SIG,
    writeChunk("IHDR", ihdr),
    writeChunk("IDAT", deflateSync(rows)),
    writeChunk("IEND", Buffer.alloc(0)),
  ])
}

function resizeNearest(src: DecodedPng, targetWidth: number): DecodedPng {
  const width = Math.max(1, Math.round(targetWidth))
  const scale = src.width / width
  const height = Math.max(1, Math.round(src.height / scale))
  const rgba = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    const srcY = Math.min(src.height - 1, Math.floor(y * scale))
    for (let x = 0; x < width; x += 1) {
      const srcX = Math.min(src.width - 1, Math.floor(x * scale))
      const from = (srcY * src.width + srcX) * 4
      const to = (y * width + x) * 4
      src.rgba.copy(rgba, to, from, from + 4)
    }
  }
  return { width, height, rgba }
}

export function pngThumbnail(input: Buffer, targetWidth: number): Buffer | null {
  if (!(targetWidth > 0) || targetWidth > 640) return null
  const decoded = decodePng(input)
  if (!decoded) return null
  if (decoded.width <= targetWidth) return encodeRgbaPng(decoded.width, decoded.height, decoded.rgba)
  const resized = resizeNearest(decoded, targetWidth)
  return encodeRgbaPng(resized.width, resized.height, resized.rgba)
}
