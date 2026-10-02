#!/usr/bin/env node
/**
 * Gate: Agent Note format.
 *
 * Enforces the path-encoded contract documented in `.agents/notes/README.md`:
 * `<status>/<kind>/yyyy-mm-dd-<slug>.md`, a `# Agent Note: <title>` H1 followed
 * by a `Status:` line matching the directory, and the required sections.
 */
import { finish, lines, isFile, walk } from './_shared.mjs'

const STATUSES = ['proposed', 'implemented', 'rejected', 'archived']
const KINDS = [
  'feature',
  'bug-fix',
  'simplification',
  'architecture',
  'process',
  'testing',
]
const REQUIRED_SECTIONS = [
  'Problem',
  'Proposal',
  'Alternatives considered',
  'Acceptance criteria',
  'Risks',
]
const ARCHIVED_SECTIONS = ['Problem', 'Proposal']
const SLUG = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const IGNORED_BASENAMES = new Set(['AGENTS.md', 'README.md'])

const failures = []
const notes = []

const mentionsHeading = (text, heading) =>
  new RegExp(
    `^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
    'm',
  ).test(text)

for (const relPath of walk('.agents/notes', (p) => p.endsWith('.md'))) {
  const segments = relPath.split('/')
  const basename = segments.at(-1)
  if (IGNORED_BASENAMES.has(basename)) continue
  if (segments.length !== 5) {
    failures.push(
      `${relPath}: 路径必须是 <status>/<kind>/<file>.md（当前为 ${segments.length - 2} 层）`,
    )
    continue
  }

  const [, , status, kind] = segments
  if (!STATUSES.includes(status)) {
    failures.push(
      `${relPath}: 未知状态目录 "${status}"，允许值 ${STATUSES.join(' / ')}`,
    )
  }
  if (!KINDS.includes(kind)) {
    failures.push(
      `${relPath}: 未知分类目录 "${kind}"，允许值 ${KINDS.join(' / ')}`,
    )
  }
  if (!SLUG.test(basename)) {
    failures.push(`${relPath}: 文件名必须是 yyyy-mm-dd-<kebab-slug>.md`)
  }
  if (!STATUSES.includes(status) || !KINDS.includes(kind)) continue

  notes.push(relPath)
  const content = lines(relPath).join('\n')
  const fileLines = lines(relPath)

  const titleMatch = /^# Agent Note: (.+?)\s*$/.exec(
    fileLines.find((l) => l.trim()) ?? '',
  )
  if (!titleMatch) {
    failures.push(`${relPath}:1 — 首行必须是 "# Agent Note: <标题>"`)
  } else if (!titleMatch[1].trim()) {
    failures.push(`${relPath}:1 — Note 标题不能为空`)
  }

  const statusLine = fileLines
    .slice(0, 20)
    .map((text, index) => ({ text, line: index + 1 }))
    .find(({ text }) => /^Status:\s*\S/.test(text.trim()))
  if (!statusLine) {
    failures.push(`${relPath}: 前 20 行内缺少 "Status: <status>"`)
  } else {
    const declared = statusLine.text.trim().replace(/^Status:\s*/, '')
    if (declared !== status) {
      failures.push(
        `${relPath}:${statusLine.line} — Status: ${declared} 与目录 "${status}" 不一致`,
      )
    }
  }

  if (status === 'archived') {
    for (const section of ARCHIVED_SECTIONS) {
      if (!mentionsHeading(content, section))
        failures.push(`${relPath}: 缺少 "## ${section}"`)
    }
    if (!/^Superseded by:\s*\S/m.test(content)) {
      failures.push(`${relPath}: 归档笔记必须写 "Superseded by: <path|none>"`)
    }
  } else {
    for (const section of REQUIRED_SECTIONS) {
      if (!mentionsHeading(content, section))
        failures.push(`${relPath}: 缺少 "## ${section}"`)
    }
  }
}

for (const required of ['.agents/notes/README.md', '.agents/notes/AGENTS.md']) {
  if (!isFile(required)) failures.push(`${required}: 治理契约文件缺失`)
}
if (!isFile('.agents/notes/implemented/AGENTS.md')) {
  failures.push(
    '.agents/notes/implemented/AGENTS.md: implemented 树的工作说明缺失',
  )
}

finish(
  'verify-agent-note-format',
  failures,
  `${notes.length} 篇笔记格式合规（状态 ${STATUSES.join('/')}，分类 ${KINDS.length} 种）`,
)
