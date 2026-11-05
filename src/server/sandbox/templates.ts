import type {
  SandboxAllowEntry,
  SandboxTemplate,
  SandboxTemplateStore,
} from '../../types.ts'
import { MAX_ALLOW_DESCRIPTION_CHARS } from '../session/storage.ts'

/**
 * The sandbox panel's user-authored presets: validation, the one write path,
 * and the wire result shapes.
 *
 * The built-in presets are not here and are not stored anywhere. They ship with
 * the client bundle (see `client/session/sandboxTemplates.ts`) and stay
 * read-only, so a path in them can be corrected by a plugin upgrade instead of
 * being frozen by the first user who loaded the panel. This module owns only
 * what a user authored.
 *
 * Validation is server-side because that is where every other write in this
 * plugin is validated: the client may pre-filter for a friendlier message, but
 * a value that reaches the store has passed through here.
 */

/** Longest label accepted; long enough for a stack name, short enough for a button. */
const MAX_TEMPLATE_NAME_CHARS = 40

/** Paths per preset. The upper bound exists to keep one button's fill bounded. */
const MAX_TEMPLATE_ENTRIES = 50

/** Where a refusal points, for the message the user reads. */
export interface TemplateRefusal {
  where: string
  reason: string
}

/** Normalize one allow entry, or say why it was refused. */
function normalizeEntry(
  raw: unknown,
  index: number,
): SandboxAllowEntry | TemplateRefusal {
  if (!raw || typeof raw !== 'object') {
    return {
      where: `entry #${index + 1}`,
      reason: 'not a path/description object',
    }
  }
  const entry = raw as Partial<SandboxAllowEntry>
  const path = typeof entry.path === 'string' ? entry.path.trim() : ''
  if (!path) {
    return { where: `entry #${index + 1}`, reason: 'path is empty' }
  }
  const description =
    typeof entry.description === 'string' ? entry.description.trim() : ''
  return {
    path,
    ...(description
      ? { description: description.slice(0, MAX_ALLOW_DESCRIPTION_CHARS) }
      : {}),
  }
}

/**
 * Normalize one incoming preset.
 *
 * @param incoming - the raw payload.
 * @param id - the id this write targets; assigned by the caller when new.
 * @returns the stored preset, or the reason it was refused.
 */
export function normalizeTemplate(
  incoming: Partial<SandboxTemplate>,
  id: string,
): SandboxTemplate | TemplateRefusal {
  const name = (typeof incoming.name === 'string' ? incoming.name : '').trim()
  if (!name) return { where: id, reason: 'name is required' }
  if (name.length > MAX_TEMPLATE_NAME_CHARS) {
    return {
      where: name,
      reason: `name must be at most ${MAX_TEMPLATE_NAME_CHARS} characters`,
    }
  }

  const rawEntries = Array.isArray(incoming.entries) ? incoming.entries : []
  if (rawEntries.length === 0) {
    return { where: name, reason: 'at least one directory is required' }
  }
  if (rawEntries.length > MAX_TEMPLATE_ENTRIES) {
    return {
      where: name,
      reason: `at most ${MAX_TEMPLATE_ENTRIES} directories are allowed`,
    }
  }

  const entries: SandboxAllowEntry[] = []
  const seen = new Set<string>()
  for (const [index, raw] of rawEntries.entries()) {
    const entry = normalizeEntry(raw, index)
    if ('reason' in entry) return { where: name, reason: entry.reason }
    // Literal comparison, matching the client's own de-duplication: the client
    // cannot normalize a path correctly (see sandboxTemplates.ts), so both
    // sides agree to compare the string exactly.
    if (seen.has(entry.path)) continue
    seen.add(entry.path)
    entries.push(entry)
  }
  if (entries.length === 0) {
    return { where: name, reason: 'every directory was a duplicate' }
  }

  return {
    id,
    name,
    entries,
    createdAt:
      typeof incoming.createdAt === 'number' &&
      Number.isFinite(incoming.createdAt)
        ? incoming.createdAt
        : Date.now(),
  }
}

/** A write result: the stored preset, or the reason the input was refused. */
export type TemplateWriteResult =
  { template: SandboxTemplate } | { error: string }

/** Construction inputs the registry needs but does not own. */
export interface SandboxTemplateRegistryDeps {
  /**
   * The process-wide store, held by the composition root.
   *
   * This process is its only writer, so one cached copy is the whole
   * consistency model — the same reasoning as the MCP registry.
   */
  getStore: () => SandboxTemplateStore
  /** Persist after a write; a failure is the caller's to report. */
  persist: () => Promise<void>
}

/** Ids assigned here so a caller never invents one that could collide. */
let templateSeq = 0

function nextTemplateId(): string {
  templateSeq += 1
  return `tpl-${Date.now().toString(36)}-${templateSeq.toString(36)}`
}

/**
 * The sandbox template store's single write path.
 *
 * Routes parse a body and map a result; naming, uniqueness, and the two
 * reserved-name rules live here so an add and an edit cannot enforce different
 * sets of them.
 */
export class SandboxTemplateRegistry {
  private readonly deps: SandboxTemplateRegistryDeps

  constructor(deps: SandboxTemplateRegistryDeps) {
    this.deps = deps
  }

  private current(): SandboxTemplateStore {
    return this.deps.getStore()
  }

  /** Every stored preset, oldest first so the button row does not reshuffle. */
  public list(): SandboxTemplate[] {
    return Object.values(this.current().templates).sort(
      (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
    )
  }

  /**
   * Insert or replace one preset.
   *
   * @param incoming - the raw payload.
   * @param builtinNames - labels of the built-in presets in the active language.
   *   A user preset may not share one: the button row is the only thing a user
   *   sees, and two buttons reading "Android" is a plain interface defect.
   * @returns the stored preset, or the reason it was refused.
   */
  public async upsert(
    incoming: Partial<SandboxTemplate>,
    builtinNames: readonly string[],
  ): Promise<TemplateWriteResult> {
    const store = this.current()
    const requested =
      typeof incoming.id === 'string' && incoming.id.trim()
        ? incoming.id.trim()
        : undefined
    const existing = requested ? store.templates[requested] : undefined
    const id = requested && existing ? requested : nextTemplateId()

    // An edit keeps the original creation time: it is the listing's sort key,
    // so re-stamping it would move the preset to the end of the button row
    // every time its name or a path was touched.
    const normalized = normalizeTemplate(
      existing && incoming.createdAt === undefined
        ? { ...incoming, createdAt: existing.createdAt }
        : incoming,
      id,
    )
    if ('reason' in normalized) {
      return { error: `${normalized.where} — ${normalized.reason}` }
    }

    // Uniqueness spans both families, compared on the trimmed label the user
    // will actually read on the button.
    const taken = new Set([
      ...Object.values(store.templates)
        .filter((t) => t.id !== id)
        .map((t) => t.name),
      ...builtinNames,
    ])
    if (taken.has(normalized.name)) {
      return { error: `A template named "${normalized.name}" already exists` }
    }

    store.templates[id] = normalized
    await this.deps.persist()
    return { template: normalized }
  }

  /** Remove one preset. */
  public async remove(id: string): Promise<boolean> {
    const store = this.current()
    if (!store.templates[id]) return false
    delete store.templates[id]
    await this.deps.persist()
    return true
  }
}
