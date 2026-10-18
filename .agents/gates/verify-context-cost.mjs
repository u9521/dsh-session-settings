#!/usr/bin/env node
/**
 * Gate: context cost of the always-loaded agent chain.
 *
 * Every `AGENTS.md` from the repository root down to the working directory is
 * injected on every turn, so the chain is a paid subscription rather than a
 * one-off read. This gate prints the measured chain and fails only when it
 * grows past the recorded baseline: the numbers are a ratchet, not a target.
 *
 * The baseline is deliberately loose enough to leave room for prose edits and
 * tight enough that a new nesting level or a re-bloated root trips it.
 */
import {
  CONTEXT_BASELINE,
  CONTEXT_CHAIN,
  LOCAL_OVERLAY,
} from './config.mjs'
import { countUnits, finish, isFile, readText, walk } from './_shared.mjs'

const rows = []
for (const relPath of CONTEXT_CHAIN) {
  if (!isFile(relPath)) continue
  rows.push({ relPath, units: countUnits(readText(relPath)) })
}

const total = rows.reduce((sum, row) => sum + row.units, 0)

for (const row of rows) {
  console.log(`  ${String(row.units).padStart(5)}  ${row.relPath}`)
}

// The host injects the personal overlay alongside AGENTS.md, so its cost is
// real — but it is personal, so it stays out of the team ratchet. Print it as a
// conditional row: visible to whoever pays it, invisible to everyone else.
const overlay = isFile(LOCAL_OVERLAY)
  ? countUnits(readText(LOCAL_OVERLAY))
  : null
if (overlay !== null) {
  console.log(`  ${String(overlay).padStart(5)}  ${LOCAL_OVERLAY}（个人覆写层，不计入团队基线）`)
}

const failures = []

/**
 * The baseline is a total, so a tiny nested file could hide inside its
 * headroom. The nesting decision is therefore checked directly: only the
 * mounting points named in the chain may carry an `AGENTS.md`. A new level
 * adds cost on every turn, including turns that never reach it.
 */
const allowed = new Set(CONTEXT_CHAIN)
for (const relPath of walk('.', (p) => p.split('/').at(-1) === 'AGENTS.md')) {
  if (!allowed.has(relPath)) {
    failures.push(
      `${relPath}: 不允许新增嵌套 AGENTS.md；局部规范放进 .agents/architecture/ 或 .agents/skills/`,
    )
  }
}

if (total > CONTEXT_BASELINE) {
  failures.push(
    `常驻链 ${total} units 超出基线 ${CONTEXT_BASELINE}（需削减 ${total - CONTEXT_BASELINE}）`,
  )
}

finish(
  'verify-context-cost',
  failures,
  `常驻链 ${rows.length} 个文件合计 ${total}/${CONTEXT_BASELINE} units`,
)
