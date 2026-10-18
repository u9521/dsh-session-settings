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
import { HUMAN_MAP, IGNORE_DIRS, LOCAL_OVERLAY } from './config.mjs'

/** Repository root, resolved from this file's location (`scripts/gates/`). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * Directories every walk skips, taken from the project's config. `lib/` is not
 * in the default set: it is a source directory in Dart, Elixir and Ruby.
 */
const SKIP_DIRS = new Set(IGNORE_DIRS)

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

/**
 * Expand a `Covers:` pattern to the paths it matches.
 *
 * Patterns are repository-relative and may contain `*` in any segment, which is
 * what lets a module document cover every package's source tree without listing each
 * package. A trailing `/**` means "everything under this directory".
 *
 * Matching walks the tree once and tests each directory and file, so a pattern
 * never needs the filesystem's own glob support.
 */
export function globMatches(pattern) {
  const normalized = pattern.replace(/\/+$/, '').replace(/\/\*\*$/, '')
  const segments = normalized.split('/').filter(Boolean)
  const hasWildcard = segments.some((segment) => segment.includes('*'))

  if (!hasWildcard) {
    return isFile(normalized) || isDir(normalized) ? [normalized] : []
  }

  const matcher = new RegExp(
    `^${segments
      .map((segment) =>
        segment === '**'
          ? '.*'
          : segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'),
      )
      .join('/')}(?:/.*)?$`,
  )

  const hits = []
  // Walk from the first literal segment to keep the scan bounded.
  const root = segments.findIndex((segment) => segment.includes('*'))
  const scanRoot = segments.slice(0, root).join('/') || '.'
  const candidates = walk(scanRoot, () => true)
  for (const candidate of candidates) {
    if (matcher.test(candidate)) hits.push(candidate)
  }
  // A pattern may name a directory rather than a file.
  if (!hits.length && isDir(normalized)) hits.push(normalized)
  return hits
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
 * Preset templates: they carry placeholders instead of real paths
 * (`<kind>`, `<slug>`), so link resolution cannot apply to them.
 */
export const PRESET_TEMPLATE_DIR = '.agents/preset/templates/'

/**
 * Markdown documents governed by the documentation gates: root agent/readme
 * files plus every note and doc page. Templates are excluded because their
 * links are instructions for a future repository, not links that resolve here.
 */
export function governedMarkdown() {
  const fixed = ['AGENTS.md', 'README.md', 'README.zh.md'].filter(isFile)
  const notes = walk('.agents', (p) => p.endsWith('.md'))
  // `docs/` belongs to the project: a documentation site may carry front-matter,
  // includes or component syntax this gate would misread. Only the map the
  // project explicitly declared is governed here.
  const docs = HUMAN_MAP !== null && isFile(HUMAN_MAP) ? [HUMAN_MAP] : []
  return [...new Set([...fixed, ...notes, ...docs])]
    .filter((relPath) => !relPath.startsWith(PRESET_TEMPLATE_DIR))
    // The personal overlay is untracked, so it is absent from every other
    // collaborator's checkout: a link to it here would break for them.
    .filter((relPath) => relPath !== LOCAL_OVERLAY)
    .sort()
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
