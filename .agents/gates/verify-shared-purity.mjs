#!/usr/bin/env node
/**
 * Gate: the shared tree stays pure.
 *
 * `src/shared/**` is the only code both halves load, so it must run in the
 * browser closure as well as in Node. A value import of `node:*`, a host
 * package, or React would either break the client bundle purity gate at build
 * time (best case) or smuggle a Node-only dependency into the browser (worst
 * case). Type-only imports are erased and stay allowed.
 */
import { finish, isDir, readText, walk } from './_shared.mjs'

/** Prefixes a shared module may never VALUE-import. */
const FORBIDDEN = [/^node:/, /^@deepseek-ai\//, /^react$/, /^react-dom/]

/** Value imports only; `import type` is erased and therefore harmless. */
const IMPORT =
  /^\s*(?:import|export)\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm
const BARE_IMPORT = /^\s*import\s+['"]([^'"]+)['"]/gm

const failures = []
let checked = 0

if (!isDir('src/shared')) {
  console.log('✓ verify-shared-purity: src/shared 尚未存在，跳过')
  process.exit(0)
}

for (const relPath of walk('src/shared', (p) => p.endsWith('.ts'))) {
  checked++
  const text = readText(relPath)
  for (const pattern of [IMPORT, BARE_IMPORT]) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(text)) !== null) {
      const specifier = match[1]
      if (FORBIDDEN.some((rule) => rule.test(specifier))) {
        failures.push(
          `${relPath}: 值导入了 ${specifier}；src/shared 只能使用纯 TS 与相对路径`,
        )
      }
    }
  }
}

finish('verify-shared-purity', failures, `${checked} 个共享模块保持纯净`)
