import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { SandboxAllowEntry } from '../../types.ts'

/**
 * Turning user-spelled allowed directories into the absolute paths an
 * enforcement layer can compare.
 *
 * Two rules shape everything here:
 *
 * 1. **Spelling is the user's, comparison is absolute.** `.` means the session
 *    workspace and `~` means the host home directory, because those are the
 *    spellings someone reaches for; the provider only ever receives resolved
 *    absolute paths.
 * 2. **A root that does not exist is dropped, never passed through.** This is
 *    the load-bearing one. Passing a missing root is harmless under Landlock
 *    (it simply matches nothing) but FATAL under `bwrap`, whose `--bind` refuses
 *    to build the profile at all — one stale cache path would fail every command
 *    in the session with an error that reads nothing like a sandbox problem.
 *    Dropping it keeps the failure local to the rule that caused it.
 *
 * @module session-settings/sandbox/paths
 */

/** Longest normalized path accepted; longer values cannot be real on any supported host. */
const MAX_PATH_CHARS = 4096

/** One configured entry after resolution, with the display text the prompt uses. */
export interface ResolvedAllowRoot {
  /** Absolute directory to grant. */
  readonly path: string
  /** Description to render beside the path; absent renders the path alone. */
  readonly description?: string
}

/** An entry that could not be turned into a grant. */
export interface RejectedAllowEntry {
  /** The path exactly as configured, so the message names what the user typed. */
  readonly path: string
  /** Why it was dropped, phrased for a person rather than a log line. */
  readonly reason: string
}

/** The outcome of resolving one session's configured entries. */
export interface ResolvedAllowSet {
  /** Directory entries that resolved AND exist, in configured order, deduplicated. */
  readonly roots: ResolvedAllowRoot[]
  /** Entries that resolved to nothing usable. */
  readonly rejected: RejectedAllowEntry[]
}

/**
 * Expand a leading `~` to the host home directory.
 *
 * Only a bare `~` or a `~/` prefix expands. `~user` is deliberately left alone:
 * resolving another account's home would grant a path the configuring user did
 * not necessarily mean, and returning it unresolved is the safe direction.
 *
 * @param raw - the configured path.
 * @param home - the home directory to expand to.
 * @returns the path with a leading `~` expanded.
 */
function expandHome(raw: string, home: string): string {
  if (raw === '~') return home
  if (raw.startsWith('~/')) return path.join(home, raw.slice(2))
  return raw
}

/**
 * Resolve one configured path to an absolute directory, or say why not.
 *
 * Relative paths resolve against the session workspace, which is what makes `.`
 * mean "the workspace root" and `./vendor` mean one directory inside it.
 *
 * @param raw - the configured path.
 * @param workspaceRoot - absolute session workspace, the base for relative paths.
 * @param home - absolute home directory for `~` expansion.
 * @returns the absolute path, or a rejection reason.
 */
export function resolveAllowPath(
  raw: string,
  workspaceRoot: string,
  home: string,
): { ok: true; path: string } | { ok: false; reason: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, reason: 'empty path' }
  if (trimmed.length > MAX_PATH_CHARS) {
    return { ok: false, reason: 'path is too long' }
  }

  const expanded = expandHome(trimmed, home)
  // `path.resolve` also normalizes `.`/`..` segments, so the value compared by
  // the backend is the same one this module validated.
  const absolute = path.resolve(workspaceRoot, expanded)
  return { ok: true, path: absolute }
}

/**
 * Resolve every configured entry for one session.
 *
 * Entries are deduplicated by resolved path: two spellings of one directory are
 * one grant, and the first description wins so the text a user wrote against
 * the entry they consider canonical is the one the model reads.
 *
 * @param entries - the configured allow list for the effective scope.
 * @param workspaceRoot - absolute session workspace.
 * @param home - absolute home directory; defaults to the process home.
 * @returns the grantable roots and the rejected entries, both in configured order.
 */
export function resolveAllowSet(
  entries: readonly SandboxAllowEntry[],
  workspaceRoot: string,
  home: string = os.homedir(),
): ResolvedAllowSet {
  const roots: ResolvedAllowRoot[] = []
  const rejected: RejectedAllowEntry[] = []
  const seen = new Set<string>()

  for (const entry of entries) {
    const resolved = resolveAllowPath(entry.path, workspaceRoot, home)
    if (!resolved.ok) {
      rejected.push({ path: entry.path, reason: resolved.reason })
      continue
    }
    if (seen.has(resolved.path)) continue

    // Existence is checked HERE rather than at enforcement time so the reason is
    // reported once, against the configured spelling, instead of surfacing as a
    // provider failure on an unrelated command.
    let stats: fs.Stats
    try {
      stats = fs.statSync(resolved.path)
    } catch {
      rejected.push({ path: entry.path, reason: 'directory does not exist' })
      continue
    }
    if (!stats.isDirectory()) {
      rejected.push({ path: entry.path, reason: 'not a directory' })
      continue
    }

    seen.add(resolved.path)
    roots.push({
      path: resolved.path,
      ...(entry.description ? { description: entry.description } : {}),
    })
  }

  return { roots, rejected }
}
