import fs from 'node:fs'
import type { McpServerStore } from '../../types.ts'
import { getMcpStoragePath } from '../common/paths.ts'

export function loadMcpStore(): McpServerStore {
  try {
    const file = getMcpStoragePath()
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8')
      if (content.trim()) {
        const data = JSON.parse(content)
        if (data && typeof data === 'object' && data.servers) {
          return { servers: data.servers }
        }
      }
    }
  } catch (err) {
    console.error(
      '[session-settings:mcp-storage] Failed to load MCP store:',
      err,
    )
  }
  return { servers: {} }
}

export function saveMcpStore(store: McpServerStore): void {
  try {
    const file = getMcpStoragePath(true)
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8')
    fs.renameSync(tmp, file)
  } catch (err) {
    console.error(
      '[session-settings:mcp-storage] Failed to save MCP store:',
      err,
    )
  }
}
