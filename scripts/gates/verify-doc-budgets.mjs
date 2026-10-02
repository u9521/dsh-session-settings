#!/usr/bin/env node
/**
 * Gate: documentation word budgets.
 *
 * Budgets guard against prompt bloat: every governed document is read by agents
 * on each turn, so the cost of an extra paragraph is paid repeatedly. Counting
 * rules live in `countUnits` (CJK characters and Latin words, code blocks and
 * link targets excluded).
 */
import { countUnits, finish, isFile, readText, walk } from './_shared.mjs'

/** Exact-path budgets, in counting units. */
const FILE_BUDGETS = [
  { path: 'AGENTS.md', limit: 1500 },
  { path: '.agents/notes/README.md', limit: 900 },
  { path: '.agents/notes/AGENTS.md', limit: 500 },
  { path: '.agents/notes/implemented/AGENTS.md', limit: 400 },
]

/** Every Agent Note shares this ceiling. */
const NOTE_BUDGET = 1500

/** Every project skill shares this ceiling. */
const SKILL_BUDGET = 800

const failures = []
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
  }
}

for (const { path, limit } of FILE_BUDGETS) check(path, limit)

for (const relPath of walk('.agents/notes', (p) => p.endsWith('.md'))) {
  const basename = relPath.split('/').at(-1)
  if (
    basename === 'AGENTS.md' ||
    basename === 'README.md' ||
    ignored.has(relPath)
  )
    continue
  check(relPath, NOTE_BUDGET)
}

for (const relPath of walk('.agents/skills', (p) => p.endsWith('/SKILL.md'))) {
  check(relPath, SKILL_BUDGET)
}

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
