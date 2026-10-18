#!/usr/bin/env node
/**
 * Aggregate runner for the gates this project enabled.
 *
 * Each gate is a standalone script so it can be run in isolation while
 * iterating; this runner is the one command an agent needs before committing.
 * Gates run sequentially and the first failure stops the run, because a later
 * gate's output is usually noise while an earlier one is red.
 *
 * The list comes from `ENABLED_GATES` in `config.mjs`, not from the directory,
 * so switching a gate off for this repository is a config edit rather than a
 * file deletion — and a gate switched off is still covered by `verify-preset`.
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ENABLED_GATES } from './config.mjs'
// `isFile` resolves against the repository root, so test the absolute path
// directly instead of routing a scripts-dir path through it.
import { existsSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))

if (ENABLED_GATES.length === 0) {
  console.error('✗ verify-all: ENABLED_GATES 为空，没有可运行的闸门')
  process.exit(1)
}

for (const gate of ENABLED_GATES) {
  const script = join(here, `${gate}.mjs`)
  if (!existsSync(script)) {
    console.error(`✗ verify-all: 启用了不存在的闸门 ${gate}`)
    process.exit(1)
  }
  const result = spawnSync(process.execPath, [script], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

console.log(`✓ verify-all: ${ENABLED_GATES.length} 个闸门全部通过`)
