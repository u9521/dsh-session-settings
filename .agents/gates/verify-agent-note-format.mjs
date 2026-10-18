#!/usr/bin/env node
/**
 * Gate: Agent Note format.
 *
 * Enforces the path-encoded contract documented in `.agents/notes/README.md`:
 * `<status>/<kind>/yyyy-mm-dd-<slug>.md`, a `# Agent Note: <title>` H1 followed
 * by a `Status:` line matching the directory, and the required sections.
 */
import { finish, lines, isFile, walk } from './_shared.mjs'
import { NOTE_MODE } from './config.mjs'

/** Which states exist depends on the strength the project chose at init. */
const STATUSES =
  NOTE_MODE === 'two-state'
    ? ['proposed', 'implemented']
    : ['proposed', 'implemented', 'rejected', 'archived']
const KINDS = [
  'feature',
  'bug-fix',
  'simplification',
  'architecture',
  'process',
  'testing',
]
/** A proposal still has open questions, so it carries acceptance and risks. */
const PROPOSED_SECTIONS = [
  'Problem',
  'Proposal',
  'Alternatives considered',
  'Acceptance criteria',
  'Risks',
]

/** A shipped decision has no open questions left: risks become consequences. */
const IMPLEMENTED_SECTIONS = [
  'Problem',
  'Decision',
  'Alternatives considered',
  'Consequences',
]

const REJECTED_SECTIONS = ['Problem', 'Proposal', 'Alternatives considered']
const ARCHIVED_SECTIONS = ['Problem', 'Proposal']
const SLUG = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const IGNORED_BASENAMES = new Set(['AGENTS.md', 'README.md'])

const failures = []

if (NOTE_MODE === 'disabled') {
  finish('verify-agent-note-format', [], '已跳过（NOTE_MODE=disabled）')
  process.exit(0)
}

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
    // `rejected` carries a one-line reason after an em dash; the status word
    // before it is what has to match the directory.
    const statusWord = declared.split(/[—–-]/)[0].trim()
    if (statusWord !== status) {
      failures.push(
        `${relPath}:${statusLine.line} — Status: ${declared} 与目录 "${status}" 不一致`,
      )
    }
    if (status === 'rejected' && !/[—–-]\s*\S/.test(declared)) {
      failures.push(
        `${relPath}:${statusLine.line} — rejected 必须写成 "Status: rejected — <一行理由>"`,
      )
    }
  }

  const required =
    status === 'archived'
      ? ARCHIVED_SECTIONS
      : status === 'rejected'
        ? REJECTED_SECTIONS
        : status === 'implemented'
          ? IMPLEMENTED_SECTIONS
          : PROPOSED_SECTIONS

  for (const section of required) {
    if (!mentionsHeading(content, section)) {
      failures.push(`${relPath}: 缺少 "## ${section}"（${status} 骨架）`)
    }
  }

  if (status === 'archived' && !/^Superseded by:\s*\S/m.test(content)) {
    failures.push(`${relPath}: 归档笔记必须写 "Superseded by: <path|none>"`)
  }
}

/** The governance contract is the single source for path, header and sections. */
if (!isFile('.agents/notes/README.md')) {
  failures.push('.agents/notes/README.md: 治理契约文件缺失')
}

finish(
  'verify-agent-note-format',
  failures,
  `${notes.length} 篇笔记格式合规（状态 ${STATUSES.join('/')}，分类 ${KINDS.length} 种）`,
)
