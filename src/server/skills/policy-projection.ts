import type { Context } from '@deepseek-ai/cordis'
import type {
  Agent,
  SessionSettingsStore,
  SkillDefinition,
  SkillsService,
} from '../../types.ts'
import { resolveEffectiveSkills } from '../session/storage.ts'
import {
  resolveAgentSessionId,
  resolveWorkspaceForSession,
} from '../session/resolution.ts'

/**
 * Enforce per-session skill invocation policy through the skill registry's own
 * scope layers.
 *
 * `ctx.skills.register()` files a runtime skill into the CALLING context's
 * layer, and a nearer layer wins a duplicate name outright. Registering a
 * same-name entry through `agent.ctx` therefore re-declares that one skill for
 * exactly that agent with the invocation flags the session wants — the registry
 * needs no rewriting, and `@deepseek-ai/dsh-tool-skill` enforces the result
 * natively, because it filters the catalog and loads bodies through
 * `invocation.modelInvocable` / `userInvocable`.
 *
 * Only names the session actually restricts are shadowed, so no body is loaded
 * or duplicated for untouched skills.
 */
export class SkillPolicyProjection {
  private readonly ctx: Context
  private readonly getSessionSettingsStore: () => SessionSettingsStore

  /** agent -> (skill name -> disposer of that agent's shadowing registration). */
  private readonly installed = new Map<Agent, Map<string, () => void>>()
  /** agent -> serialized disabled sets currently installed, for idempotence. */
  private readonly installedKeys = new Map<Agent, string>()

  constructor(
    ctx: Context,
    getSessionSettingsStore: () => SessionSettingsStore,
  ) {
    this.ctx = ctx
    this.getSessionSettingsStore = getSessionSettingsStore
  }

  /** Apply this agent's skill policy; awaited by the `agent/created` listener. */
  public async applyToAgent(agent: Agent): Promise<void> {
    await this.refresh(agent)
  }

  /** Drop bookkeeping for a disposed agent; its scoped registrations unwind with its context. */
  public forget(agent: Agent): void {
    this.installed.delete(agent)
    this.installedKeys.delete(agent)
  }

  /** Re-apply every live agent after a settings change. */
  public async notifyPolicyChanged(): Promise<void> {
    await Promise.all(
      Array.from(this.installed.keys()).map(async (agent) => {
        try {
          await this.refresh(agent, true)
        } catch {
          // One agent's failure must not block the others.
        }
      }),
    )
  }

  /** Recompute and re-install one agent's shadows. */
  private async refresh(agent: Agent, force = false): Promise<void> {
    const skills = agent.ctx.get('skills') as SkillsService | undefined
    if (!skills || typeof skills.register !== 'function') return

    const sessionId = resolveAgentSessionId(agent, this.ctx)
    const workspaceId = await resolveWorkspaceForSession(this.ctx, sessionId)
    const effective = resolveEffectiveSkills(
      this.getSessionSettingsStore(),
      sessionId,
      workspaceId,
    )

    const disabledModel = new Set(effective.effectiveDisabledModelSkills ?? [])
    const disabledUser = new Set(effective.effectiveDisabledUserSkills ?? [])
    const key = `${[...disabledModel].sort().join('\u0000')}\u0001${[
      ...disabledUser,
    ]
      .sort()
      .join('\u0000')}`

    if (!force && this.installedKeys.get(agent) === key) return

    // Uninstall before reading: the agent's own layer must be empty when the
    // catalog is sampled, otherwise a previous shadow would be the thing read
    // back. It also keeps `register()` from warning about a duplicate name.
    this.clear(agent)
    this.installedKeys.set(agent, key)

    const wanted = new Set([...disabledModel, ...disabledUser])
    if (wanted.size === 0) return

    for (const name of wanted) {
      const definition = await this.loadAsAgentSeesIt(agent, name)
      if (!definition) continue

      const modelInvocable = !disabledModel.has(name)
      const userInvocable = !disabledUser.has(name)
      const current = definition.invocation
      if (
        modelInvocable === (current?.modelInvocable ?? true) &&
        userInvocable === (current?.userInvocable ?? true)
      ) {
        // Policy already matches the inherited declaration: shadowing would be
        // pure overhead.
        continue
      }

      try {
        const dispose = skills.register({
          name: definition.name,
          description: definition.description,
          content: definition.content,
          ...(definition.whenToUse !== undefined
            ? { whenToUse: definition.whenToUse }
            : {}),
          source: definition.source,
          ...(definition.path !== undefined ? { path: definition.path } : {}),
          ...(definition.provider !== undefined
            ? { provider: definition.provider }
            : {}),
          ...(definition.resourceBase !== undefined
            ? { resourceBase: definition.resourceBase }
            : {}),
          invocation: { modelInvocable, userInvocable },
        })
        this.mapFor(agent).set(name, dispose)
      } catch (err: unknown) {
        console.warn(
          `[session-settings] [SKILL-POLICY] Failed to shadow skill "${name}":`,
          err instanceof Error ? err.message : String(err),
        )
      }
    }
  }

  /**
   * Load one skill exactly as the agent would resolve it.
   *
   * An Agent's scope key is the Agent itself (`@deepseek-ai/dsh-scope`'s
   * `createScope(loopCtx, agent)`), and the registry resolves the scope chain
   * from that key, so passing the agent yields the nearest-wins view the model
   * would see. The agent's own layer was cleared immediately before this call.
   */
  private async loadAsAgentSeesIt(
    agent: Agent,
    name: string,
  ): Promise<SkillDefinition | undefined> {
    const registry = this.ctx.get('skills') as SkillsService | undefined
    if (typeof registry?.get !== 'function') return undefined
    const cwd = agent.session?.header?.cwd
    try {
      return await registry.get(name, { cwd, scope: agent })
    } catch {
      return undefined
    }
  }

  private mapFor(agent: Agent): Map<string, () => void> {
    let map = this.installed.get(agent)
    if (!map) {
      map = new Map()
      this.installed.set(agent, map)
    }
    return map
  }

  private clear(agent: Agent): void {
    const map = this.installed.get(agent)
    if (!map) return
    for (const dispose of map.values()) {
      try {
        dispose()
      } catch {
        // Disposal is best-effort.
      }
    }
    map.clear()
  }
}
