#!/usr/bin/env node
/**
 * Gate: documentation word budgets.
 *
 * Budgets guard against prompt bloat: every governed document is read by agents
 * on each turn, so the cost of an extra paragraph is paid repeatedly. This file
 * is the only place budget numbers live — documents must not restate them, or
 * the two copies drift.
 *
 * Counting rules live in `countUnits` (CJK characters and Latin words, code
 * blocks and link targets excluded).
 */
import {
  ARCHITECTURE_BUDGET,
  ARCHITECTURE_DIR,
  FILE_BUDGETS,
  LOCAL_BUDGET,
  LOCAL_OVERLAY,
  NOTE_BUDGET,
  NOTE_MODE,
  PRESET_SKILL_BUDGET,
  SKILL_BUDGET,
  WARN_RATIO,
} from './config.mjs'
import { countUnits, finish, isFile, readText, walk } from './_shared.mjs'

const failures = []
const warnings = []
const measured = []
const ignored = new Set(FILE_BUDGETS.map((entry) => entry.path))

const check = (relPath, limit) => {
  if (!isFile(relPath)) {
    if (ignored.has(relPath))
      failures.push(`${relPath}: 受预算管控的文件不存在`)
    return
  }
  const units = countUnits(readText(relPath))
  measured.push({ relPath, units, limit })
  if (units > limit) {
    failures.push(
      `${relPath}: ${units} units 超出预算 ${limit}（需裁剪 ${units - limit}）`,
    )
  } else if (units >= limit * WARN_RATIO) {
    warnings.push(`${relPath}: ${units}/${limit}，余量不足 10%`)
  }
}

for (const { path, limit } of FILE_BUDGETS) check(path, limit)

for (const relPath of walk(ARCHITECTURE_DIR, (p) => p.endsWith('.md'))) {
  check(relPath, ARCHITECTURE_BUDGET)
}

if (NOTE_MODE === 'disabled') {
  console.log('  skipped: .agents/notes/（NOTE_MODE=disabled）')
} else {
  for (const relPath of walk('.agents/notes', (p) => p.endsWith('.md'))) {
    const basename = relPath.split('/').at(-1)
    if (basename === 'README.md' || ignored.has(relPath)) continue
    check(relPath, NOTE_BUDGET)
  }
}

// The personal overlay is untracked and optional; it gets its own pool so it can
// never push the team ratchet, and is capped because the host injects it.
if (isFile(LOCAL_OVERLAY)) {
  check(LOCAL_OVERLAY, LOCAL_BUDGET)
}

for (const relPath of walk('.agents/skills', (p) => p.endsWith('/SKILL.md'))) {
  check(relPath, SKILL_BUDGET)
}

for (const relPath of walk('.agents/preset/skills', (p) =>
  p.endsWith('/SKILL.md'),
)) {
  check(relPath, PRESET_SKILL_BUDGET)
}

for (const warning of warnings) console.log(`  ! ${warning}`)

const widest = measured.reduce(
  (acc, row) =>
    row.units / row.limit > acc.ratio
      ? { ...row, ratio: row.units / row.limit }
      : acc,
  { relPath: '-', units: 0, limit: 1, ratio: 0 },
)
finish(
  'verify-doc-budgets',
  failures,
  `${measured.length} 个文件在预算内（最紧：${widest.relPath} ${widest.units}/${widest.limit}）`,
)
