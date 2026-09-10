import type { Context } from '@deepseek-ai/cordis'
import type {
  Agent,
  SessionHeader,
  SkillDefinition,
  SkillItem,
  SkillsService,
} from '../../types.ts'
import { resolveSessionCwd } from '../session/resolution.ts'

function classifySkillSource(skill: {
  provider?: string
  source?: string
  metadata?: Readonly<Record<string, unknown>>
}): { isRuntime: boolean; source: string } {
  if (!skill) return { isRuntime: false, source: 'user-dsh' }

  // 1. Explicit metadata override (if declared in YAML frontmatter)
  const metaType =
    typeof skill.metadata?.type === 'string'
      ? (skill.metadata.type as string).toLowerCase()
      : typeof skill.metadata?.scope === 'string'
        ? (skill.metadata.scope as string).toLowerCase()
        : undefined

  if (
    metaType === 'user' ||
    metaType === 'user-dsh' ||
    metaType === 'user-agents'
  ) {
    return { isRuntime: false, source: 'user-dsh' }
  }
  if (
    metaType === 'project' ||
    metaType === 'project-dsh' ||
    metaType === 'project-agents'
  ) {
    return { isRuntime: false, source: 'project-dsh' }
  }
  if (
    metaType === 'preset' ||
    metaType === 'runtime' ||
    metaType === 'bundled'
  ) {
    return { isRuntime: true, source: 'runtime' }
  }

  // 2. Official SkillSource enumeration contract from DSH (@deepseek-ai/dsh-skill)
  const src = (skill.source || '').toLowerCase()

  switch (src) {
    case 'user-dsh':
    case 'user-agents':
      return { isRuntime: false, source: src }

    case 'project-dsh':
    case 'project-agents':
      return { isRuntime: false, source: src }

    case 'custom':
    case 'custom-preset':
    case 'bundled-preset':
    case 'preset':
    case 'runtime':
    case 'bundled':
      return { isRuntime: true, source: src }

    default:
      if (src.includes('user')) {
        return { isRuntime: false, source: 'user-dsh' }
      }
      if (src.includes('project')) {
        return { isRuntime: false, source: 'project-dsh' }
      }
      return { isRuntime: true, source: src || 'runtime' }
  }
}

function compareSkills(a: SkillItem, b: SkillItem): number {
  const aRuntime = Boolean(a.isRuntime)
  const bRuntime = Boolean(b.isRuntime)
  // Non-runtime skills first, runtime skills last (置底)
  if (aRuntime !== bRuntime) {
    return aRuntime ? 1 : -1
  }
  return a.name.localeCompare(b.name)
}

function resolveSessionPreset(session?: {
  header?: SessionHeader
  snapshotEvents?: () => readonly unknown[]
}): string | undefined {
  if (!session) return undefined
  if (typeof session.snapshotEvents === 'function') {
    const events = session.snapshotEvents()
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index] as
        { type?: string; data?: { agentPreset?: string } } | undefined
      if (event?.type === 'agent-preset/selected') {
        return event.data?.agentPreset
      }
    }
  }
  return session.header?.agentPreset
}

async function resolveScopes(
  ctx: Context,
  sessionId?: string,
): Promise<unknown[]> {
  const sessionsService = ctx.get('sessions')
  const agentsService = ctx.get('agents')
  const presets = ctx.get('agentPresets')

  if (sessionId) {
    const session = sessionsService?.get?.(sessionId)
    const liveAgent = agentsService?.get?.(sessionId)
    if (liveAgent) {
      return [liveAgent]
    }
    if (presets && typeof presets.standingKeyFor === 'function') {
      try {
        let presetId = resolveSessionPreset(session)
        if (!presetId) {
          const persistence = ctx.get('sessionPersistence')
          if (persistence && typeof persistence.stat === 'function') {
            try {
              const stated = await persistence.stat(sessionId)
              presetId = stated?.header?.agentPreset
            } catch {}
          }
        }
        const standingKey = await presets.standingKeyFor(presetId)
        if (standingKey) return [standingKey]
      } catch {}
    }
    return [undefined]
  }

  // Global context (no sessionId specified, e.g. Settings modal)
  if (presets && typeof presets.standingKeyFor === 'function') {
    try {
      const defaultKey = await presets.standingKeyFor()
      if (defaultKey) return [defaultKey]
    } catch {}
  }

  return [undefined]
}

function resolveSkillRegistryService(
  ctx: Context,
  scope: unknown,
): SkillsService | undefined {
  const presets = ctx.get('agentPresets')
  if (
    scope &&
    typeof scope === 'object' &&
    'ctx' in scope &&
    presets &&
    typeof presets.serviceFor === 'function'
  ) {
    try {
      const service = presets.serviceFor<SkillsService>(
        scope as Agent,
        'skills',
      )
      if (service) return service
    } catch {}
  }
  return ctx.get('skills')
}

export async function getAvailableSkills(
  ctx: Context,
  sessionId?: string,
): Promise<SkillItem[]> {
  const map = new Map<string, SkillItem>()

  // 1. Try resolving session cwd if session exists. For global scope, keep cwd undefined so project scanning is skipped.
  const targetCwd = await resolveSessionCwd(ctx, sessionId)

  // 2. Query official Cordis Skill Registry across resolved scopes
  const scopes = await resolveScopes(ctx, sessionId)

  for (const scope of scopes) {
    const skillsService = resolveSkillRegistryService(ctx, scope)

    if (skillsService && typeof skillsService.list === 'function') {
      try {
        const list = await skillsService.list({
          cwd: targetCwd,
          scope,
        })
        if (Array.isArray(list)) {
          for (const s of list) {
            if (!map.has(s.name)) {
              const { isRuntime, source } = classifySkillSource(s)
              map.set(s.name, {
                name: s.name,
                description: s.description || '',
                whenToUse: s.whenToUse,
                provider: s.provider || 'skills-registry',
                source,
                modelInvocable: s.invocation?.modelInvocable ?? true,
                userInvocable: s.invocation?.userInvocable ?? true,
                isRuntime,
              })
            }
          }
        }
      } catch {}
    }
  }

  return Array.from(map.values()).sort(compareSkills)
}

export async function getSkillDetail(
  ctx: Context,
  name: string,
  sessionId?: string,
): Promise<SkillItem | null> {
  const targetCwd = await resolveSessionCwd(ctx, sessionId)

  // Query official Cordis Skill Registry across resolved scopes
  const scopes = await resolveScopes(ctx, sessionId)

  for (const scope of scopes) {
    const skillsService = resolveSkillRegistryService(ctx, scope)

    if (skillsService && typeof skillsService.get === 'function') {
      try {
        const s:
          | (SkillDefinition & {
              resourceBase?: { kind?: string; path?: string }
            })
          | undefined = await skillsService.get(name, {
          cwd: targetCwd,
          scope,
        })
        if (s) {
          const { isRuntime, source } = classifySkillSource(s)
          const resolvedPath =
            s.path ||
            (s.resourceBase?.kind === 'directory'
              ? s.resourceBase.path
              : undefined)
          return {
            name: s.name,
            description: s.description || '',
            whenToUse: s.whenToUse,
            provider: s.provider || 'skills-registry',
            source,
            path: resolvedPath,
            content: s.content,
            modelInvocable: s.invocation?.modelInvocable ?? true,
            userInvocable: s.invocation?.userInvocable ?? true,
            isRuntime,
          }
        }
      } catch {}
    }
  }

  return null
}
