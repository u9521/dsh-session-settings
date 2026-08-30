import type { Context } from '@deepseek-ai/cordis'
import type { McpServerStore, SessionSettingsStore } from '../types.ts'
import { loadMcpStore } from './mcp/storage.ts'
import { loadSessionSettingsStore } from './session/storage.ts'
import { McpManager } from './mcp/manager.ts'
import { registerMcpRoutes } from './mcp/routes.ts'
import { registerSessionSettingsRoutes } from './session/routes.ts'
import { registerSkillsRoutes } from './skills/routes.ts'
import { registerSubagentModelInterceptor } from './subagent-model/interceptor.ts'
import { registerMcpInterceptors } from './mcp/interceptor.ts'
import { registerSkillsInterceptors } from './skills/interceptor.ts'

export const name = 'session-settings'
export const inject = ['webServer']

export function apply(ctx: Context): void {
  let mcpStore: McpServerStore = loadMcpStore()
  let sessionSettingsStore: SessionSettingsStore = loadSessionSettingsStore()

  // MCP Manager to handle tool discovery, registration on ctx.tools, and execution
  const mcpManager = new McpManager(
    ctx,
    () => mcpStore,
    () => sessionSettingsStore,
  )

  const webServer = ctx.get('webServer')
  if (webServer) {
    const unregisterMcp = registerMcpRoutes(
      webServer,
      () => mcpStore,
      (s) => {
        mcpStore = s
      },
      mcpManager,
      () => sessionSettingsStore,
      (s) => {
        sessionSettingsStore = s
      },
    )
    const unregisterSessionSettings = registerSessionSettingsRoutes(
      ctx,
      webServer,
      () => sessionSettingsStore,
      (s) => {
        sessionSettingsStore = s
      },
      mcpManager,
    )
    const unregisterSkills = registerSkillsRoutes(ctx, webServer)

    ctx.effect(() => {
      return () => {
        unregisterMcp()
        unregisterSessionSettings()
        unregisterSkills()
      }
    }, 'session-settings: webServer routes')
  }

  // Sync tools on startup
  mcpManager.syncAll()

  ctx.effect(() => {
    return () => {
      mcpManager.dispose()
    }
  }, 'session-settings: mcpManager')

  // Register domain interceptors
  registerSubagentModelInterceptor(ctx, () => sessionSettingsStore)
  registerMcpInterceptors(
    ctx,
    () => sessionSettingsStore,
    () => mcpStore,
    mcpManager,
  )
  registerSkillsInterceptors(ctx, () => sessionSettingsStore)
}

// Domain Exports
export * from '../types.ts'
export * from './common/paths.ts'
export * from './common/http.ts'
export * from './mcp/storage.ts'
export * from './mcp/naming.ts'
export * from './mcp/manager.ts'
export * from './mcp/routes.ts'
export * from './mcp/interceptor.ts'
export * from './mcp/tester/index.ts'
export * from './session/storage.ts'
export * from './session/routes.ts'
export * from './skills/discovery.ts'
export * from './skills/interceptor.ts'
export * from './skills/routes.ts'
export * from './subagent-model/interceptor.ts'
