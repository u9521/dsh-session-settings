import type { Context } from '@deepseek-ai/cordis'
import type {
  Agent,
  PreToolDecision,
  SessionSettingsStore,
  SkillsService,
  SkillSummary,
  SkillViewOptions,
  ToolExecution,
} from '../../types.ts'
import { resolveEffectiveSkills } from '../session/storage.ts'
import {
  resolveAgentSessionId,
  resolveWorkspaceForSession,
} from '../session/resolution.ts'

interface DecoratedSkillsService extends SkillsService {
  __sessionSettingsDecorated?: boolean
}

export function registerSkillsInterceptors(
  ctx: Context,
  getSessionSettingsStore: () => SessionSettingsStore,
): void {
  // 1. Decorate official SkillRegistry (ctx.skills) so snapshot() and get()
  // dynamically reflect the session's invocable policies.
  // This allows official dsh-tool-skill to compute consistent digests natively
  // without entering an infinite catalog-update loop.
  let cleanupDecorate: (() => void) | null = null
  const decorateSkillRegistry = () => {
    const skillsService = ctx.get('skills') as
      DecoratedSkillsService | undefined
    if (skillsService && !skillsService.__sessionSettingsDecorated) {
      skillsService.__sessionSettingsDecorated = true

      const origSnapshot = skillsService.snapshot.bind(skillsService)
      skillsService.snapshot = async function (options: SkillViewOptions = {}) {
        const snapshot = await origSnapshot(options)
        if (!snapshot || !Array.isArray(snapshot.skills)) return snapshot

        const sessionId = resolveAgentSessionId(
          options?.scope as Agent | undefined,
        )
        const workspaceId = await resolveWorkspaceForSession(ctx, sessionId)

        const sessionSettingsStore = getSessionSettingsStore()
        const effectiveSkills = resolveEffectiveSkills(
          sessionSettingsStore,
          sessionId,
          workspaceId,
        )
        const disabledModelSet = new Set(
          effectiveSkills.effectiveDisabledModelSkills || [],
        )
        const disabledUserSet = new Set(
          effectiveSkills.effectiveDisabledUserSkills || [],
        )

        if (disabledModelSet.size === 0 && disabledUserSet.size === 0) {
          return snapshot
        }

        return {
          ...snapshot,
          skills: snapshot.skills.map((skill: SkillSummary) => {
            const isModelDis = disabledModelSet.has(skill.name)
            const isUserDis = disabledUserSet.has(skill.name)
            if (!isModelDis && !isUserDis) return skill

            return {
              ...skill,
              invocation: {
                modelInvocable: isModelDis
                  ? false
                  : (skill.invocation?.modelInvocable ?? true),
                userInvocable: isUserDis
                  ? false
                  : (skill.invocation?.userInvocable ?? true),
              },
            }
          }),
        }
      }

      const origGet = skillsService.get.bind(skillsService)
      skillsService.get = async function (
        name: string,
        options: SkillViewOptions = {},
      ) {
        const definition = await origGet(name, options)
        if (!definition) return definition

        const sessionId = resolveAgentSessionId(
          options?.scope as Agent | undefined,
        )
        const workspaceId = await resolveWorkspaceForSession(ctx, sessionId)

        const sessionSettingsStore = getSessionSettingsStore()
        const effectiveSkills = resolveEffectiveSkills(
          sessionSettingsStore,
          sessionId,
          workspaceId,
        )
        const disabledModelSet = new Set(
          effectiveSkills.effectiveDisabledModelSkills || [],
        )
        const disabledUserSet = new Set(
          effectiveSkills.effectiveDisabledUserSkills || [],
        )

        if (
          disabledModelSet.has(definition.name) ||
          disabledUserSet.has(definition.name)
        ) {
          return {
            ...definition,
            invocation: {
              modelInvocable: disabledModelSet.has(definition.name)
                ? false
                : (definition.invocation?.modelInvocable ?? true),
              userInvocable: disabledUserSet.has(definition.name)
                ? false
                : (definition.invocation?.userInvocable ?? true),
            },
          }
        }

        return definition
      }

      cleanupDecorate = () => {
        if (skillsService.__sessionSettingsDecorated) {
          skillsService.snapshot = origSnapshot
          skillsService.get = origGet
          delete skillsService.__sessionSettingsDecorated
        }
      }
    }
  }

  ctx.effect(() => {
    decorateSkillRegistry()
    return () => {
      cleanupDecorate?.()
    }
  }, 'session-settings: skill-registry decoration')

  ctx.on('skills/change', () => {
    decorateSkillRegistry()
  })

  // 2. Pre-execution guard: deny any execution attempt of disabled skills
  ctx.on(
    'tools/pre-execute',
    async (exec: ToolExecution, next: () => Promise<PreToolDecision>) => {
      const toolName = exec?.name
      const args = (exec?.arguments ?? (exec as { args?: unknown }).args) as
        { name?: unknown } | undefined
      if (toolName === 'skill' && args && typeof args.name === 'string') {
        const targetSkillName = args.name.trim()
        const sessionId = resolveAgentSessionId(exec?.agent)
        const workspaceId = await resolveWorkspaceForSession(ctx, sessionId)

        const sessionSettingsStore = getSessionSettingsStore()
        const effectiveSkills = resolveEffectiveSkills(
          sessionSettingsStore,
          sessionId,
          workspaceId,
        )
        const disabledModelSkills =
          effectiveSkills.effectiveDisabledModelSkills || []

        if (disabledModelSkills.includes(targetSkillName)) {
          return {
            kind: 'deny',
            reason: `skill "${targetSkillName}" is disabled for model invocation in this session`,
          }
        }
      }
      return next()
    },
  )
}
