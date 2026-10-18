/**
 * Project slot: every value the gates read that depends on this repository.
 *
 * The gate scripts are byte-identical to the preset templates, which is what
 * lets an update replace them wholesale and `verify-preset` prove the copies
 * have not drifted. Nothing repository-specific may appear in a gate script:
 * it appears here instead.
 *
 * Two kinds of value live here, and they answer different questions:
 *
 * - **Choices** (`NOTE_MODE`, `DOC_LANG`, `SEPARATION`, `CI`, module toggles)
 *   record what this repository decided during init. They are not defaults to
 *   be re-guessed on every run, and they are not a snapshot of the preset: the
 *   preset's expectations stay in the preset.
 * - **Budgets** are ceilings in counting units. They live here and nowhere
 *   else — a second copy in prose drifts the moment either side is edited.
 */

/* ── Scope ──────────────────────────────────────────────────────────────── */

/**
 * Paths owned by the framework. `verify-detachable` fails when a project file
 * names one of them, because they must be deletable without breaking the build.
 *
 * `docs/` is deliberately absent: it belongs to the project. A documentation
 * site, an API manual or a user guide all reasonably sit there, so the
 * framework cannot both own that name and stay detachable.
 */
export const MANAGED_PATHS = ['AGENTS.md', '.agents/']

/** Where module-level constraints live, relative to the repository root. */
export const ARCHITECTURE_DIR = '.agents/architecture'

/* ── Choices recorded at init ───────────────────────────────────────────── */

/**
 * Documentation language: `zh`, `en`, or `both`.
 *
 * Gates never localise themselves — they read `ROOT_SECTIONS`, which this file
 * spells out in the project's language. `DOC_LANG` records the choice so a
 * framework update knows which prose to regenerate, and so the audit can flag a
 * document written in the wrong language.
 */
export const DOC_LANG = 'zh'

/**
 * Agent Note lifecycle strength:
 *   'four-state' — proposed / implemented / rejected / archived
 *   'two-state'  — proposed / implemented
 *   'disabled'   — no notes tree; the note gates report a skip
 */
export const NOTE_MODE = 'four-state'

/**
 * How the framework is kept out of the project's way:
 *   'stealth' — managed paths go into .git/info/exclude, nothing enters the repo
 *   'team'    — managed paths are committed; a CI workflow may enforce the gates
 */
export const SEPARATION = 'team'

/**
 * Optional CI enforcement. `null` disables it. When set, `verify-detachable`
 * allows exactly these files to name managed paths, and requires each one to
 * carry a guard so a framework-less checkout skips instead of failing.
 *
 * Supported `platform` values: 'github' | 'gitlab' | 'custom'.
 */
export const CI = null

/**
 * Project files allowed to mention managed paths even without CI — for example
 * a hook or a task runner that calls the gates. Each still needs a guard.
 */
export const FRAMEWORK_AWARE_FILES = []

/**
 * How to inspect the publish surface, or `null` when there is none.
 * A service, a library published by other means, or a non-Node project leaves
 * this `null`; `verify-detachable` then skips the tarball check entirely.
 *
 *   export const PACK_CHECK = { command: 'pnpm', args: ['pack', '--dry-run', '--json'] }
 */
export const PACK_CHECK = { command: 'pnpm', args: ['pack', '--dry-run', '--json'] }

/** Gates that are switched on. `verify-all` runs exactly these. */
export const ENABLED_GATES = [
  'verify-agent-note-format',
  'verify-agent-skills',
  'verify-context-cost',
  'verify-detachable',
  'verify-doc-budgets',
  'verify-human-docs',
  'verify-md-links',
  // Repository-only: checks this repo's preset mirror. Absent from the template.
  'verify-preset',
  'verify-scaffold',
  'verify-shared-purity',
]

/* ── Ignored paths ──────────────────────────────────────────────────────── */

/**
 * Directories every walk skips. Kept cross-language on purpose: `lib/` is a
 * source directory in Dart, Elixir and Ruby, so it is NOT here — a project that
 * builds into `lib/` adds it itself.
 */
export const IGNORE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  '.pnpm-store',
  '.venv',
  '__pycache__',
  'target',
  'vendor',
  '.next',
]

/* ── Budgets, in counting units ─────────────────────────────────────────── */

/** Exact-path budgets. */
export const FILE_BUDGETS = [
  { path: 'AGENTS.md', limit: 600 },
  { path: '.agents/README.md', limit: 400 },
  { path: '.agents/notes/README.md', limit: 900 },
]

/** Every module document under ARCHITECTURE_DIR shares this ceiling. */
export const ARCHITECTURE_BUDGET = 600

/** Every Agent Note shares this ceiling. */
export const NOTE_BUDGET = 1500

/** Every project skill shares this ceiling. */
export const SKILL_BUDGET = 800

/**
 * Preset skills are not always-loaded (they live in an installed preset), so
 * they get a looser ceiling. The cap stops unbounded growth; it does not force
 * the same density as a project skill.
 */
export const PRESET_SKILL_BUDGET = 1600

/**
 * The untracked personal overlay. Its own pool, so a handful of personal habits
 * cannot push the team ratchet — but it is still capped, because the host
 * injects it on every turn whether or not the team agreed to it.
 */
export const LOCAL_BUDGET = 250

/** Warn once a document is this close to its ceiling. */
export const WARN_RATIO = 0.9

/* ── Always-loaded chain ────────────────────────────────────────────────── */

/** The always-loaded chain the host injects, root first. */
export const CONTEXT_CHAIN = [
  'AGENTS.md',
  '.agents/AGENTS.md',
  '.agents/notes/AGENTS.md',
  '.agents/notes/implemented/AGENTS.md',
  '.agents/skills/AGENTS.md',
  '.agents/architecture/AGENTS.md',
]

/**
 * The personal overlay, injected by the host alongside `AGENTS.md` when present.
 * Lives outside the chain on purpose: it is printed as a conditional row and
 * never counted into the team baseline.
 */
export const LOCAL_OVERLAY = 'AGENTS.local.md'

/**
 * Measured chain baseline, in counting units. A ratchet, not a target: raise it
 * only with a deliberate budget decision, never to make a red run green.
 */
export const CONTEXT_BASELINE = 600

/* ── Structure ──────────────────────────────────────────────────────────── */

/** The only H2 sections the root entry file may carry, in this order. */
export const ROOT_SECTIONS = [
  '项目定位',
  '目录导航',
  '命令矩阵',
  '参考入口',
  '三条纪律',
]

/** H2 the navigation table sits under. */
export const NAV_SECTION = '目录导航'

/**
 * Human-facing map. `null` means the project has no separate map and the
 * module documents carry the whole story. When set, `verify-human-docs` checks
 * its sections, its data-flow figure and its code tour.
 */
export const HUMAN_MAP = null
