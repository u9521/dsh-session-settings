#!/usr/bin/env node
/**
 * Gate: local project skills.
 *
 * A skill that the loader cannot identify is a skill nobody can invoke, and a
 * description that does not say *when* to use it makes the catalog entry
 * unusable. Both are cheap to check and expensive to notice.
 */
import { finish, isDir, readText, walk } from './_shared.mjs'

const SKILL_DIR = '.agents/skills'
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const failures = []
const seen = new Map()
const skills = []

for (const relPath of walk(SKILL_DIR, (p) => p.endsWith('.md'))) {
  const segments = relPath.split('/')
  if (segments.at(-1) !== 'SKILL.md') continue
  if (segments.length !== 4) {
    failures.push(`${relPath}: 技能必须是 ${SKILL_DIR}/<name>/SKILL.md`)
    continue
  }

  const dirName = segments[2]
  skills.push(relPath)
  if (!NAME_PATTERN.test(dirName)) {
    failures.push(`${relPath}: 技能目录名必须是 kebab-case，当前 "${dirName}"`)
  }
  if (seen.has(dirName)) {
    failures.push(`${relPath}: 技能名与 ${seen.get(dirName)} 重复`)
  } else {
    seen.set(dirName, relPath)
  }

  const fileLines = readText(relPath).split('\n')
  if (fileLines[0]?.trim() !== '---') {
    failures.push(`${relPath}:1 — 必须以 YAML frontmatter 开头（第一行为 ---）`)
    continue
  }
  const closing = fileLines.findIndex(
    (line, index) => index > 0 && line.trim() === '---',
  )
  if (closing === -1) {
    failures.push(`${relPath}: frontmatter 未闭合（缺少结束的 ---）`)
    continue
  }

  const frontmatter = fileLines.slice(1, closing)
  const name = frontmatter.find((line) => line.startsWith('name:'))
  const description = frontmatter.find((line) =>
    line.startsWith('description:'),
  )

  if (!name) failures.push(`${relPath}: frontmatter 缺少 name`)
  else if (
    name
      .slice('name:'.length)
      .trim()
      .replace(/^["']|["']$/g, '') !== dirName
  ) {
    failures.push(`${relPath}: frontmatter 的 name 必须等于目录名 "${dirName}"`)
  }

  if (!description) {
    failures.push(`${relPath}: frontmatter 缺少 description`)
  } else if (description.slice('description:'.length).trim().length < 20) {
    failures.push(`${relPath}: description 过短，必须说明何时使用该技能`)
  }

  const body = fileLines.slice(closing + 1).join('\n')
  if (!/^##\s+\S/m.test(body)) failures.push(`${relPath}: 正文缺少二级标题章节`)
}

if (isDir(SKILL_DIR) && skills.length === 0) {
  failures.push(`${SKILL_DIR}: 目录存在但没有任何技能`)
}

finish(
  'verify-agent-skills',
  failures,
  `${skills.length} 个项目技能 frontmatter 合规`,
)
