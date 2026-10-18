#!/usr/bin/env node
/**
 * Helper, not a gate: print the counting unit total for the given paths.
 *
 * Budget numbers live in `config.mjs`; this script only answers
 * "how big is this file right now", which is what a document edit needs while
 * it is being trimmed.
 */
import { countUnits, isFile, readText, walk } from './_shared.mjs'

const targets = process.argv.slice(2)

if (targets.length === 0) {
  console.error('用法: node .agents/gates/measure.mjs <path> [<path>...]')
  process.exit(2)
}

for (const target of targets) {
  if (isFile(target)) {
    console.log(`${String(countUnits(readText(target))).padStart(5)}  ${target}`)
    continue
  }
  for (const relPath of walk(target, (p) => p.endsWith('.md'))) {
    console.log(`${String(countUnits(readText(relPath))).padStart(5)}  ${relPath}`)
  }
}
