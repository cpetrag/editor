export function importFileName(title: string, platform: string): string {
  const cleaned = String(title || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
  const base = cleaned || platform || "video"
  return `${base}.mp4`
}
