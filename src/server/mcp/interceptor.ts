import type { Context } from '@deepseek-ai/cordis'
import type { McpServerStore, SessionSettingsStore } from '../../types.ts'
import type { McpManager } from './manager.ts'
import { publicToolName } from './naming.ts'
import { resolveEffectiveMcp } from '../session/storage.ts'
import { resolveWorkspaceForSession } from '../session/routes.ts'

export function registerMcpInterceptors(
  ctx: Context,
  getSessionSettingsStore: () => SessionSettingsStore,
  getMcpStore: () => McpServerStore,
  mcpManager?: McpManager,
): void {
  // 1. Filter prompt assembly tools: remove disabled MCP tools and tools from disabled MCP servers
  ;(ctx as any).on(
    'system-prompt/assemble',
    async (_assembly: any, context: any, next: any) => {
      const transformed = await next()
      if (
        !transformed ||
        !Array.isArray(transformed.tools) ||
        transformed.tools.length === 0
      ) {
        return transformed
      }

      const sessionId =
        context?.agent?.session?.id ||
        context?.agent?.session?.header?.parentSession ||
        context?.agent?.id
      const workspaceId =
        context?.agent?.session?.header?.workspaceId ||
        resolveWorkspaceForSession(ctx, sessionId)

      const sessionSettingsStore = getSessionSettingsStore()
      const mcpStore = getMcpStore()
      const effectiveMcp = resolveEffectiveMcp(
        sessionSettingsStore,
        mcpStore,
        sessionId,
        workspaceId,
      )
      const enabledServerIds = new Set(effectiveMcp.enabledServerIds)
      const allServers = Object.values(mcpStore.servers)

      // Map of serverId -> Set of disabled public tool names
      const disabledPublicNamesByServer = new Map<string, Set<string>>()
      for (const server of allServers) {
        const disabledList =
          effectiveMcp.effectiveDisabledTools[server.id] ??
          server.disabledTools ??
          []
        if (disabledList.length > 0) {
          const disabledSet = new Set<string>()
          for (const rawName of disabledList) {
            disabledSet.add(publicToolName(server.id, rawName))
            disabledSet.add(`mcp__${server.id}__${rawName}`)
          }
          disabledPublicNamesByServer.set(server.id, disabledSet)
        }
      }

      const filteredTools = transformed.tools.filter((tool: any) => {
        if (!tool || typeof tool.name !== 'string') return true

        // 1. Precise check via McpManager metadata map
        const meta = mcpManager?.getToolMeta(tool.name)
        if (meta) {
          if (!enabledServerIds.has(meta.serverId)) {
            return false
          }
          const disabledList =
            effectiveMcp.effectiveDisabledTools[meta.serverId] ??
            mcpStore.servers[meta.serverId]?.disabledTools ??
            []
          if (disabledList.includes(meta.rawName)) {
            return false
          }
          return true
        }

        // 2. Fallback prefix check for tools with mcp__ prefix
        if (tool.name.startsWith('mcp__')) {
          for (const server of allServers) {
            const prefix = `mcp__${server.id}__`
            if (tool.name.startsWith(prefix)) {
              // Is this server enabled for current session?
              if (!enabledServerIds.has(server.id)) {
                return false
              }
              // Is this specific tool disabled on this server?
              const disabledSet = disabledPublicNamesByServer.get(server.id)
              if (disabledSet && disabledSet.has(tool.name)) {
                return false
              }
            }
          }
        }

        return true
      })

      return {
        ...transformed,
        tools: filteredTools,
      }
    },
  )

  // 2. Pre-execution guard: deny any execution attempt of disabled MCP tools with standard unknown tool error
  ;(ctx as any).on('tools/pre-execute', async (exec: any, next: any) => {
    const toolName = exec?.name
    if (
      typeof toolName === 'string' &&
      (toolName.startsWith('mcp__') || mcpManager?.isMcpTool(toolName))
    ) {
      const sessionId =
        exec?.agent?.session?.id ||
        exec?.agent?.session?.header?.parentSession ||
        exec?.agent?.id
      const workspaceId =
        exec?.agent?.session?.header?.workspaceId ||
        resolveWorkspaceForSession(ctx, sessionId)

      const sessionSettingsStore = getSessionSettingsStore()
      const mcpStore = getMcpStore()
      const effectiveMcp = resolveEffectiveMcp(
        sessionSettingsStore,
        mcpStore,
        sessionId,
        workspaceId,
      )
      const enabledServerIds = new Set(effectiveMcp.enabledServerIds)

      // 1. Precise check via McpManager
      const meta = mcpManager?.getToolMeta(toolName)
      if (meta) {
        if (!enabledServerIds.has(meta.serverId)) {
          return {
            kind: 'deny',
            reason: `unknown tool "${toolName}"`,
          }
        }
        const disabledList =
          effectiveMcp.effectiveDisabledTools[meta.serverId] ??
          mcpStore.servers[meta.serverId]?.disabledTools ??
          []
        if (disabledList.includes(meta.rawName)) {
          return {
            kind: 'deny',
            reason: `unknown tool "${toolName}"`,
          }
        }
        return next()
      }

      // 2. Fallback prefix check
      for (const server of Object.values(mcpStore.servers)) {
        const prefix = `mcp__${server.id}__`
        if (toolName.startsWith(prefix)) {
          if (!enabledServerIds.has(server.id)) {
            return {
              kind: 'deny',
              reason: `unknown tool "${toolName}"`,
            }
          }
          const disabledList =
            effectiveMcp.effectiveDisabledTools[server.id] ??
            server.disabledTools ??
            []
          if (disabledList.length > 0) {
            const disabledNames = new Set(
              disabledList.flatMap((raw) => [
                publicToolName(server.id, raw),
                `mcp__${server.id}__${raw}`,
              ]),
            )
            if (disabledNames.has(toolName)) {
              return {
                kind: 'deny',
                reason: `unknown tool "${toolName}"`,
              }
            }
          }
        }
      }
    }
    return next()
  })
}
