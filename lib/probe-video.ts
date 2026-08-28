export async function probeVideoBlob(
  blob: Blob,
): Promise<{ duration: number; width: number; height: number }> {
  if (typeof document === "undefined") {
    throw new Error("probe indisponível")
  }
  const url = URL.createObjectURL(blob)
  try {
    const video = document.createElement("video")
    video.preload = "metadata"
    video.muted = true
    video.playsInline = true
    const info = await new Promise<{ duration: number; width: number; height: number }>(
      (resolve, reject) => {
        const fail = () => reject(new Error("não foi possível ler o vídeo"))
        video.addEventListener(
          "loadedmetadata",
          () => {
            const duration = video.duration
            if (!Number.isFinite(duration) || duration <= 0) {
              fail()
              return
            }
            resolve({
              duration,
              width: video.videoWidth || 1080,
              height: video.videoHeight || 1920,
            })
          },
          { once: true },
        )
        video.addEventListener("error", fail, { once: true })
        video.src = url
      },
    )
    video.removeAttribute("src")
    video.load()
    return info
  } finally {
    URL.revokeObjectURL(url)
  }
}
