#!/usr/bin/env node
/**
 * Gate: markdown relative links and heading anchors.
 *
 * Documentation is the interface agents read; a broken relative link silently
 * costs a whole lookup cycle. Absolute URLs and site-absolute paths are out of
 * scope, fenced code blocks are never parsed (they legitimately contain
 * bracketed shell syntax).
 */
import { dirname, posix } from 'node:path'
import {
  finish,
  governedMarkdown,
  headingAnchors,
  headings,
  isDir,
  isFile,
  readText,
} from './_shared.mjs'

const LINK = /!?\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const SCHEME = /^[a-z][a-z0-9+.-]*:/i

const failures = []
const anchorCache = new Map()
let checked = 0

function anchorsOf(relPath) {
  if (!anchorCache.has(relPath)) {
    const set = new Set()
    for (const heading of headings(relPath)) {
      for (const anchor of headingAnchors(heading.text)) set.add(anchor)
    }
    anchorCache.set(relPath, set)
  }
  return anchorCache.get(relPath)
}

function decode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

for (const relPath of governedMarkdown()) {
  const fileLines = readText(relPath).split('\n')
  let inFence = false

  fileLines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      return
    }
    if (inFence) return

    for (const match of line.matchAll(LINK)) {
      const rawTarget = match[2]
      if (SCHEME.test(rawTarget)) continue // external URL or mailto:
      if (rawTarget.startsWith('/')) continue // site-absolute, not a repo path
      checked += 1

      const [rawPath = '', rawAnchor = ''] = rawTarget.split('#')
      const localPath = decode(rawPath)
      const target = localPath
        ? posix.normalize(posix.join(dirname(relPath), localPath))
        : relPath

      if (!isFile(target) && !isDir(target)) {
        failures.push(`${relPath}:${index + 1} — 链接目标不存在: ${rawTarget}`)
        continue
      }
      if (!rawAnchor || isDir(target)) continue
      if (!target.endsWith('.md')) continue

      const anchor = decode(rawAnchor)
      if (!anchorsOf(target).has(anchor)) {
        failures.push(
          `${relPath}:${index + 1} — 锚点不存在于 ${target}: #${anchor}`,
        )
      }
    }
  })
}

finish(
  'verify-md-links',
  failures,
  `${checked} 条相对链接与锚点均可解析（${governedMarkdown().length} 个文件）`,
)
