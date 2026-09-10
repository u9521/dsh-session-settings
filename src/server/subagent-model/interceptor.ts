import type { Context } from '@deepseek-ai/cordis'
import type {
  AgentRequestPayload,
  AssembleContext,
  LlmCallConfig,
  PromptAssembly,
  SessionSettingsStore,
  ToolExecution,
} from '../../types.ts'
import { resolveEffectiveSubagentModel } from '../session/storage.ts'
import {
  resolveAgentSessionId,
  resolveWorkspaceForSession,
} from '../session/resolution.ts'

/**
 * Set of child session IDs where the calling Agent explicitly provided provider/model
 * in the delegation tool call (subagent / subagent_fork).
 */
const explicitModelSubagents = new Set<string>()

/**
 * Checks whether the child agent was spawned by the "fork" provider.
 */
function isForkSubagent(session: any): boolean {
  if (!session) return false

  // 1. Official session header check (O(1), established immediately upon creation)
  // In DSH architecture, a subagent session with isSeeded: true is strictly a forked subagent.
  if (
    session.header?.origin === 'subagent' &&
    session.header?.isSeeded === true
  ) {
    return true
  }

  // 2. Official subagent descriptor check in session events (fallback for zero-history forks & cold restores)
  if (typeof session.snapshotEvents === 'function') {
    const events = session.snapshotEvents()
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i]
      if (ev?.type === 'subagent/descriptor') {
        return ev.data?.provider === 'fork'
      }
    }
  }

  return false
}

/**
 * Checks whether the Agent explicitly selected a custom provider/model
 * for this child subagent run.
 */
function hasAgentSelectedModel(session: any, ctx?: Context): boolean {
  if (!session?.header?.id) return false
  if (explicitModelSubagents.has(session.header.id)) return true

  // Fallback check in parent session events (for cold sessions or after server restarts)
  if (ctx && session.header?.parentSession) {
    try {
      const sessionsService = ctx.get('sessions') as any
      const parentSession = sessionsService?.get?.(session.header.parentSession)
      if (parentSession && typeof parentSession.snapshotEvents === 'function') {
        const events = parentSession.snapshotEvents()
        let matchedCallId: string | undefined
        for (let i = events.length - 1; i >= 0; i--) {
          const ev = events[i]
          if (ev?.type === 'tool/result') {
            const val = ev.data?.message?.content?.[0]?.value
            const subId = val?.subagentId
            if (subId === session.header.id) {
              matchedCallId = ev.data?.message?.source?.callId
              break
            }
          }
        }

        if (matchedCallId) {
          for (let i = events.length - 1; i >= 0; i--) {
            const ev = events[i]
            if (
              ev?.type === 'assistant/message' &&
              Array.isArray(ev.data?.message?.content)
            ) {
              for (const block of ev.data.message.content) {
                if (block?.type === 'tool-call' && block.id === matchedCallId) {
                  const args = block.args as any
                  if (args?.provider && args?.model) {
                    explicitModelSubagents.add(session.header.id)
                    return true
                  }
                }
              }
            }
          }
        }
      }
    } catch {
      // Ignore lookup errors
    }
  }

  return false
}

