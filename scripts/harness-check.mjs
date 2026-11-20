#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { checkServerModuleBoundaries } from './server-module-boundaries.mjs'
import { hasManagedMcpNodeMode } from './managed-mcp-harness.mjs'
import { checkDshModuleBoundaries } from './dsh-module-harness.mjs'
import { checkCodingAgentModuleBoundaries } from './coding-agent-module-harness.mjs'
import { checkJevIntegrations } from './jev-harness.mjs'
import { checkUiTheme } from './ui-theme-harness.mjs'
import { checkPluginDocs } from './plugin-docs-harness.mjs'
import { checkTaskArtifacts } from './task-artifacts.mjs'

const root = process.cwd()
const failures = []
try { await checkPluginDocs(root) } catch (error) { failures.push(error.message) }
failures.push(...await checkTaskArtifacts(root))
failures.push(...await checkDshModuleBoundaries(root))
failures.push(...await checkCodingAgentModuleBoundaries(root))
failures.push(...await checkJevIntegrations(root))
failures.push(...await checkUiTheme(root))

function fail(message) {
  failures.push(message)
}

async function readText(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8')
}

function requireFile(relativePath) {
  if (!existsSync(path.join(root, relativePath))) {
    fail(`Missing required harness file: ${relativePath}`)
  }
}

function requireDir(relativePath) {
  if (!existsSync(path.join(root, relativePath))) {
    fail(`Missing required project directory: ${relativePath}`)
  }
}

for (const file of [
  'AGENTS.md',
  'ARCHITECTURE.md',
  'DEVELOPMENT.md',
  'docs/harness/README.md',
  'docs/harness/validation.md',
  'docs/harness/worktree-runbook.md',
  'docs/harness/server-module-boundaries.md',
  'docs/harness/jev-integrations.md',
  'scripts/jev-integrations.json',
  'docs/harness/frontend-ui.md',
  'scripts/ui-theme-baseline.json',
  'docs/harness/task-artifacts.md',
  'scripts/task-artifacts.mjs',
  'scripts/task-artifacts-cli.mjs',
]) {
  requireFile(file)
}

for (const dir of [
  'packages/client/src',
  'packages/server/src',
  '.github/workflows',
]) {
  requireDir(dir)
}

const agents = await readText('AGENTS.md')
const agentLines = agents.trimEnd().split(/\r?\n/)
if (agentLines.length > 120) {
  fail(`AGENTS.md should stay short; found ${agentLines.length} lines, expected <= 120`)
}

for (const requiredLink of [
  'DEVELOPMENT.md',
  'ARCHITECTURE.md',
  'docs/harness/README.md',
  'docs/harness/validation.md',
  'docs/harness/worktree-runbook.md',
]) {
  if (!agents.includes(requiredLink)) {
    fail(`AGENTS.md must link to ${requiredLink}`)
  }
}

if (!agents.includes('docs/harness/frontend-ui.md')) {
  fail('AGENTS.md must link to docs/harness/frontend-ui.md')
}

const packageJson = JSON.parse(await readText('package.json'))
for (const scriptName of [
  'harness:check',
  'test',
  'test:coverage',
  'test:e2e',
  'build',
]) {
  if (!packageJson.scripts?.[scriptName]) {
    fail(`package.json is missing script: ${scriptName}`)
  }
}

const architecture = await readText('ARCHITECTURE.md')
for (const phrase of [
  'packages/client/src',
  'packages/server/src',
  'HERMES_WEB_UI_HOME',
]) {
  if (!architecture.includes(phrase)) {
    fail(`ARCHITECTURE.md should document: ${phrase}`)
  }
}

const buildWorkflow = await readText('.github/workflows/build.yml')
if (!buildWorkflow.includes('npm run harness:check')) {
  fail('Build workflow must run npm run harness:check')
}

for (const failure of await checkServerModuleBoundaries(root)) {
  fail(failure)
}

for (const [file, factory] of [
  ['packages/server/src/modules/hermes/services/mcp/studio-autoinject.ts', 'managedConfig'],
  ['packages/server/src/modules/ekko/services/mcp.ts', 'managedMcpServerConfig'],
  ['packages/server/src/modules/coding-agents/services/index.ts', 'hermesMcpServerConfig'],
]) {
  if (!hasManagedMcpNodeMode(await readText(file), factory)) {
    fail(`${file}: ${factory} must inject ELECTRON_RUN_AS_NODE: '1' into every managed MCP env; Electron fallback must not launch the desktop GUI`)
  }
}

const webuiReleaseWorkflow = await readText('.github/workflows/webui-release.yml')
const dockerPublishWorkflow = await readText('.github/workflows/docker-publish.yml')

for (const [file, text] of [
  ['webui-release.yml', webuiReleaseWorkflow],
  ['docker-publish.yml', dockerPublishWorkflow],
]) {
  if (!text.includes('release:') || !text.includes('types: [published]')) {
    fail(`${file} must keep running on published GitHub Releases`)
  }
  if (!text.includes('gh release edit "$TAG" --repo "$GITHUB_REPOSITORY" --latest=false')) {
    fail(`${file} must keep published GitHub Releases out of latest`)
  }
}

if (!webuiReleaseWorkflow.includes('make_latest: false')) {
  fail('webui-release.yml must not mark release uploads as GitHub latest')
}


if (failures.length > 0) {
  console.error('Harness check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Harness check passed')
