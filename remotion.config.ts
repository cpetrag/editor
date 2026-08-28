import path from "node:path"
import { Config } from "@remotion/cli/config"

Config.setVideoImageFormat("jpeg")
Config.setConcurrency(3)
Config.setChromiumOpenGlRenderer("angle")
Config.setCrf(18)
Config.setWebpackPollingInMilliseconds(1000)

Config.overrideWebpackConfig((current) => ({
  ...current,
  resolve: {
    ...current.resolve,
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".ts": [".ts", ".tsx"],
      ".tsx": [".tsx"],
    },
    alias: {
      ...(typeof current.resolve?.alias === "object" && current.resolve.alias
        ? current.resolve.alias
        : {}),
      "@": path.join(process.cwd()),
    },
  },
}))
