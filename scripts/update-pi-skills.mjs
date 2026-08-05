#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(await readFile(join(root, "skills-lock.json"), "utf8"));

for (const [name, { source, ref }] of Object.entries(lock.skills)) {
  if (!source) throw new Error(`${name}: missing source`);
  execFileSync("npx", [
    "skills", "add", ref ? `${source}#${ref}` : source,
    "--skill", name, "--agent", "pi", "--yes", "--full-depth",
  ], { cwd: root, stdio: "inherit" });
}
