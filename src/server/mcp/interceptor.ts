import type { Context } from '@deepseek-ai/cordis'
import type {
  AssembleContext,
  McpServerStore,
  PreToolDecision,
  PromptAssembly,
  SessionSettingsStore,
  ToolExecution,
  ToolSchema,
} from '../../types.ts'
import type { McpManager } from './manager.ts'
import { publicToolName } from './naming.ts'
import { resolveEffectiveMcp } from '../session/storage.ts'
import {
  resolveAgentSessionId,
  resolveWorkspaceForSession,
} from '../session/resolution.ts'

export function registerMcpInterceptors(
  ctx: Context,
  getSessionSettingsStore: () => SessionSettingsStore,
  getMcpStore: () => McpServerStore,
  mcpManager?: McpManager,
): void {
  // 1. Filter prompt assembly tools: remove disabled MCP tools and tools from disabled MCP servers
  ctx.on(
    'system-prompt/assemble',
    async (
      _assembly: PromptAssembly,
      context: AssembleContext,
      next: () => Promise<PromptAssembly>,
    ): Promise<PromptAssembly> => {
      const sessionId = resolveAgentSessionId(context?.agent)
      const workspaceId = await resolveWorkspaceForSession(ctx, sessionId)

      const sessionSettingsStore = getSessionSettingsStore()
      const mcpStore = getMcpStore()
      const effectiveMcp = resolveEffectiveMcp(
        sessionSettingsStore,
        mcpStore,
        sessionId,
        workspaceId,
      )
      const enabledServerIds = new Set(effectiveMcp.enabledServerIds)

      // On-demand lazy mount: ensure servers needed for this session are mounted BEFORE tools are assembled
      if (effectiveMcp.enabledServerIds.length > 0) {
        await mcpManager?.ensureServersMounted(effectiveMcp.enabledServerIds)
      }

      const transformed = await next()
      if (
        !transformed ||
        !Array.isArray(transformed.tools) ||
        transformed.tools.length === 0
      ) {
        return transformed
      }

      const allServers = Object.values(mcpStore.servers)

      // Map of serverId -> Set of disabled public tool names
      const disabledPublicNamesByServer = new Map<string, Set<string>>()
      for (const server of allServers) {
        const disabledList =
          effectiveMcp.effectiveDisabledTools[server.id] ?? []
        if (disabledList.length > 0) {
          const disabledSet = new Set<string>()
          for (const rawName of disabledList) {
            disabledSet.add(publicToolName(server.id, rawName))
            disabledSet.add(`mcp__${server.id}__${rawName}`)
          }
          disabledPublicNamesByServer.set(server.id, disabledSet)
        }
      }

      const filteredTools = transformed.tools.filter((tool: ToolSchema) => {
        if (!tool || typeof tool.name !== 'string') return true

        // 1. Precise check via McpManager metadata map
        const meta = mcpManager?.getToolMeta(tool.name)
        if (meta) {
          if (!enabledServerIds.has(meta.serverId)) {
            return false
          }
          const disabledList =
            effectiveMcp.effectiveDisabledTools[meta.serverId] ?? []
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
  ctx.on(
    'tools/pre-execute',
    async (
      exec: ToolExecution,
      next: () => Promise<PreToolDecision>,
    ): Promise<PreToolDecision> => {
      const toolName = exec?.name
      if (
        typeof toolName === 'string' &&
        (toolName.startsWith('mcp__') || mcpManager?.isMcpTool(toolName))
      ) {
        const sessionId = resolveAgentSessionId(exec?.agent)
        const workspaceId = await resolveWorkspaceForSession(ctx, sessionId)

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
            effectiveMcp.effectiveDisabledTools[meta.serverId] ?? []
          if (disabledList.includes(meta.rawName)) {
            return {
              kind: 'deny',
              reason: `unknown tool "${toolName}"`,
            }
          }
          await mcpManager?.ensureServersMounted([meta.serverId])
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
              effectiveMcp.effectiveDisabledTools[server.id] ?? []
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
    },
  )
}