export function registerSubagentModelInterceptor(
  ctx: Context,
  getSessionSettingsStore: () => SessionSettingsStore,
): void {
  // 0. Observe tool results to track explicit model requests on delegation tools
  ctx.on('tools/result', (exec: any, result: any) => {
    if (exec?.name === 'subagent' || exec?.name?.startsWith('subagent_')) {
      const args = exec?.args as any
      const hasExplicitModel = Boolean(args?.provider && args?.model)
      const subagentId =
        result?.value?.subagentId ??
        result?.value?.childId ??
        (result?.content?.[0] as any)?.value?.subagentId
      if (subagentId && hasExplicitModel) {
        explicitModelSubagents.add(subagentId)
      }
    }
  })

  // 1. Guard against list_subagent_models execution when allowAgentSelectModel is disabled
  ctx.inject(['tools'], (toolsCtx: any) => {
    if (typeof toolsCtx?.tools?.guard === 'function') {
      toolsCtx.tools.guard((exec: ToolExecution) => {
        if (exec?.name === 'list_subagent_models') {
          const agent = exec.agent
          const session = agent?.session
          if (session) {
            const isSubagent = session.header?.origin === 'subagent'
            const sessionId = isSubagent
              ? (resolveAgentSessionId(agent, ctx) ??
                session.header?.parentSession)
              : session.header?.id
            const sessionSettingsStore = getSessionSettingsStore()
            const effectiveCfg = resolveEffectiveSubagentModel(
              sessionSettingsStore,
              sessionId,
            )
            if (effectiveCfg.allowAgentSelectModel === false) {
              return 'list_subagent_models is disabled by user settings for this session'
            }
          }
        }
        return undefined
      })
    }
  })

  // 2. Intercept system-prompt/assemble:
  //    - When allowAgentSelectModel is false: strip list_subagent_models from tools and strip model parameter from subagent tool
  //    - For subagent sessions: update prompt variables ({{model}} / {{provider}})
  ctx.on(
    'system-prompt/assemble',
    async (
      _assembly: PromptAssembly,
      context: AssembleContext,
      next: () => Promise<PromptAssembly>,
    ): Promise<PromptAssembly> => {
      const transformed = await next()
      const agent = context?.agent
      const session = agent?.session
      if (!session) {
        return transformed
      }

      const isSubagent = session.header?.origin === 'subagent'
      const sessionId = isSubagent
        ? (resolveAgentSessionId(agent, ctx) ?? session.header?.parentSession)
        : session.header?.id
      const workspaceId = await resolveWorkspaceForSession(ctx, sessionId)

      const sessionSettingsStore = getSessionSettingsStore()
      const effectiveCfg = resolveEffectiveSubagentModel(
        sessionSettingsStore,
        sessionId,
        workspaceId,
      )

      // A. If allowAgentSelectModel is false (forced mode):
      //    Strip list_subagent_models from visible tool schemas and strip model parameter from subagent tool
      if (
        effectiveCfg.allowAgentSelectModel === false &&
        Array.isArray(transformed.tools)
      ) {
        transformed.tools = transformed.tools
          .filter((t) => t.name !== 'list_subagent_models')
          .map((tool) => {
            if (tool.name === 'subagent' || tool.name.startsWith('subagent_')) {
              if (tool.parameters && typeof tool.parameters === 'object') {
                const rawProps = (tool.parameters as any).properties
                if (rawProps && typeof rawProps === 'object') {
                  const newProps = { ...rawProps }
                  delete newProps.model
                  delete newProps.provider
                  delete newProps.reasoning_effort

                  const rawReq = (tool.parameters as any).required
                  const newReq = Array.isArray(rawReq)
                    ? rawReq.filter(
                        (r: string) =>
                          r !== 'model' &&
                          r !== 'provider' &&
                          r !== 'reasoning_effort',
                      )
                    : rawReq

                  const updatedParams: Record<string, unknown> = {
                    ...tool.parameters,
                    properties: newProps,
                  }
                  if (newReq) {
                    updatedParams.required = newReq
                  }

                  let updatedDescription = tool.description
                  if (
                    typeof updatedDescription === 'string' &&
                    updatedDescription.includes(
                      'Child LLM selection is optional.',
                    )
                  ) {
                    updatedDescription = updatedDescription
                      .replace(
                        /Child LLM selection is optional\..*?default effort\./g,
                        '',
                      )
                      .trim()
                  }

                  return {
                    ...tool,
                    parameters: updatedParams,
                    ...(updatedDescription !== undefined
                      ? { description: updatedDescription }
                      : {}),
                  }
                }
              }
            }
            return tool
          })
      }

      // B. If this is a subagent assembling its own prompt, sync {{model}} and {{provider}} variables
      if (isSubagent) {
        const isFork = isForkSubagent(session)
        if (isFork && effectiveCfg.overrideForkModel !== true) {
          return transformed
        }

        const hasCustomModel =
          !effectiveCfg.inherit &&
          Boolean(effectiveCfg.model?.provider && effectiveCfg.model?.model)

        const shouldApply =
          effectiveCfg.allowAgentSelectModel === false
            ? hasCustomModel
            : hasCustomModel && !hasAgentSelectedModel(session, ctx)

        if (shouldApply && effectiveCfg.model) {
          if (agent?.options) {
            agent.options.provider = effectiveCfg.model.provider
            agent.options.model = effectiveCfg.model.model
          }
          return {
            ...transformed,
            variables: {
              ...transformed.variables,
              provider: effectiveCfg.model.provider,
              model: effectiveCfg.model.model,
            },
          }
        }
      }

      return transformed
    },
  )

  // 3. Intercept agent/request to route the actual LLM call to the effective subagent model
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

      // Subagent fork check: preserve KV cache unless overrideForkModel is explicitly enabled
      const isFork = isForkSubagent(session)
      if (isFork && effectiveCfg.overrideForkModel !== true) {
        return proposal
      }

      const hasCustomModel =
        !effectiveCfg.inherit &&
        Boolean(effectiveCfg.model?.provider && effectiveCfg.model?.model)

      // When allowAgentSelectModel is false: forced mode
      if (effectiveCfg.allowAgentSelectModel === false) {
        if (!hasCustomModel || !effectiveCfg.model) {
          return proposal
        }
        if (payload.agent?.options) {
          payload.agent.options.provider = effectiveCfg.model.provider
          payload.agent.options.model = effectiveCfg.model.model
          if (effectiveCfg.model.reasoningEffort) {
            ;(payload.agent.options as any).reasoningEffort =
              effectiveCfg.model.reasoningEffort
          }
        }
        return {
          ...proposal,
          provider: effectiveCfg.model.provider,
          model: effectiveCfg.model.model,
          ...(effectiveCfg.model.reasoningEffort
            ? { reasoningEffort: effectiveCfg.model.reasoningEffort }
            : {}),
        }
      }

      // When allowAgentSelectModel is true (default):
      // If the Agent explicitly chose a model, do NOT overwrite it!
      if (hasAgentSelectedModel(session, ctx)) {
        return proposal
      }

      // If Agent did not specify a model and custom model is configured, use it as fallback
      if (hasCustomModel && effectiveCfg.model) {
        if (payload.agent?.options) {
          payload.agent.options.provider = effectiveCfg.model.provider
          payload.agent.options.model = effectiveCfg.model.model
          if (effectiveCfg.model.reasoningEffort) {
            ;(payload.agent.options as any).reasoningEffort =
              effectiveCfg.model.reasoningEffort
          }
        }
        return {
          ...proposal,
          provider: effectiveCfg.model.provider,
          model: effectiveCfg.model.model,
          ...(effectiveCfg.model.reasoningEffort
            ? { reasoningEffort: effectiveCfg.model.reasoningEffort }
            : {}),
        }
      }

      return proposal
    },
  )
}
