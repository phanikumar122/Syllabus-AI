import { rm } from "node:fs/promises";
import { resolve } from "node:path";
const target = resolve("dist");
if (target !== resolve(process.cwd(), "dist"))
  throw new Error("Invalid cleanup target.");
await rm(target, { recursive: true, force: true });
