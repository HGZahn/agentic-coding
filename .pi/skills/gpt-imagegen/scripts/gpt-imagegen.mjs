#!/usr/bin/env node

import fs from "node:fs/promises"
import fsSync from "node:fs"
import path from "node:path"
import os from "node:os"

const CODEX_RESPONSES_ENDPOINT = "https://chatgpt.com/backend-api/codex/responses"
const SUBSCRIPTION_MODEL = "gpt-5.5"
const MAX_OUTPUT_VERSION_SUFFIX = 999

const QUALITY_VALUES = new Set(["low", "medium", "high", "auto"])
const SIZE_PATTERN = /^\d+x\d+$/

function usage(error) {
  const text = `Usage:
  gpt-imagegen.mjs "<prompt>" [--out PATH] [--size WIDTHxHEIGHT] [--quality low|medium|high|auto] [--image PATH ...]

Options:
  --out PATH          Output PNG file path (default: generated.png)
  --size WxH          Optional image size request
  --quality VALUE     one of: low, medium, high, auto (default: auto)
  --image PATH        Reference image; can be repeated
  --help, -h          Show this message
`

  if (error) {
    console.error(error)
    console.error(text)
    process.exit(1)
  }

  console.log(text)
  process.exit(0)
}

function parseArgs(argv) {
  const args = {
    promptParts: [],
    out: "generated.png",
    size: undefined,
    quality: "auto",
    images: [],
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === "-h" || arg === "--help") usage()

    if (arg === "--out" || arg === "--output") {
      const value = argv[i + 1]
      if (!value || value.startsWith("-")) throw new Error("--out requires a path")
      args.out = value
      i += 1
      continue
    }
    if (arg.startsWith("--out=")) {
      args.out = arg.slice(6)
      continue
    }

    if (arg === "--size") {
      const value = argv[i + 1]
      if (!value || !SIZE_PATTERN.test(value)) throw new Error("--size must be WIDTHxHEIGHT")
      args.size = value
      i += 1
      continue
    }
    if (arg.startsWith("--size=")) {
      const value = arg.slice(7)
      if (!SIZE_PATTERN.test(value)) throw new Error("--size must be WIDTHxHEIGHT")
      args.size = value
      continue
    }

    if (arg === "--quality") {
      const value = argv[i + 1]
      if (!QUALITY_VALUES.has(value)) throw new Error("--quality must be one of: low, medium, high, auto")
      args.quality = value
      i += 1
      continue
    }
    if (arg.startsWith("--quality=")) {
      const value = arg.slice(10)
      if (!QUALITY_VALUES.has(value)) throw new Error("--quality must be one of: low, medium, high, auto")
      args.quality = value
      continue
    }

    if (arg === "--image") {
      const value = argv[i + 1]
      if (!value) throw new Error("--image requires a path")
      args.images.push(value)
      i += 1
      continue
    }
    if (arg.startsWith("--image=")) {
      args.images.push(arg.slice(8))
      continue
    }

    if (arg.startsWith("--")) throw new Error(`unknown option: ${arg}`)

    args.promptParts.push(arg)
  }

  const prompt = args.promptParts.join(" ").trim()
  if (!prompt) throw new Error("prompt is required")
  args.prompt = prompt

  return args
}

function inferImageMime(buf, filePath) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png"
  if (buf.length >= 3 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif"
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp"
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg"
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) return "image/bmp"

  const ext = path.extname(filePath).toLowerCase()
  const extMimeMap = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp" }
  return extMimeMap[ext] || "application/octet-stream"
}

async function readImageAsDataUrl(inputPath, cwd) {
  const abs = path.isAbsolute(inputPath) ? inputPath : path.resolve(cwd, inputPath)
  const buf = await fs.readFile(abs)
  const mime = inferImageMime(buf, abs)
  if (!mime.startsWith("image/")) throw new Error(`unsupported image file type: ${abs}`)
  return `data:${mime};base64,${buf.toString("base64")}`
}

async function fileExists(filePath) {
  try { await fs.access(filePath); return true } catch { return false }
}

async function pickNonOverwritePath(requested) {
  if (!(await fileExists(requested))) return requested
  const dir = path.dirname(requested)
  const ext = path.extname(requested) || ".png"
  const stem = path.basename(requested, path.extname(requested))
  for (let n = 2; n <= MAX_OUTPUT_VERSION_SUFFIX; n++) {
    const candidate = path.join(dir, `${stem}-v${n}${ext}`)
    if (!(await fileExists(candidate))) return candidate
  }
  throw new Error(`could not find a non-conflicting filename under ${dir}/${stem}-vN${ext} (tried up to v${MAX_OUTPUT_VERSION_SUFFIX})`)
}

