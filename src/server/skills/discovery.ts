import type { Context } from '@deepseek-ai/cordis'
import type {
  Agent,
  SessionSettingsStore,
  SkillDefinition,
  SkillItem,
  SkillsService,
} from '../../types.ts'
import { resolveSessionCwd } from '../session/resolution.ts'
import { resolveEffectiveSkills } from '../session/storage.ts'
import { resolveWorkspaceForSession } from '../session/resolution.ts'

/** The preset registry slice this plugin consumes. */
interface AgentPresetsService {
  acquireScope?: (
    id?: string,
  ) => Promise<{ key?: unknown; [Symbol.asyncDispose]?: () => Promise<void> }>
  serviceFor?: (agent: { ctx: Context }, name: string) => unknown
}

/**
 * Bucket a skill by its provider-declared {@link SkillSource}: `user-*` and
 * `project-*` are filesystem-backed, everything else (bundled, runtime, custom)
 * ships with the composition and is listed after them.
 */
function classifySkillSource(skill: { source?: string }): {
  isRuntime: boolean
  source: string
} {
  const source = (skill.source ?? '').toLowerCase()
  if (source.includes('user')) return { isRuntime: false, source }
  if (source.includes('project')) return { isRuntime: false, source }
  return { isRuntime: true, source: source || 'runtime' }
}

function compareSkills(a: SkillItem, b: SkillItem): number {
  if (Boolean(a.isRuntime) !== Boolean(b.isRuntime)) {
    return a.isRuntime ? 1 : -1
  }
  return a.name.localeCompare(b.name)
}

/** Durable preset id of a session, read from the header (live, then stored). */
async function resolvePresetId(
  ctx: Context,
  sessionId?: string,
): Promise<string | undefined> {
  if (!sessionId) return undefined

  const live = ctx.get('sessions')?.get?.(sessionId)
  if (live?.header?.agentPreset) return live.header.agentPreset

  const persistence = ctx.get('sessionPersistence')
  if (typeof persistence?.stat === 'function') {
    try {
      return (await persistence.stat(sessionId))?.header?.agentPreset
    } catch {
      // Ignore persistence faults; fall back to the default preset.
    }
  }
  return undefined
}

/**
 * Resolve the skill-registry view scopes for a session's DISPLAY read.
 *
 * Enforcement lives in each agent's own scope layer, but a scoped read only
 * traverses from its key UPWARD — so reading from a preset's generation scope
 * can never observe an agent-layer shadow. Display therefore reads the base
 * composition and applies the disable flags itself, keeping the GUI independent
 * of the mechanism that enforces the policy.
 *
 * A live agent is used when present because its scope chain includes the
 * composition; otherwise the preset registry lends a standing scope lease
 * (preset providers register into that layer), which the caller must release.
 */
async function resolveScopes(
  ctx: Context,
  sessionId?: string,
): Promise<{ scopes: unknown[]; release: () => Promise<void> }> {
  const liveAgent = sessionId
    ? (ctx.get('agents')?.get?.(sessionId) as Agent | undefined)
    : undefined
  if (liveAgent) return { scopes: [liveAgent], release: async () => {} }

  const presets = ctx.get('agentPresets') as AgentPresetsService | undefined
  if (typeof presets?.acquireScope === 'function') {
    try {
      const lease = await presets.acquireScope(
        await resolvePresetId(ctx, sessionId),
      )
      if (lease?.key) {
        return {
          scopes: [lease.key],
          release: async () => {
            try {
              await lease[Symbol.asyncDispose]?.()
            } catch {
              // The lease is best-effort; a failed release must not fail a read.
            }
          },
        }
      }
    } catch {
      // Unknown preset or unusable composition: fall back to the global layer.
    }
  }
  return { scopes: [undefined], release: async () => {} }
}

/**
 * Per-session invocation policy to overlay onto a DISPLAY read.
 *
 * The registry read is invocation-neutral by design; consumers apply policy at
 * their own boundary. Display does the same, so the flags shown in the GUI match
 * what enforcement will do without the GUI reaching into a scope layer (a scoped
 * read can never see a nearer scope's shadow).
 */
