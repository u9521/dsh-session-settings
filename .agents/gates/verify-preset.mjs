#!/usr/bin/env node
/**
 * Gate: the preset mirror has not drifted from the framework it describes.
 *
 * `.agents/preset/` holds the source of the engineering preset, which lives
 * outside this repository and is installed into `~/.dsh/profiles/...`. The
 * gate scripts under `.agents/gates/` are byte-identical to the copies in
 * `.agents/preset/templates/gates/` so an update can replace them wholesale.
 *
 * That duplication is deliberate and this gate is what makes it safe: the two
 * copies must match exactly, and `config.mjs` — the project slot holding every
 * repository-specific value — must be absent from the template, because those
 * values belong to the repository, not to the preset. The template carries
 * `config.mjs.tmpl` instead: the same exports with placeholder values.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { finish, isDir, isFile, ROOT } from './_shared.mjs'

const GATES_DIR = '.agents/gates'
const TEMPLATE_DIR = '.agents/preset/templates/gates'

/**
 * Files that belong to a repository and must never be shipped in a template:
 * the budget slot, this self-check, and the gates that encode this project's own
 * architecture (a two-half plugin with a shared pure tree). A template only
 * carries the gates that hold for any repository.
 */
const PROJECT_ONLY = new Set([
  'config.mjs',
  'verify-preset.mjs',
  'verify-shared-purity.mjs',
])

const failures = []

if (!isDir(TEMPLATE_DIR)) {
  failures.push(`${TEMPLATE_DIR}: 预设镜像缺失`)
} else {
  const gateFiles = readdirSync(join(ROOT, GATES_DIR)).filter((name) =>
    name.endsWith('.mjs'),
  )
  const templateFiles = readdirSync(join(ROOT, TEMPLATE_DIR)).filter((name) =>
    name.endsWith('.mjs'),
  )

  for (const name of gateFiles) {
    if (PROJECT_ONLY.has(name)) {
      if (templateFiles.includes(name)) {
        failures.push(
          `${TEMPLATE_DIR}/${name}: 项目槽位不得进入模板——预算数值属于仓库`,
        )
      }
      continue
    }
    if (!templateFiles.includes(name)) {
      failures.push(`${TEMPLATE_DIR}/${name}: 模板缺少该脚本`)
      continue
    }
    const source = readFileSync(join(ROOT, GATES_DIR, name), 'utf8')
    const mirror = readFileSync(join(ROOT, TEMPLATE_DIR, name), 'utf8')
    if (source !== mirror) {
      failures.push(
        `${TEMPLATE_DIR}/${name}: 与 ${GATES_DIR}/${name} 不一致；改一处必须同步另一处`,
      )
    }
  }

  for (const name of templateFiles) {
    if (!gateFiles.includes(name)) {
      failures.push(`${TEMPLATE_DIR}/${name}: 仓内没有对应脚本（陈旧模板）`)
    }
  }
}

for (const required of [
  '.agents/preset/templates/gates/config.mjs.tmpl',
  '.agents/preset/preset.yml',
  '.agents/preset/skills/init-agent-native/SKILL.md',
  '.agents/preset/skills/audit-doc-slop/SKILL.md',
  '.agents/preset/templates/AGENTS.md.tmpl',
  '.agents/preset/templates/architecture.md',
  '.agents/preset/templates/notes-README.md',
  '.agents/preset/templates/framework-README.md',
  '.agents/preset/templates/ci/github-agent-gates.yml',
  '.agents/preset/templates/ci/gitlab-agent-gates.yml',
  '.agents/preset/templates/ci/custom-agent-gates.sh',
]) {
  if (!isFile(required)) failures.push(`${required}: 预设必需文件缺失`)
}

for (const relPath of [
  '.agents/preset/skills/init-agent-native/SKILL.md',
  '.agents/preset/skills/audit-doc-slop/SKILL.md',
  '.agents/preset/templates/skills/commit/SKILL.md',
  '.agents/preset/templates/skills/pre-push-checks/SKILL.md',
  '.agents/preset/templates/skills/code-review/SKILL.md',
  '.agents/preset/templates/skills/write-agent-note/SKILL.md',
]) {
  if (!isFile(relPath)) continue
  const text = readFileSync(join(ROOT, relPath), 'utf8')
  const begins = (text.match(/<!-- repo:begin -->/g) ?? []).length
  const ends = (text.match(/<!-- repo:end -->/g) ?? []).length
  if (begins !== ends) {
    failures.push(
      `${relPath}: repo:begin ${begins} 个、repo:end ${ends} 个，槽位标记必须成对`,
    )
  }
}

finish(
  'verify-preset',
  failures,
  '预设镜像与仓内闸门逐字一致，项目槽位未泄漏进模板',
)
