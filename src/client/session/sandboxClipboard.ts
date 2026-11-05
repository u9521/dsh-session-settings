import type { SandboxAllowEntry } from '../types/index.ts'

/**
 * The clipboard format the sandbox panel exports and imports.
 *
 * ## Why a text format at all
 *
 * A preset is a list of directories a colleague may want too. The alternative —
 * storing it somewhere and telling them to look it up — is heavier than the
 * problem: the sentence that explains a grant is already prose, and prose
 * belongs in a chat window, an issue, or a note. So the transport is text that a
 * person can read, edit and paste into a conversation.
 *
 * ## The format
 *
 * ```text
 * # Android
 * ~/Android/Sdk | Android SDK and platform tools
 * ~/.gradle | Gradle dependencies, wrapper and daemon caches
 * ```
 *
 * One row per line, `path | description`. The first `#` line is an optional
 * title. Blank lines and more `#` lines are ignored, so a pasted snippet keeps
 * its surrounding prose without breaking the parse. `|` splits on its FIRST
 * occurrence only, so a description may contain one; a row without `|` is a
 * bare path.
 *
 * Deliberately not JSON: the whole point is that a human edits this between two
 * panels. JSON survives a round trip more exactly, but nobody can point at "the
 * second line" in a JSON array, and nobody can fix a typo in one.
 *
 * This is a UI-to-UI convention, not part of the HTTP contract — it never
 * crosses the wire. It is documented in the READMEs because people do exchange
 * it, which makes it stable in practice whether or not it is declared so.
 */

/** Longest description kept, matching the server's own normalization. */
const MAX_DESCRIPTION_CHARS = 200

/** A parsed document: an optional title and the rows that survived. */
export interface ParsedSandboxText {
  /** The first `#` line, when the text has one. */
  title?: string
  /** Rows in document order, de-duplicated by literal path. */
  entries: SandboxAllowEntry[]
  /**
   * Lines that looked like rows but could not be used, with the reason.
   *
   * Reported rather than dropped: a paste that silently loses half its content
   * is the same failure as an import that answers "ok" after writing nothing.
   */
  skipped: { line: number; text: string; reason: string }[]
}

/**
 * Render rows as clipboard text.
 *
 * @param entries - the rows to write.
 * @param title - optional heading; omitted when empty.
 * @returns the text, one row per line, ending with a newline.
 */
export function formatSandboxEntries(
  entries: readonly SandboxAllowEntry[],
  title?: string,
): string {
  const lines: string[] = []
  const heading = (title ?? '').trim()
  if (heading) lines.push(`# ${heading}`)
  for (const entry of entries) {
    const description = (entry.description ?? '').trim()
    lines.push(description ? `${entry.path} | ${description}` : entry.path)
  }
  return lines.length > 0 ? `${lines.join('\n')}\n` : ''
}

/**
 * Parse clipboard text into rows.
 *
 * @param text - whatever was pasted.
 * @returns the title, the usable rows, and every rejected line.
 */
export function parseSandboxEntries(text: string): ParsedSandboxText {
  const result: ParsedSandboxText = { entries: [], skipped: [] }
  const seen = new Set<string>()

  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#')) {
      // Only the first heading is the title; later ones are the pasted
      // snippet's own comments and carry no meaning here.
      const heading = line.replace(/^#+/, '').trim()
      if (!result.title && heading) result.title = heading
      continue
    }

    const split = line.indexOf('|')
    const path = (split === -1 ? line : line.slice(0, split)).trim()
    const description =
      split === -1
        ? ''
        : line
            .slice(split + 1)
            .trim()
            .slice(0, MAX_DESCRIPTION_CHARS)

    if (!path) {
      result.skipped.push({ line: index + 1, text: line, reason: 'empty path' })
      continue
    }
    if (seen.has(path)) continue
    seen.add(path)
    result.entries.push({ ...(description ? { description } : {}), path })
  }

  return result
}
