import type { Context } from '@deepseek-ai/cordis'
import type { SessionSettingsStore } from '../../types.ts'
import { resolveEffectiveSkills } from '../session/storage.ts'
import { resolveWorkspaceForSession } from '../session/routes.ts'

export function registerSkillsInterceptors(
  ctx: Context,
  getSessionSettingsStore: () => SessionSettingsStore,
): void {
  // 1. Decorate official SkillRegistry (ctx.skills) so snapshot() and get()
  // dynamically reflect the session's invocable policies.
  // This allows official dsh-tool-skill to compute consistent digests natively
  // without entering an infinite catalog-update loop.
  const decorateSkillRegistry = () => {
    const skillsService = ctx.get('skills' as any) as any
    if (skillsService && !skillsService.__sessionSettingsDecorated) {
      skillsService.__sessionSettingsDecorated = true

      const origSnapshot = skillsService.snapshot.bind(skillsService)
      skillsService.snapshot = async function (options: any = {}) {
        const snapshot = await origSnapshot(options)
        if (!snapshot || !Array.isArray(snapshot.skills)) return snapshot

        const sessionId =
          options?.scope?.session?.id ||
          options?.scope?.session?.header?.parentSession ||
          options?.scope?.id
        const workspaceId =
          options?.scope?.session?.header?.workspaceId ||
          resolveWorkspaceForSession(ctx, sessionId)

        const sessionSettingsStore = getSessionSettingsStore()
        const effectiveSkills = resolveEffectiveSkills(
          sessionSettingsStore,
          sessionId,
          workspaceId,
        )
        const disabledModelSet = new Set(
          effectiveSkills.effectiveDisabledModelSkills ||
            effectiveSkills.effectiveDisabledSkills ||
            [],
        )
        const disabledUserSet = new Set(
          effectiveSkills.effectiveDisabledUserSkills || [],
        )

        if (disabledModelSet.size === 0 && disabledUserSet.size === 0) {
          return snapshot
        }

        return {
          ...snapshot,
          skills: snapshot.skills.map((skill: any) => {
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
      skillsService.get = async function (name: string, options: any = {}) {
        const definition = await origGet(name, options)
        if (!definition) return definition

        const sessionId =
          options?.scope?.session?.id ||
          options?.scope?.session?.header?.parentSession ||
          options?.scope?.id
        const workspaceId =
          options?.scope?.session?.header?.workspaceId ||
          resolveWorkspaceForSession(ctx, sessionId)

        const sessionSettingsStore = getSessionSettingsStore()
        const effectiveSkills = resolveEffectiveSkills(
          sessionSettingsStore,
          sessionId,
          workspaceId,
        )
        const disabledModelSet = new Set(
          effectiveSkills.effectiveDisabledModelSkills ||
            effectiveSkills.effectiveDisabledSkills ||
            [],
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
    }
  }

  decorateSkillRegistry()
  ctx.on('skills/change' as any, () => {
    decorateSkillRegistry()
  })

  // 2. Pre-execution guard: deny any execution attempt of disabled skills
  ;(ctx as any).on('tools/pre-execute', async (exec: any, next: any) => {
    const toolName = exec?.name
    if (
      toolName === 'skill' &&
      exec?.args &&
      typeof exec.args.name === 'string'
    ) {
      const targetSkillName = exec.args.name.trim()
      const sessionId =
        exec?.agent?.session?.id ||
        exec?.agent?.session?.header?.parentSession ||
        exec?.agent?.id
      const workspaceId =
        exec?.agent?.session?.header?.workspaceId ||
        resolveWorkspaceForSession(ctx, sessionId)

      const sessionSettingsStore = getSessionSettingsStore()
      const effectiveSkills = resolveEffectiveSkills(
        sessionSettingsStore,
        sessionId,
        workspaceId,
      )
      const disabledModelSkills =
        effectiveSkills.effectiveDisabledModelSkills ||
        effectiveSkills.effectiveDisabledSkills ||
        []

      if (disabledModelSkills.includes(targetSkillName)) {
        return {
          kind: 'deny',
          reason: `skill "${targetSkillName}" is disabled for model invocation in this session`,
        }
      }
    }
    return next()
  })
}
