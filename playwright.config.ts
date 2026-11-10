import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "tests",
  timeout: 120_000,
  use: {
    baseURL: process.env.EDITOR_URL || "http://127.0.0.1:4013",
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  },
})
