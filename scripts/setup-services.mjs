import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "dotenv";
import { generateVAPIDKeys } from "web-push";

export async function setupServices(root = process.cwd()) {
  const target = path.join(root, ".env");
  let source;
  try {
    source = await readFile(target, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    source = await readFile(path.join(root, ".env.example"), "utf8");
  }
  const current = parse(source);
  const template = parse(
    await readFile(path.join(root, ".env.example"), "utf8"),
  );
  for (const [key, value] of Object.entries(template)) {
    if (!(key in current)) {
      source += `\n${key}=${value}`;
      current[key] = value;
    }
  }
  if (Boolean(current.VAPID_PUBLIC_KEY) !== Boolean(current.VAPID_PRIVATE_KEY))
    throw new Error(
      "Both existing VAPID keys are required; restore the matching pair before setup.",
    );
  if (!current.VAPID_PUBLIC_KEY) {
    const pair = generateVAPIDKeys();
    for (const [key, value] of [
      ["VAPID_PUBLIC_KEY", pair.publicKey],
      ["VAPID_PRIVATE_KEY", pair.privateKey],
    ]) {
      const line = new RegExp(`^${key}=.*$`, "m");
      source = line.test(source)
        ? source.replace(line, `${key}=${value}`)
        : source + `\n${key}=${value}`;
    }
  }
  await writeFile(target, source, { mode: 0o600 });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await setupServices();
  console.log(
    "Local .env prepared. Existing settings preserved; VAPID keys remain private. Complete provider settings before starting services.",
  );
}
