import type { Context } from '@deepseek-ai/cordis'
import type { McpServerStore, SessionSettingsStore } from '../types.ts'
import { loadMcpStore } from './mcp/storage.ts'
import { loadSessionSettingsStore } from './session/storage.ts'
import { McpManager } from './mcp/manager.ts'
import { registerMcpRoutes } from './mcp/routes.ts'
import { registerSessionSettingsRoutes } from './session/routes.ts'
import { registerSkillsRoutes } from './skills/routes.ts'
import { registerSubagentModelInterceptor } from './subagent-model/interceptor.ts'
import { registerMcpPolicyProjection } from './mcp/interceptor.ts'
import { registerSkillsInterceptors } from './skills/interceptor.ts'
export const name = 'session-settings'
// `connection` is required rather than optional: it is the only carrier that
// applies the Host/Origin fence and browser authentication. Registering these
// routes on `webServer` directly would bypass that gate, so a profile without
// the carrier must fail to load this plugin instead of serving them unguarded.
export const inject = ['connection', 'loader']

export function apply(ctx: Context): void {
  let mcpStore: McpServerStore | null = null
  let sessionSettingsStore: SessionSettingsStore | null = null

  const getMcpStore = (): McpServerStore => {
    if (!mcpStore) {
      mcpStore = loadMcpStore()
    }
    return mcpStore
  }

  const setMcpStore = (s: McpServerStore): void => {
    mcpStore = s
  }

  const getSessionSettingsStore = (): SessionSettingsStore => {
    if (!sessionSettingsStore) {
      sessionSettingsStore = loadSessionSettingsStore()
    }
    return sessionSettingsStore
  }

  const setSessionSettingsStore = (s: SessionSettingsStore): void => {
    sessionSettingsStore = s
  }

  // MCP Manager to handle tool discovery, registration on ctx.tools, and execution
  const mcpManager = new McpManager(ctx, getMcpStore, getSessionSettingsStore)

  const mcpPolicyProjection = registerMcpPolicyProjection(
    ctx,
    getSessionSettingsStore,
    getMcpStore,
    mcpManager,
  )
  const invalidatePolicies = () => mcpPolicyProjection.notifyPolicyChanged()

  const connection = ctx.get('connection')
  if (connection) {
    const unregisterMcp = registerMcpRoutes(
      connection,
      getMcpStore,
      setMcpStore,
      mcpManager,
      getSessionSettingsStore,
      setSessionSettingsStore,
      invalidatePolicies,
    )
    const unregisterSessionSettings = registerSessionSettingsRoutes(
      ctx,
      connection,
      getSessionSettingsStore,
      setSessionSettingsStore,
      mcpManager,
      invalidatePolicies,
    )
    const unregisterSkills = registerSkillsRoutes(
      ctx,
      connection,
      getSessionSettingsStore,
    )

    ctx.effect(() => {
      // The carrier returns async disposers; Cordis effects accept a promise.
      return async () => {
        await unregisterMcp()
        await unregisterSessionSettings()
        await unregisterSkills()
      }
    }, 'session-settings: authenticated api routes')
  }

  ctx.effect(() => {
    return () => mcpManager.dispose()
  }, 'session-settings: mcpManager')

  // Register domain interceptors
  registerSubagentModelInterceptor(ctx, getSessionSettingsStore)
  registerSkillsInterceptors(ctx, getSessionSettingsStore)
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
