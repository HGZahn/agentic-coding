#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = join(root, ".pi", "skills");
const lockPath = join(root, "skills-lock.json");

async function lockfile() {
  return JSON.parse(await readFile(lockPath, "utf8"));
}

async function filesUnder(base, current = base) {
  const output = [];
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const path = join(current, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(base, path));
    else if (entry.isFile()) output.push({ path, relative: relative(base, path).split("\\").join("/") });
  }
  return output;
}

async function hashSkill(name) {
  const hash = createHash("sha256");
  for (const file of await filesUnder(join(skillsDir, name))) {
    hash.update(file.relative);
    hash.update(await readFile(file.path));
  }
  return hash.digest("hex");
}

async function verify() {
  const lock = await lockfile();
  const locked = Object.keys(lock.skills ?? {}).sort();
  const installed = (await readdir(skillsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const errors = [];

  if (lock.version !== 1) errors.push(`Unsupported lockfile version: ${lock.version}`);
  if (locked.join("\n") !== installed.join("\n")) errors.push("Lock entries and .pi/skills directories differ");

  for (const name of locked) {
    const skillPath = join(skillsDir, name, "SKILL.md");
    let text;
    try {
      text = await readFile(skillPath, "utf8");
    } catch {
      errors.push(`${name}: missing SKILL.md`);
      continue;
    }
    const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatter) errors.push(`${name}: missing YAML frontmatter`);
    if (!/^name:\s*\S+/m.test(frontmatter?.[1] ?? "")) errors.push(`${name}: missing name`);
    if (!/^description:\s*(?:\S|$)/m.test(frontmatter?.[1] ?? "")) errors.push(`${name}: missing description`);

    const actual = await hashSkill(name);
    if (!lock.skills[name].computedHash) errors.push(`${name}: empty computedHash`);
    else if (actual !== lock.skills[name].computedHash) errors.push(`${name}: hash mismatch`);
  }

  if (errors.length) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Verified ${locked.length} skills.`);
}

async function rehash(lock) {
  lock ??= await lockfile();
  const sorted = {};
  for (const name of Object.keys(lock.skills ?? {}).sort()) {
    sorted[name] = { ...lock.skills[name], computedHash: await hashSkill(name) };
  }
  await writeFile(lockPath, `${JSON.stringify({ version: 1, skills: sorted }, null, 2)}\n`);
  console.log(`Rehashed ${Object.keys(sorted).length} skills.`);
}

const [command = "verify"] = process.argv.slice(2);
try {
  if (command === "verify") await verify();
  else if (command === "rehash") await rehash();
  else throw new Error(`Usage: scripts/skills.mjs verify|rehash`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
