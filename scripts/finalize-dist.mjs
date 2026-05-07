import { rm } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const distDirectory = fileURLToPath(new URL("../dist/", import.meta.url))

await rm(join(distDirectory, "app-source.html"), { force: true })
await rm(join(distDirectory, "index.html"), { force: true })
