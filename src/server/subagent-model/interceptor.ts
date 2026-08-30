import type { Context } from '@deepseek-ai/cordis'
import type {
  AgentRequestPayload,
  AssembleContext,
  LlmCallConfig,
  PromptAssembly,
  SessionSettingsStore,
} from '../../types.ts'
import { resolveEffectiveSubagentModel } from '../session/storage.ts'
import {
  resolveAgentSessionId,
  resolveWorkspaceForSession,
} from '../session/resolution.ts'

export function registerSubagentModelInterceptor(
  ctx: Context,
  getSessionSettingsStore: () => SessionSettingsStore,
): void {
  // 1. Intercept system-prompt/assemble to update variables (e.g. {{model}} and {{provider}})
  // for subagents configured with a dedicated model target.
  ctx.on(
    'system-prompt/assemble',
    async (
      _assembly: PromptAssembly,
      context: AssembleContext,
      next: () => Promise<PromptAssembly>,
    ): Promise<PromptAssembly> => {
      const transformed = await next()
      const session = context?.agent?.session
      if (!session?.header || session.header.origin !== 'subagent') {
        return transformed
      }

      const parentId =
        resolveAgentSessionId(context?.agent, ctx) ??
        session.header.parentSession
      const workspaceId = await resolveWorkspaceForSession(ctx, parentId)

      const sessionSettingsStore = getSessionSettingsStore()
      const effectiveCfg = resolveEffectiveSubagentModel(
        sessionSettingsStore,
        parentId,
        workspaceId,
      )

      if (
        effectiveCfg.inherit ||
        !effectiveCfg.model?.provider ||
        !effectiveCfg.model?.model
      ) {
        return transformed
      }

      // Update agent.options so subsequent reads reflect the configured subagent model
      if (context.agent?.options) {
        context.agent.options.provider = effectiveCfg.model.provider
        context.agent.options.model = effectiveCfg.model.model
      }

      return {
        ...transformed,
        variables: {
          ...transformed.variables,
          provider: effectiveCfg.model.provider,
          model: effectiveCfg.model.model,
        },
      }
    },
  )

  // 2. Intercept agent/request to route the actual LLM call to the effective subagent model
  ctx.on(
    'agent/request',
    async (
      payload: AgentRequestPayload,
      next: () => Promise<LlmCallConfig>,
    ): Promise<LlmCallConfig> => {
      const proposal = await next()
      const session = payload?.agent?.session
      if (!session?.header || session.header.origin !== 'subagent') {
        return proposal
      }

      const parentId =
        resolveAgentSessionId(payload?.agent, ctx) ??
        session.header.parentSession
      const workspaceId = await resolveWorkspaceForSession(ctx, parentId)

      const sessionSettingsStore = getSessionSettingsStore()
      const effectiveCfg = resolveEffectiveSubagentModel(
        sessionSettingsStore,
        parentId,
        workspaceId,
      )

      if (
        effectiveCfg.inherit ||
        !effectiveCfg.model?.provider ||
        !effectiveCfg.model?.model
      ) {
        return proposal
      }

      if (payload.agent?.options) {
        payload.agent.options.provider = effectiveCfg.model.provider
        payload.agent.options.model = effectiveCfg.model.model
      }

      return {
        ...proposal,
        provider: effectiveCfg.model.provider,
        model: effectiveCfg.model.model,
        ...(effectiveCfg.model.reasoningEffort
          ? { reasoningEffort: effectiveCfg.model.reasoningEffort }
          : {}),
      }
    },
  )
}
