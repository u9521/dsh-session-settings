import type { Context } from '@deepseek-ai/cordis'
import type { McpServerStore, SessionSettingsStore } from '../types.ts'
import { openStores, type OpenStores } from './storage/domains.ts'
import { McpManager } from './mcp/manager.ts'
import { McpServerRegistry } from './mcp/registry.ts'
import { registerMcpRoutes } from './mcp/routes.ts'
import { registerSessionSettingsRoutes } from './session/routes.ts'
import { registerSkillsRoutes } from './skills/routes.ts'
import { registerSubagentModelInterceptor } from './subagent-model/interceptor.ts'
import { registerMcpPolicyProjection } from './mcp/interceptor.ts'
import { registerSkillsInterceptors } from './skills/interceptor.ts'
import { registerSandboxInterceptor } from './sandbox/interceptor.ts'
import { PolicyBus } from './common/policy-bus.ts'
export const name = 'session-settings'
// `connection` is required rather than optional: it is the only carrier that
// applies the Host/Origin fence and browser authentication. Registering these
// routes on `webServer` directly would bypass that gate, so a profile without
// the carrier must fail to load this plugin instead of serving them unguarded.
export const inject = ['connection', 'loader']

export function apply(ctx: Context): void {
  applyWithStores(ctx)
}

/**
 * Wire the plugin once the two configuration domains are open.
 *
 * Opening is asynchronous and needs `ctx.storageDomain`, which may not be
 * mounted when `apply` runs: composition row order carries no load semantics,
 * so the work is deferred through `inject`. A domain that fails to open leaves
 * the plugin unloaded, which is the loud failure the old file reader never had.
 */
function applyWithStores(ctx: Context): void {
  ctx.inject(['storageDomain'], async (scoped: Context) => {
    const stores = await openStores(scoped)
    mount(scoped, stores)
  })
}

function mount(ctx: Context, stores: OpenStores): void {
  const getMcpStore = (): McpServerStore => stores.mcpServers
  const getSessionSettingsStore = (): SessionSettingsStore =>
    stores.sessionSettings

  // MCP Manager to handle tool discovery, registration on ctx.tools, and execution
  const mcpManager = new McpManager(ctx, getMcpStore, getSessionSettingsStore)

  const mcpPolicyProjection = registerMcpPolicyProjection(
    ctx,
    getSessionSettingsStore,
    getMcpStore,
    mcpManager,
  )

  // Sandbox allow-list: widens `ctx.sandbox.confine` with the session's extra
  // writable directories and contributes them to the model's runtime context.
  // Registered BEFORE the routes so a settings save can invalidate it.
  const sandboxInterceptor = registerSandboxInterceptor(
    ctx,
    getSessionSettingsStore,
  )

  const skillPolicyProjection = registerSkillsInterceptors(
    ctx,
    getSessionSettingsStore,
  )

  // One invalidation seam for every policy surface. Registration order is the
  // contract: the manager syncs first (a mount or unmount changes the tool set),
  // then the three projections re-install their declarations against it.
  const policyBus = new PolicyBus()
  policyBus.subscribe('mcp-manager', () => mcpManager.syncAll())
  policyBus.subscribe('mcp-projection', () =>
    mcpPolicyProjection.notifyPolicyChanged(),
  )
  policyBus.subscribe('sandbox-projection', () =>
    sandboxInterceptor.notifyPolicyChanged(),
  )
  policyBus.subscribe('skill-projection', () => {
    // Re-registration loads skill bodies, so it is async; the bus is
    // synchronous and must not await one surface while the others wait.
    void skillPolicyProjection.notifyPolicyChanged().catch(() => {})
  })
  const invalidatePolicies = () => policyBus.invalidate()

  const connection = ctx.get('connection')
  if (connection) {
    const unregisterMcp = registerMcpRoutes(
      connection,
      new McpServerRegistry({
        getStore: getMcpStore,
        manager: mcpManager,
        getSessionSettingsStore,
        persistSessionSettings: stores.persistSessionSettings,
        persistMcpServers: stores.persistMcpServers,
        invalidate: invalidatePolicies,
      }),
    )
    const unregisterSessionSettings = registerSessionSettingsRoutes(
      ctx,
      connection,
      getSessionSettingsStore,
      stores.persistSessionSettings,
      invalidatePolicies,
      (sessionId) => sandboxInterceptor.detectCapability(sessionId),
      (sessionId) => sandboxInterceptor.skippedFor(sessionId),
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
}
// Domain Exports
export * from '../types.ts'
export * from './common/http.ts'
export * from './common/policy-bus.ts'
export * from './storage/domains.ts'
export * from './mcp/naming.ts'
export * from './mcp/manager.ts'
export * from './mcp/registry.ts'
export * from './mcp/routes.ts'
export * from './mcp/interceptor.ts'
export * from './mcp/tester/index.ts'
export * from './session/storage.ts'
export * from './session/routes.ts'
export * from './skills/discovery.ts'
export * from './skills/interceptor.ts'
export * from './skills/routes.ts'
export * from './sandbox/paths.ts'
export * from './sandbox/interceptor.ts'
export * from './sandbox/fs-proxy.ts'
export * from './subagent-model/interceptor.ts'
