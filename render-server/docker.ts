import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export function dockerDesktopRunning(processList: string): boolean {
  return /Docker Desktop|com\.docker\.backend|com\.docker\.virtualization|com\.docker\.hypervisor/i.test(
    processList,
  )
}

export function dockerWarning(running: boolean): string | null {
  if (!running) return null
  return "Docker Desktop está rodando e consome ~4 GB de RAM; o render pode ficar mais lento."
}

export async function listProcessNames(): Promise<string> {
  try {
    const { stdout } = await execFileAsync("ps", ["-ax", "-o", "comm="], {
      timeout: 2000,
    })
    return stdout
  } catch {
    return ""
  }
}

export async function detectDockerDesktop(): Promise<boolean> {
  return dockerDesktopRunning(await listProcessNames())
}
