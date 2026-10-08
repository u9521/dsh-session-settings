import type { SandboxAllowEntry } from '../types/index.ts'

/**
 * Scenario presets for the sandbox panel's extra writable directories.
 *
 * These are a **frontend fill-in convenience and nothing more**. They do not
 * describe what exists on this machine, they are not consulted by any
 * enforcement layer, and they add no contract: a template is a button that
 * writes ordinary {@link SandboxAllowEntry} rows into the panel's draft, after
 * which the rows are indistinguishable from hand-typed ones.
 *
 * ## Grouped by scenario, not by existence
 *
 * Templates answer "what does doing Android work usually require writing?" —
 * not "what is installed here?". Those are different questions and the
 * difference is load-bearing: the common case for granting a toolchain
 * directory is that the directory is about to be populated by the very build
 * the user is trying to run. `~/Android/Sdk` is absent on a machine that has
 * never installed an SDK, which is precisely when the Android preset is
 * wanted. Filtering by existence would hide every preset at the moment it
 * becomes useful, so the list is grouped by the task instead.
 *
 * ## Why the paths are `~`, unexpanded
 *
 * The client has no home directory, and deliberately so: the settings snapshot
 * carries no such field, so a template that pre-expanded `~` would have to
 * invent one. `~` is expanded server-side in `server/sandbox/paths.ts`, which
 * is also what keeps these presets independent of the workspace — they stay
 * usable in a page that has resolved no workspace yet.
 *
 * Each path is the tool's documented DEFAULT. `ANDROID_HOME`,
 * `GRADLE_USER_HOME`, `PNPM_HOME`, `XDG_CACHE_HOME` and friends relocate them,
 * which is why every filled row stays editable.
 *
 * ## Why the descriptions live here rather than in the locale files
 *
 * A description is not UI copy. It travels into the runtime-context prompt
 * beside its path (`server/sandbox/interceptor.ts` renders `- "<path>" — <desc>`),
 * so it is data the model reads. Keeping the two language variants here, next
 * to the paths they describe, is what stops a path from being retargeted
 * without its sentence being revisited.
 *
 * @module session-settings/client/sandboxTemplates
 */

/** One preset: a task, and the directories it typically needs to write. */
export interface SandboxPathTemplate {
  /**
   * Stable id, also the React key for the group.
   *
   * Not a locale key: the label is resolved separately so the group heading is
   * translated while the entries beside it are not.
   */
  readonly id: string
  /** Locale key for the group heading, e.g. `sessionSettings.sandbox.templates.rust`. */
  readonly labelKey: string
  /** Rows this preset fills. Order is the order they appear in the panel. */
  readonly entries: readonly SandboxAllowEntry[]
}

/**
 * Presets shared by both languages.
 *
 * Only `description` differs between locales, so the structure — ids, labels,
 * paths, ordering — is defined once and the two language tables below supply
 * the sentences. A path cannot drift between locales this way.
 */
const TEMPLATE_SHAPE: readonly {
  readonly id: string
  readonly paths: readonly string[]
}[] = [
  {
    id: 'android',
    paths: [
      '~/Android/Sdk',
      '~/.gradle/caches',
      '~/.gradle/wrapper',
      '~/.android',
      '~/.m2/repository',
    ],
  },
  { id: 'rust', paths: ['~/.cargo', '~/.rustup'] },
  {
    id: 'python',
    paths: [
      '~/.cache/uv',
      '~/.local/share/uv',
      '~/.cache/pip',
      '~/.cache/pypoetry',
      '~/miniconda3/pkgs',
    ],
  },
  {
    id: 'node',
    paths: [
      '~/.npm',
      '~/.cache/yarn',
      '~/.local/share/pnpm/store',
      '~/.bun/install/cache',
      '~/.cache/ms-playwright',
    ],
  },
  { id: 'go', paths: ['~/go/pkg/mod', '~/.cache/go-build'] },
  { id: 'java', paths: ['~/.m2/repository', '~/.gradle/caches'] },
  {
    id: 'generic',
    paths: ['~/.cache', '~/.docker'],
  },
]

/**
 * Build a preset table from one language's sentences.
 *
 * @param descriptions - path to sentence, for every path in {@link TEMPLATE_SHAPE}.
 * @returns the presets, in group order.
 */
function buildTemplates(
  descriptions: Readonly<Record<string, string>>,
): readonly SandboxPathTemplate[] {
  return TEMPLATE_SHAPE.map((group) => ({
    id: group.id,
    labelKey: `sessionSettings.sandbox.templates.${group.id}`,
    entries: group.paths.map((path) => ({
      path,
      // A missing sentence would silently produce a bare path in the prompt,
      // which is the one outcome this module exists to prevent.
      description: descriptions[path] ?? path,
    })),
  }))
}

