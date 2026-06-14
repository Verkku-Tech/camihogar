#!/usr/bin/env node
/**
 * Genera version.json, .env.local (NEXT_PUBLIC_APP_VERSION) y public/sw.js desde sw.template.js
 */
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

function pad(n) {
  return String(n).padStart(2, "0")
}

function getGitSha() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return "local"
  }
}

function buildVersion() {
  const envVersion = process.env.NEXT_PUBLIC_APP_VERSION?.trim()
  if (envVersion) return envVersion

  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `${stamp}-${getGitSha()}`
}

const version = buildVersion()
const builtAt = new Date().toISOString()

const versionJsonPath = path.join(root, "public", "version.json")
fs.writeFileSync(
  versionJsonPath,
  JSON.stringify({ version, builtAt }, null, 2) + "\n",
  "utf8",
)

const templatePath = path.join(root, "public", "sw.template.js")
const swPath = path.join(root, "public", "sw.js")
const template = fs.readFileSync(templatePath, "utf8")
const swContent = template.replaceAll("__APP_VERSION__", version)
fs.writeFileSync(swPath, swContent, "utf8")

const envLocalPath = path.join(root, ".env.local")
const envLine = `NEXT_PUBLIC_APP_VERSION=${version}`
let envContent = ""

if (fs.existsSync(envLocalPath)) {
  envContent = fs.readFileSync(envLocalPath, "utf8")
  if (/^NEXT_PUBLIC_APP_VERSION=/m.test(envContent)) {
    envContent = envContent.replace(
      /^NEXT_PUBLIC_APP_VERSION=.*$/m,
      envLine,
    )
  } else {
    envContent = envContent.trimEnd() + `\n${envLine}\n`
  }
} else {
  envContent = `${envLine}\n`
}

fs.writeFileSync(envLocalPath, envContent, "utf8")

console.log(`[generate-app-version] version=${version}`)
