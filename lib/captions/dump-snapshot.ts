import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import { freezeCaptionLooks } from "./freeze.ts"

const dir = dirname(fileURLToPath(import.meta.url))
writeFileSync(join(dir, "regression.snapshot.json"), `${JSON.stringify(freezeCaptionLooks(), null, 2)}\n`)
