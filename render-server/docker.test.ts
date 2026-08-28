import assert from "node:assert/strict"
import { test } from "node:test"

import { dockerDesktopRunning, dockerWarning } from "./docker.ts"

test("detecta Docker Desktop pelos nomes de processo do Mac", () => {
  assert.equal(dockerDesktopRunning("node\ncom.docker.backend\n"), true)
  assert.equal(dockerDesktopRunning("Docker Desktop\n"), true)
  assert.equal(dockerDesktopRunning("com.docker.virtualization\n"), true)
  assert.equal(dockerDesktopRunning("node\npnpm\n"), false)
})

test("aviso só existe quando o Docker está de pé", () => {
  assert.equal(dockerWarning(false), null)
  assert.match(dockerWarning(true) ?? "", /Docker/i)
})
