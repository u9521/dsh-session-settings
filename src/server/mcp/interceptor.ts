import type { Context } from '@deepseek-ai/cordis'
import type {
  Agent,
  McpServerStore,
  SessionSettingsStore,
} from '../../types.ts'
import type { McpManager } from './manager.ts'
import { McpPolicyProjection } from './policy-projection.ts'

/**
 * Wire the per-session MCP policy onto each agent's scope.
 *
 * This replaces the former event-interception approach. Enforcement now lives in
 * the tool registry's own scope layers (`tools.restrict()` / `tools.guard()`)
 * and in scoped prompt-section shadowing, so a new surface added by the Host is
 * governed by the registry rather than by a listener that must know its name.
 *
 * `agent/created` is serial and holds queued input until every listener settles,
 * so declarations installed here exist before the agent's first prompt assembly.
 * A listener that throws FAILS agent creation, hence the blanket try/catch.
 */
export function registerMcpPolicyProjection(
  ctx: Context,
  getSessionSettingsStore: () => SessionSettingsStore,
  getMcpStore: () => McpServerStore,
  mcpManager: McpManager,
): McpPolicyProjection {
  const projection = new McpPolicyProjection(
    ctx,
    getMcpStore,
    getSessionSettingsStore,
    mcpManager,
  )
  projection.start()

  ctx.on('agent/created', async ({ agent }: { agent: Agent }) => {
    try {
      await projection.applyToAgent(agent)
    } catch (err: unknown) {
      // Never let policy installation break agent creation.
      console.warn(
        '[session-settings] [MCP-POLICY] Failed to install MCP policy for agent; continuing without it:',
        err instanceof Error ? err.message : String(err),
      )
    }
  })

  ctx.on('agent/disposed', ({ agent }: { agent: Agent }) => {
    try {
      projection.forget(agent)
    } catch {
      // Bookkeeping only.
    }
  })

  // Mount trigger only: this never filters or rewrites the assembly. Keeping it
  // here means a cold server's tools already exist for the turn being assembled,
  // while whether they may be SEEN is decided by the agent's scope declarations.
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    try {
      await projection.ensureMountedFor(context?.agent as Agent | undefined)
    } catch {
      // A mount problem must never fail assembly.
    }
    return next()
  })

  return projection
}
