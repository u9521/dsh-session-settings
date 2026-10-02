#!/usr/bin/env node
/**
 * Build script:
 *   1. `tsc -p tsconfig.json` (type check + emit lib/types)
 *   2. `tsdown -c tsdown.config.mjs` (lib/index.js + lib/client.js)
 *
 * Both halves are built by this repository's own tsdown config; every build
 * dependency (tsdown, typescript, @deepseek-ai/cordis,
 * @deepseek-ai/dsh-client-ui-primitives) comes from local devDependencies.
 *
 * `--check` runs tsc --noEmit instead of emitting and bundling.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const CHECK_ONLY = process.argv.includes('--check')

/** Run a binary with cwd=root, inheriting stdio; exit the process on failure. */
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (!CHECK_ONLY) {
  rmSync(join(root, 'lib'), { recursive: true, force: true })
}
mkdirSync(join(root, 'lib'), { recursive: true })
const args = ['-p', 'tsconfig.json']
if (CHECK_ONLY) args.push('--noEmit', '--pretty', 'false')
run(process.execPath, [
  join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
  ...args,
])
if (!CHECK_ONLY) {
  run(join(root, 'node_modules', '.bin', 'tsdown'), ['-c', 'tsdown.config.mjs'])
}