const ZH_DESCRIPTIONS: Readonly<Record<string, string>> = {
  '~/Android/Sdk': 'Android SDK 与平台工具',
  '~/.gradle/caches': 'Gradle 依赖与构建缓存',
  '~/.gradle/wrapper': 'Gradle 发行版 wrapper',
  '~/.android': 'Android 调试与 AVD 元数据',
  '~/.m2/repository': 'Maven 本地仓库（Java 依赖）',
  '~/.cargo': 'Cargo 下载源与 registry 缓存',
  '~/.rustup': 'rustup 工具链与组件',
  '~/.cache/uv': 'uv 包缓存与脚本虚拟环境',
  '~/.local/share/uv': 'uv 管理的 Python 版本与工具',
  '~/.cache/pip': 'pip wheel 与 HTTP 缓存',
  '~/.cache/pypoetry': 'Poetry 包缓存',
  '~/miniconda3/pkgs': 'conda 已解压包缓存',
  '~/.npm': 'npm 包缓存（_cacache）',
  '~/.cache/yarn': 'yarn 包缓存',
  '~/.local/share/pnpm/store': 'pnpm 内容寻址仓库',
  '~/.bun/install/cache': 'Bun 全局包缓存',
  '~/.cache/ms-playwright': 'Playwright 浏览器二进制',
  '~/go/pkg/mod': 'Go 模块下载缓存（GOMODCACHE）',
  '~/.cache/go-build': 'Go 编译中间产物',
  '~/.cache': '通用 XDG 缓存根（范围较宽）',
  '~/.docker': 'Docker 配置与凭据',
}

const EN_DESCRIPTIONS: Readonly<Record<string, string>> = {
  '~/Android/Sdk': 'Android SDK and platform tools',
  '~/.gradle/caches': 'Gradle dependency and build caches',
  '~/.gradle/wrapper': 'Gradle distribution wrapper',
  '~/.android': 'Android debug and AVD metadata',
  '~/.m2/repository': 'Maven local repository (Java dependencies)',
  '~/.cargo': 'Cargo download and registry cache',
  '~/.rustup': 'rustup toolchains and components',
  '~/.cache/uv': 'uv package cache and script virtualenvs',
  '~/.local/share/uv': 'uv-managed Python versions and tools',
  '~/.cache/pip': 'pip wheel and HTTP cache',
  '~/.cache/pypoetry': 'Poetry package cache',
  '~/miniconda3/pkgs': 'conda extracted package cache',
  '~/.npm': 'npm package cache (_cacache)',
  '~/.cache/yarn': 'yarn package cache',
  '~/.local/share/pnpm/store': 'pnpm content-addressable store',
  '~/.bun/install/cache': 'Bun global package cache',
  '~/.cache/ms-playwright': 'Playwright browser binaries',
  '~/go/pkg/mod': 'Go module download cache (GOMODCACHE)',
  '~/.cache/go-build': 'Go build cache',
  '~/.cache': 'General XDG cache root (broad)',
  '~/.docker': 'Docker configuration and credentials',
}

/** Presets with Chinese descriptions. */
export const SANDBOX_PATH_TEMPLATES_ZH = buildTemplates(ZH_DESCRIPTIONS)

/** Presets with English descriptions. */
export const SANDBOX_PATH_TEMPLATES_EN = buildTemplates(EN_DESCRIPTIONS)

/**
 * The preset table for a language.
 *
 * @param locale - the active locale; anything but `en` selects Chinese, which
 *   matches the plugin's other copy where Chinese is the default rendering.
 * @returns that language's presets.
 */
export function sandboxPathTemplates(
  locale?: string,
): readonly SandboxPathTemplate[] {
  return locale === 'en' ? SANDBOX_PATH_TEMPLATES_EN : SANDBOX_PATH_TEMPLATES_ZH
}

/**
 * The rows a preset would still add.
 *
 * Comparison is on the LITERAL path, with no normalization. The client cannot
 * normalize correctly: `.` and relative paths resolve against the workspace and
 * `~` against a home directory it does not know, so any equivalence it computed
 * here could disagree with what `server/sandbox/paths.ts` actually grants. A
 * literal comparison can only under-detect duplicates (a user who typed
 * `/home/me/.cargo` by hand and then clicks Rust gets a second row), which is
 * visible and fixable; a clever one could silently claim two different
 * directories are the same grant.
 *
 * @param existing - rows already in the draft.
 * @param entries - the preset's rows.
 * @returns the subset of `entries` whose path is not already present.
 */
export function missingEntries(
  existing: readonly SandboxAllowEntry[],
  entries: readonly SandboxAllowEntry[],
): SandboxAllowEntry[] {
  const seen = new Set(existing.map((entry) => entry.path))
  const out: SandboxAllowEntry[] = []
  for (const entry of entries) {
    if (seen.has(entry.path)) continue
    // Guards against a preset that lists one path twice.
    seen.add(entry.path)
    out.push(entry)
  }
  return out
}
