function toHexByte(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0")
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`
}

export function samplePixelHex(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
): string {
  const index = (Math.floor(y) * width + Math.floor(x)) * 4
  return rgbToHex(data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0)
}
