/**
 * Shared helpers for this repository's zero-dependency verification gates.
 *
 * Every gate script is runnable on its own (`node scripts/gates/<name>.mjs`) and
 * none of them may import anything outside the Node standard library or this
 * file: the gates must keep working before `pnpm install` has ever run.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Repository root, resolved from this file's location (`scripts/gates/`). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'lib',
  'dist',
  '.pnpm-store',
])

/** Repository-relative, POSIX-style path for display. */
export function toRel(absPath) {
  return relative(ROOT, absPath).split(sep).join('/')
}

/** Absolute path for a repository-relative path. */
export function toAbs(relPath) {
  return join(ROOT, relPath)
}

/**
 * Recursively list files under `relDir`, newest-agnostic and sorted for stable
 * output. Returns repository-relative paths.
 */
export function walk(relDir, filter) {
  const out = []
  const visit = (absDir) => {
    let entries
    try {
      entries = readdirSync(absDir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (SKIP_DIRS.has(entry.name)) continue
      const abs = join(absDir, entry.name)
      if (entry.isDirectory()) visit(abs)
      else if (!filter || filter(toRel(abs))) out.push(toRel(abs))
    }
  }
  visit(toAbs(relDir))
  return out
}

export function readText(relPath) {
  return readFileSync(toAbs(relPath), 'utf8')
}

export function isFile(relPath) {
  return existsSync(toAbs(relPath)) && statSync(toAbs(relPath)).isFile()
}

export function isDir(relPath) {
  return existsSync(toAbs(relPath)) && statSync(toAbs(relPath)).isDirectory()
}

export function lines(relPath) {
  return readText(relPath).split('\n')
}

const CJK = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/

/**
 * Count "units" for a prose budget: one unit per CJK character, one per
 * Latin/digit word. Fenced code blocks and link targets are excluded, because
 * budgets guard prose bloat, not the commands a document must state exactly.
 */
export function countUnits(text) {
  const prose = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[`*_>#|]/g, ' ')
  const cjk = prose.match(
    /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/g,
  )
  const latin = prose
    .replace(/[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/g, ' ')
    .match(/[A-Za-z0-9][A-Za-z0-9'’._/-]*/g)
  return (cjk?.length ?? 0) + (latin?.length ?? 0)
}

/**
 * GitHub-style heading anchor. Two candidate spellings are produced because CJK
 * headings are slugged differently across renderers; a link matches when either
 * candidate exists.
 */
export function headingAnchors(heading) {
  const plain = heading
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim()
    .toLowerCase()
  const strict = plain.replace(/[^\p{L}\p{N} -]/gu, '').replace(/ /g, '-')
  const loose = plain.replace(/\s+/g, '-')
  return [
    ...new Set([
      strict,
      loose,
      encodeURIComponent(strict),
      encodeURIComponent(loose),
    ]),
  ]
}

/** Markdown headings of a document, in order, with their line numbers. */
export function headings(relPath) {
  const found = []
  const content = readText(relPath)
  content.split('\n').forEach((line, index) => {
    const match = /^(#{1,6})\s+(.*?)\s*$/.exec(line)
    if (match)
      found.push({ level: match[1].length, text: match[2], line: index + 1 })
  })
  return found
}

/**
 * Markdown documents governed by the documentation gates: root agent/readme
 * files plus every note and doc page.
 */
export function governedMarkdown() {
  const fixed = ['AGENTS.md', 'README.md', 'README.zh.md'].filter(isFile)
  const notes = walk('.agents', (p) => p.endsWith('.md'))
  const docs = walk('docs', (p) => p.endsWith('.md'))
  return [...new Set([...fixed, ...notes, ...docs])].sort()
}

/** Print the gate outcome and set a non-zero exit code on failure. */
export function finish(gate, failures, summary) {
  if (failures.length === 0) {
    console.log(`✓ ${gate}: ${summary}`)
    return
  }
  console.error(`✗ ${gate}: ${failures.length} 处违规`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exitCode = 1
}
