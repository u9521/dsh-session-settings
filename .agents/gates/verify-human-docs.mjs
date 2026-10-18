#!/usr/bin/env node
/**
 * Gate: human-facing documentation and code-symbol liveness.
 *
 * Two jobs, both under one rule — **validate what exists, never demand what
 * was not asked for**:
 *
 *   1. A symbol-anchored link — `[`countUnits`](_shared.mjs)` — claims the
 *      target file still contains that identifier. When a rename or a deletion
 *      leaves the claim false, this gate says so. It does not check that the
 *      symbol is still *exported*: it proves the name has not vanished, which
 *      is the drift that actually happens.
 *   2. When the project declares a human-facing map (`HUMAN_MAP`), that map
 *      must carry the four blocks and at least one figure or flow arrow. When
 *      it is `null`, no map is expected and nothing is checked.
 *
 * Prose budgets live in `verify-doc-budgets`; this gate is about truthfulness,
 * not length.
 */
import { dirname, posix } from 'node:path'
import { HUMAN_MAP, MANAGED_PATHS } from './config.mjs'
import {
  finish,
  governedMarkdown,
  headings,
  isFile,
  readText,
} from './_shared.mjs'

/** `[`identifier`](path)` or `[`identifier`](path#L10)`. */
const SYMBOL_LINK = /\[`([A-Za-z_$][A-Za-z0-9_$]*)`\]\(([^)\s]+)\)/g
const SCHEME = /^[a-z][a-z0-9+.-]*:/i

/** The blocks a declared map must carry. */
const MAP_SECTIONS = ['核心领域词典', '端到端数据流', '源码精读路线', '深入索引']

const failures = []
const sourceCache = new Map()
let checkedSymbols = 0
let checkedFiles = 0

/** Escaping for a literal identifier match. */
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const sourceOf = (relPath) => {
  if (!sourceCache.has(relPath)) {
    sourceCache.set(relPath, isFile(relPath) ? readText(relPath) : null)
  }
  return sourceCache.get(relPath)
}

/* 1. Symbol liveness across every governed document. */
for (const relPath of governedMarkdown()) {
  checkedFiles += 1
  const fileLines = readText(relPath).split('\n')
  let inFence = false

  fileLines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      return
    }
    if (inFence) return

    for (const match of line.matchAll(SYMBOL_LINK)) {
      const [, symbol, rawTarget] = match
      if (SCHEME.test(rawTarget) || rawTarget.startsWith('/')) continue

      const [rawPath = ''] = rawTarget.split('#')
      if (!rawPath) continue

      const target = posix.normalize(posix.join(dirname(relPath), rawPath))
      const source = sourceOf(target)
      if (source === null) {
        failures.push(
          `${relPath}:${index + 1} — 符号锚点指向不存在的文件: ${rawPath}`,
        )
        continue
      }

      checkedSymbols += 1
      if (!new RegExp(`\\b${escapeRegExp(symbol)}\\b`).test(source)) {
        failures.push(
          `${relPath}:${index + 1} — ${target} 中已不存在符号 "${symbol}"（文档与代码漂移）`,
        )
      }
    }
  })
}

/* 2. A declared map has to be a map. */
if (HUMAN_MAP !== null) {
  if (!isFile(HUMAN_MAP)) {
    failures.push(`${HUMAN_MAP}: 已声明 HUMAN_MAP 但文件不存在`)
  } else {
    const content = readText(HUMAN_MAP)
    const level2 = headings(HUMAN_MAP)
      .filter((heading) => heading.level === 2)
      .map((heading) => heading.text)

    for (const required of MAP_SECTIONS) {
      if (!level2.includes(required)) {
        failures.push(`${HUMAN_MAP}: 缺少二级标题 "## ${required}"`)
      }
    }

    // A figure must be a real mermaid block; a flow may be a single arrow line.
    // Both are counted outside the prose budget, so neither can hide bloat.
    const hasFigure = /```mermaid[\s\S]*?```/.test(content)
    const hasArrow = /→/.test(content)
    if (!hasFigure && !hasArrow) {
      failures.push(
        `${HUMAN_MAP}: "端到端数据流" 需要至少一个 mermaid 图或一行 → 流向`,
      )
    }

    const tour =
      content.split(/^##\s+源码精读路线\s*$/m)[1]?.split(/^##\s+/m)[0] ?? ''
    if (!/^\s*\d+\.\s+\S/m.test(tour)) {
      failures.push(
        `${HUMAN_MAP}: "源码精读路线" 需要有序步骤，每步指向真实文件`,
      )
    }
  }
}

/* 3. The map belongs to the project, so it must not sit on a managed path. */
if (
  HUMAN_MAP !== null &&
  MANAGED_PATHS.some((prefix) => HUMAN_MAP.startsWith(prefix))
) {
  failures.push(
    `${HUMAN_MAP}: 人类文档归项目所有，不得放进受管路径（${MANAGED_PATHS.join(' / ')}）`,
  )
}

finish(
  'verify-human-docs',
  failures,
  HUMAN_MAP === null
    ? `${checkedFiles} 个文件、${checkedSymbols} 个符号锚点活性通过（未声明 HUMAN_MAP）`
    : `${checkedFiles} 个文件、${checkedSymbols} 个符号锚点活性通过，${HUMAN_MAP} 结构合规`,
)