async function saveGeneratedImage(out, cwd, base64) {
  const requested = path.isAbsolute(out) ? out : path.resolve(cwd, out)
  const requestedPng = path.extname(requested) ? requested : `${requested}.png`
  const savedPath = await pickNonOverwritePath(requestedPng)
  await fs.mkdir(path.dirname(savedPath), { recursive: true })
  await fs.writeFile(savedPath, Buffer.from(base64, "base64"))
  return { savedPath, requested: requestedPng, versioned: savedPath !== requestedPng }
}

async function loadCodexAuth() {
  if (process.env.OPENCODE_AUTH_CONTENT) {
    const parsed = JSON.parse(process.env.OPENCODE_AUTH_CONTENT)
    const auth = parsed?.openai
    if (auth?.type === "oauth" && typeof auth?.access === "string") return auth
  }

  const baseDir = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share")
  const authPath = path.join(baseDir, "opencode", "auth.json")
  if (!fsSync.existsSync(authPath)) return undefined
  const raw = await fs.readFile(authPath, "utf-8")
  const parsed = JSON.parse(raw)
  const auth = parsed?.openai
  if (auth?.type === "oauth" && typeof auth?.access === "string") return auth
  return undefined
}

async function parseImageFromSSE(stream) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ""

    for (const line of lines) {
      if (!line.startsWith("data:")) continue
      const raw = line.slice(5).trim()
      if (!raw || raw === "[DONE]") continue

      try {
        const event = JSON.parse(raw)
        if (
          event?.type === "response.output_item.done" &&
          event.item?.type === "image_generation_call" &&
          typeof event.item.result === "string" &&
          event.item.result.length > 0
        ) {
          return event.item.result
        }
      } catch { continue }
    }
  }

  throw new Error("no image_generation result returned by codex backend")
}

async function generateImage(auth, args, inputDataUrls) {
  const userContent = [{ type: "input_text", text: args.prompt }]
  for (const dataUrl of inputDataUrls) {
    userContent.push({ type: "input_image", image_url: dataUrl })
  }

  const body = {
    model: SUBSCRIPTION_MODEL,
    instructions: "You are an image generation assistant. Always satisfy the request by invoking the image_generation tool exactly once. Do not respond with text only.",
    input: [{ role: "user", content: userContent }],
    tools: [{
      type: "image_generation",
      output_format: "png",
      quality: args.quality,
      ...(args.size ? { size: args.size } : {}),
    }],
    tool_choice: { type: "image_generation" },
    stream: true,
    store: false,
  }

  const res = await fetch(CODEX_RESPONSES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.access}`,
      ...(auth.accountId ? { "ChatGPT-Account-Id": auth.accountId } : {}),
      originator: "opencode",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok || !res.body) {
    const detail = (await res.text().catch(() => "")).slice(0, 500)
    if (res.status === 429) {
      try {
        const j = JSON.parse(detail)
        const err = j?.error
        if (err?.type === "usage_limit_reached") {
          const plan = err.plan_type || "chatgpt"
          const secs = Number(err.resets_in_seconds)
          let when = "an unknown amount of time"
          if (Number.isFinite(secs) && secs > 0) {
            const days = Math.floor(secs / 86400)
            const hours = Math.floor((secs % 86400) / 3600)
            const mins = Math.floor((secs % 3600) / 60)
            const parts = []
            if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`)
            if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`)
            if (!days && mins) parts.push(`${mins} minute${mins === 1 ? "" : "s"}`)
            when = parts.join(" ") || `${secs} seconds`
          }
          const at = Number(err.resets_at)
          const atStr = Number.isFinite(at) && at > 0 ? ` (around ${new Date(at * 1000).toISOString().replace("T", " ").slice(0, 16)} UTC)` : ""
          throw new Error(`ChatGPT ${plan} image generation quota is exhausted. Resets in ~${when}${atStr}. Re-authenticate or wait for reset. (${detail})`)
        }
      } catch (e) {
        if (e instanceof Error && /quota is exhausted/.test(e.message)) throw e
      }
    }
    throw new Error(`codex responses request failed: ${res.status} ${detail}`)
  }

  return parseImageFromSSE(res.body)
}

async function main() {
  let args
  try { args = parseArgs(process.argv.slice(2)) } catch (error) { usage(error.message) }

  const cwd = process.cwd()
  const auth = await loadCodexAuth()
  if (!auth) throw new Error("ChatGPT OAuth credentials not found. Authenticate with OpenCode first (auth.json or OPENCODE_AUTH_CONTENT).")

  const referenceImages = []
  for (const imagePath of args.images) {
    referenceImages.push(await readImageAsDataUrl(imagePath, cwd))
  }

  const base64 = await generateImage(auth, args, referenceImages)
  const { savedPath, requested, versioned } = await saveGeneratedImage(args.out, cwd, base64)

  if (versioned) console.error(`Requested output ${requested} exists; saved to ${savedPath} instead.`)
  process.stdout.write(`${savedPath}\n`)
}

await main()
