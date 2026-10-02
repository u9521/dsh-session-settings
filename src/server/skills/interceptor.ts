import type { Context } from '@deepseek-ai/cordis'
import type { Agent, SessionSettingsStore } from '../../types.ts'
import { SkillPolicyProjection } from './policy-projection.ts'

/**
 * Wire per-session skill invocation policy onto each agent's scope.
 *
 * This replaces the former approach of overwriting `snapshot()`/`get()` on the
 * shared service instance. Enforcement now rides the skill registry's own
 * layered registrations: a same-name runtime skill registered through
 * `agent.ctx` shadows the inherited declaration for that agent alone, and
 * `@deepseek-ai/dsh-tool-skill` already refuses a skill whose
 * `invocation.modelInvocable` is false. The execution-time guard is therefore
 * no longer needed — the registry reports the skill as unavailable.
 *
 * `agent/created` is serial and holds queued input until every listener settles,
 * so a shadow exists before the agent's first catalog read. A listener that
 * throws FAILS agent creation, hence the blanket try/catch.
 */
export function registerSkillsInterceptors(
  ctx: Context,
  getSessionSettingsStore: () => SessionSettingsStore,
): SkillPolicyProjection {
  const projection = new SkillPolicyProjection(ctx, getSessionSettingsStore)

  ctx.on('agent/created', async ({ agent }: { agent: Agent }) => {
    try {
      await projection.applyToAgent(agent)
    } catch (err: unknown) {
      // Never let policy installation break agent creation.
      console.warn(
        '[session-settings] [SKILL-POLICY] Failed to install skill policy for agent; continuing without it:',
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

  return projection
}
