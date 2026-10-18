#!/usr/bin/env node
/**
 * Gate: the framework stays detachable from the project.
 *
 * The dependency arrow points one way: the framework may read the project, the
 * project must never mention the framework. Otherwise deleting `AGENTS.md` and
 * `.agents/` leaves dangling references in manifests, READMEs and build config,
 * and the framework can no longer be lifted out of a published repository.
 *
 * Three checks, because they fail differently:
 *
 *   1. tracked project files must not name a managed path;
 *   2. every file allowed to name one (CI workflows, hooks) must carry a guard,
 *      so a framework-less checkout skips instead of failing;
 *   3. the publish tarball must not contain a managed path.
 *
 * The packaging check only runs when the project declares one (`PACK_CHECK`),
 * because a service or a non-Node project has no tarball to inspect.
 */
import { spawnSync } from 'node:child_process'
import {
  CI,
  FRAMEWORK_AWARE_FILES,
  LOCAL_OVERLAY,
  MANAGED_PATHS,
  PACK_CHECK,
} from './config.mjs'
import { finish, isFile, readText } from './_shared.mjs'

/**
 * Guards that make a framework-aware file harmless when the framework is gone.
 * Each platform spells "skip when absent" differently; any one is enough.
 */
const GUARDS = [
  /hashFiles\(/, // GitHub Actions
  /^\s*-\s*exists:\s*/m, // GitLab CI rules
  /-f\s+\.agents\/gates\/verify-all\.mjs/, // shell existence test
  /test\s+-f\s+\.agents\/gates\//, // shell existence test, long form
]

/** Files permitted to name a managed path, by their own declaration. */
const allowed = new Set([
  ...FRAMEWORK_AWARE_FILES,
  ...(CI === null ? [] : [CI.path]),
])

/** The last path segment of a marker, for readable messages. */
const isManaged = (relPath) =>
  MANAGED_PATHS.some((prefix) =>
    prefix.endsWith('/')
      ? relPath.startsWith(prefix)
      : relPath === prefix,
  )

const failures = []

const tracked = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
if (tracked.status !== 0) {
  failures.push('git ls-files 失败；该闸门必须在 git 工作区内运行')
} else {
  for (const relPath of tracked.stdout.split('\0').filter(Boolean)) {
    if (isManaged(relPath)) continue
    if (!isFile(relPath)) continue

    const text = readText(relPath)
    // A tracked image, font or wasm decodes to replacement characters; reading
    // it is wasted work and can only produce noise.
    if (text.includes('\0')) continue

    const fileLines = text.split('\n')
    const hits = []
    for (const prefix of MANAGED_PATHS) {
      fileLines.forEach((line, index) => {
        if (line.includes(prefix)) hits.push({ line: index + 1, prefix })
      })
    }
    if (hits.length === 0) continue

    if (!allowed.has(relPath)) {
      for (const { line, prefix } of hits) {
        failures.push(
          `${relPath}:${line} — 项目文件提及受管路径 "${prefix}"；框架必须可整体删除`,
        )
      }
      continue
    }

    // Allowed, but only if it degrades gracefully without the framework.
    if (!GUARDS.some((guard) => guard.test(text))) {
      failures.push(
        `${relPath}: 允许引用框架，但缺少守卫；框架删除后该文件必须跳过而不是失败（见 CI platform 模板）`,
      )
    }
  }
}

for (const relPath of allowed) {
  if (!isFile(relPath)) {
    failures.push(`${relPath}: 声明为可引用框架的文件不存在（配置已过期）`)
  }
}

// The personal overlay is untracked by definition: it does not exist in anyone
// else's checkout, so committing it would hand every collaborator someone
// else's habits.
if (tracked.status === 0 && tracked.stdout.split('\0').includes(LOCAL_OVERLAY)) {
  failures.push(
    `${LOCAL_OVERLAY}: 个人覆写层已被 git 跟踪；执行 git rm --cached ${LOCAL_OVERLAY}`,
  )
}

if (PACK_CHECK !== null) {
  const packed = spawnSync(PACK_CHECK.command, PACK_CHECK.args, {
    encoding: 'utf8',
  })
  if (packed.status !== 0) {
    failures.push(
      `${PACK_CHECK.command} ${PACK_CHECK.args.join(' ')} 失败：${(packed.stderr ?? '').trim()}`,
    )
  } else {
    let manifest
    try {
      manifest = JSON.parse(packed.stdout)
    } catch {
      failures.push('打包清单输出无法解析为 JSON；检查 PACK_CHECK 配置')
    }
    for (const file of manifest?.files ?? []) {
      if (MANAGED_PATHS.some((prefix) => file.path.startsWith(prefix))) {
        failures.push(`发布产物包含框架文件 ${file.path}`)
      }
    }
  }
}

finish(
  'verify-detachable',
  failures,
  PACK_CHECK === null
    ? `项目文件未引用框架（未配置打包检查）`
    : `项目文件未引用框架，发布产物不含 ${MANAGED_PATHS.length} 类受管路径`,
)
