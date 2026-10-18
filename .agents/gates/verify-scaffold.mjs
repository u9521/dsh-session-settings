#!/usr/bin/env node
/**
 * Gate: the scaffold is internally consistent.
 *
 * This gate deliberately knows nothing about the preset that generated the
 * framework — expectations live in the preset, not in the project. What it
 * checks is that the parts agree with each other:
 *
 *   1. the root entry file carries exactly the allowed sections;
 *   2. every navigation row points at a path that exists;
 *   3. every module document is reachable from a navigation row;
 *   4. every `Covers:` pattern still matches something.
 *
 * A dangling row, an orphan document, or a `Covers:` path for a deleted
 * directory are all the same failure: the map stopped describing the tree.
 *
 * When the project has no module documents at all (a micro project), the map
 * still has to say something true: the root's positioning section must carry a
 * one-line `→` call path instead.
 */
import {
  ARCHITECTURE_DIR,
  NAV_SECTION,
  ROOT_SECTIONS,
} from './config.mjs'
import { finish, globMatches, isDir, isFile, readText, walk } from './_shared.mjs'

const ROOT = 'AGENTS.md'

const failures = []

/* 1. Root sections. */
if (!isFile(ROOT)) {
  failures.push(`${ROOT}: 入口文件缺失`)
} else {
  const found = readText(ROOT)
    .split('\n')
    .filter((line) => /^##\s+/.test(line))
    .map((line) => line.replace(/^##\s+/, '').trim())
  for (const section of ROOT_SECTIONS) {
    if (!found.includes(section)) failures.push(`${ROOT}: 缺少 "## ${section}"`)
  }
  for (const section of found) {
    if (!ROOT_SECTIONS.includes(section)) {
      failures.push(
        `${ROOT}: 出现未授权的二级标题 "## ${section}"；只允许 ${ROOT_SECTIONS.join(' / ')}`,
      )
    }
  }
}

/* 2. Navigation rows point at real paths. */
const referenced = new Set()
if (isFile(ROOT)) {
  const rootLines = readText(ROOT).split('\n')
  const start = rootLines.findIndex((line) => line === `## ${NAV_SECTION}`)
  if (start === -1) {
    failures.push(`${ROOT}: 无法定位 "## ${NAV_SECTION}"，导航表未校验`)
  } else {
    let inTable = false
    for (let index = start + 1; index < rootLines.length; index += 1) {
      const line = rootLines[index]
      if (/^##\s+/.test(line)) break
      // Slot markers are HTML comments, which may sit inside the table (the
      // preset puts `repo:begin`/`repo:end` around repository-owned rows).
      // They are transparent: skipping them keeps the table continuity.
      if (/^\s*<!--.*-->\s*$/.test(line)) continue
      if (!line.trim().startsWith('|')) {
        if (inTable) break
        continue
      }
      inTable = true
      for (const match of line.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = match[1]
        if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) {
          continue
        }
        const clean = target.split('#')[0]
        if (!isFile(clean) && !isDir(clean)) {
          failures.push(
            `${ROOT}: 导航表指向不存在的路径 "${clean}"；先建文件或删除该行`,
          )
        }
        referenced.add(clean)
      }
    }
  }
}

const moduleDocs = isDir(ARCHITECTURE_DIR)
  ? walk(ARCHITECTURE_DIR, (p) => p.endsWith('.md'))
  : []

/* 3. Every module document is reachable from the navigation table. */
for (const relPath of moduleDocs) {
  if (!referenced.has(relPath)) {
    failures.push(`${relPath}: 架构文档未被 ${ROOT} 的导航表引用（孤儿文档）`)
  }
}

/**
 * A project with no module documents still has to state its main call path, or
 * "micro project" degenerates into "no constraint at all".
 */
if (moduleDocs.length === 0) {
  // ROOT_SECTIONS is localised per project, so derive the heading rather than
  // hardcoding one language's spelling.
  const positioningName = ROOT_SECTIONS[0]
  const positioning = readText(ROOT)
    .split(new RegExp(`^##\\s+${positioningName}\\s*$`, 'm'))[1]
    ?.split(/^##\s+/m)[0]
  if (!positioning || !/→/.test(positioning)) {
    failures.push(
      `${ROOT}: 没有任何模块文档时，"## ${positioningName}"必须用一行 → 链写清主调用路径`,
    )
  }
}

/** `Covers:` is written as a comma-separated list of paths or glob patterns. */
const COVERS = /^Covers:\s*(.+)$/m

/* 4. Every `Covers:` pattern matches at least one real path. */
for (const relPath of moduleDocs) {
  const text = readText(relPath)
  if (!/^#\s+\S/m.test(text)) {
    failures.push(`${relPath}: 缺少一级标题`)
  }
  const covers = COVERS.exec(text)
  if (!covers) {
    failures.push(
      `${relPath}: 缺少 "Covers: <path>[, <path>]" 首行声明，导航表无法双向闭合`,
    )
    continue
  }
  for (const rawTarget of covers[1].split(',')) {
    const target = rawTarget.trim()
    if (!target) continue
    if (globMatches(target).length === 0) {
      failures.push(
        `${relPath}: Covers 模式 "${target}" 匹配不到任何路径；目录删除后要同步改本行`,
      )
    }
  }
}

finish(
  'verify-scaffold',
  failures,
  `入口 ${ROOT_SECTIONS.length} 节、导航 ${referenced.size} 条引用、${moduleDocs.length} 篇架构文档与 Covers 均闭合`,
)