async function resolveDisplayPolicy(
  ctx: Context,
  store: SessionSettingsStore | undefined,
  sessionId?: string,
): Promise<{ disabledModel: Set<string>; disabledUser: Set<string> }> {
  if (!store) {
    return { disabledModel: new Set(), disabledUser: new Set() }
  }
  const workspaceId = await resolveWorkspaceForSession(ctx, sessionId)
  const effective = resolveEffectiveSkills(store, sessionId, workspaceId)
  return {
    disabledModel: new Set(effective.effectiveDisabledModelSkills ?? []),
    disabledUser: new Set(effective.effectiveDisabledUserSkills ?? []),
  }
}

/** The registry instance to read for one scope (agent-scoped when available). */
function skillRegistryFor(
  ctx: Context,
  scope: unknown,
): SkillsService | undefined {
  const presets = ctx.get('agentPresets') as AgentPresetsService | undefined
  if (
    scope &&
    typeof scope === 'object' &&
    'ctx' in scope &&
    typeof presets?.serviceFor === 'function'
  ) {
    try {
      const service = presets.serviceFor(
        scope as { ctx: Context },
        'skills',
      ) as SkillsService | undefined
      if (service) return service
    } catch {
      // Fall through to the global registry.
    }
  }
  return ctx.get('skills')
}

export async function getAvailableSkills(
  ctx: Context,
  sessionId?: string,
  store?: SessionSettingsStore,
): Promise<SkillItem[]> {
  const cwd = await resolveSessionCwd(ctx, sessionId)
  const { scopes, release } = await resolveScopes(ctx, sessionId)
  const policy = await resolveDisplayPolicy(ctx, store, sessionId)
  const map = new Map<string, SkillItem>()

  try {
    for (const scope of scopes) {
      const registry = skillRegistryFor(ctx, scope)
      if (typeof registry?.list !== 'function') continue
      try {
        const list = await registry.list({ cwd, scope })
        for (const skill of list ?? []) {
          if (map.has(skill.name)) continue
          const { isRuntime, source } = classifySkillSource(skill)
          const modelInvocable =
            (skill.invocation?.modelInvocable ?? true) &&
            !policy.disabledModel.has(skill.name)
          const userInvocable =
            (skill.invocation?.userInvocable ?? true) &&
            !policy.disabledUser.has(skill.name)
          map.set(skill.name, {
            name: skill.name,
            description: skill.description ?? '',
            whenToUse: skill.whenToUse,
            provider: skill.provider || 'skills-registry',
            source,
            modelInvocable,
            userInvocable,
            isRuntime,
          })
        }
      } catch {
        // A failing provider must not hide the others.
      }
    }
  } finally {
    await release()
  }

  return Array.from(map.values()).sort(compareSkills)
}

export async function getSkillDetail(
  ctx: Context,
  name: string,
  sessionId?: string,
  store?: SessionSettingsStore,
): Promise<SkillItem | null> {
  const cwd = await resolveSessionCwd(ctx, sessionId)
  const { scopes, release } = await resolveScopes(ctx, sessionId)
  const policy = await resolveDisplayPolicy(ctx, store, sessionId)

  try {
    for (const scope of scopes) {
      const registry = skillRegistryFor(ctx, scope)
      if (typeof registry?.get !== 'function') continue
      try {
        const skill: SkillDefinition | undefined = await registry.get(name, {
          cwd,
          scope,
        })
        if (!skill) continue
        const { isRuntime, source } = classifySkillSource(skill)
        return {
          name: skill.name,
          description: skill.description ?? '',
          whenToUse: skill.whenToUse,
          provider: skill.provider || 'skills-registry',
          source,
          path: skill.path ?? skill.resourceBase?.path,
          content: skill.content,
          modelInvocable:
            (skill.invocation?.modelInvocable ?? true) &&
            !policy.disabledModel.has(skill.name),
          userInvocable:
            (skill.invocation?.userInvocable ?? true) &&
            !policy.disabledUser.has(skill.name),
          isRuntime,
        }
      } catch {
        // Try the next scope.
      }
    }
  } finally {
    await release()
  }

  return null
}
