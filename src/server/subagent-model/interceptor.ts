import type { Context } from '@deepseek-ai/cordis'
import type {
  Agent,
  AssembleContext,
  LlmCallConfig,
  PromptAssembly,
  SessionSettingsStore,
  SubagentModelConfig,
  SubagentModelTarget,
  ToolExecution,
} from '../../types.ts'
import { resolveEffectiveSubagentModel } from '../session/storage.ts'
import {
  resolveAgentSessionId,
  resolveWorkspaceForSession,
} from '../session/resolution.ts'

/**
 * The route this child's direct parent is running, i.e. the route the child
 * would have inherited had the delegation named nothing.
 *
 * This mirrors the host's own baseline, `parentAgentOptionsForDelegation`:
 * prefer the parent Session's last request header and fall back to the live
 * Agent's options. The DIRECT parent is the right reference — a delegation
 * inherits from the agent that called it, not from the root Session whose
 * settings `resolveAgentSessionId` resolves.
 */
function parentRoute(
  ctx: Context,
  agent?: Agent,
): SubagentModelTarget | undefined {
  const parentId = agent?.session?.header?.parentSession
  if (!parentId) return undefined

  const parent = ctx.get('agents')?.get(parentId)
  if (!parent) return undefined

  const logged = parent.session?.requestHeader?.()?.config
  if (logged?.provider && logged?.model) {
    return {
      provider: logged.provider,
      model: logged.model,
      ...(logged.reasoningEffort
        ? { reasoningEffort: logged.reasoningEffort }
        : {}),
    }
  }

  const options = parent.options
  if (!options?.provider || !options?.model) return undefined
  return {
    provider: options.provider,
    model: options.model,
    ...(options.reasoningEffort
      ? { reasoningEffort: options.reasoningEffort }
      : {}),
  }
}

/**
 * Whether this child Agent actually chose its own LLM route.
 *
 * Having a route proves nothing: the host's `resolveChildAgentOptions` merges
 * the parent's provider/model into EVERY child's `options`, so a plainly
 * inherited child looks identical to one that named a route. An explicit
 * choice is therefore exactly a route the child would NOT have inherited.
 *
 * When the parent cannot be resolved the route is treated as the child's own,
 * which leaves it alone — the conservative direction, since overriding a
 * deliberate choice is worse than missing one.
 *
 * This is also why the interceptor must never write `agent.options`: doing so
 * would destroy the signal it depends on.
 */
function hasExplicitChildModel(ctx: Context, agent?: Agent): boolean {
  const options = agent?.options
  if (!options?.provider || !options?.model) return false

  const inherited = parentRoute(ctx, agent)
  if (!inherited) return true

  return (
    options.provider !== inherited.provider || options.model !== inherited.model
  )
}

/**
 * Whether this Session was produced by the fork provider. A forked child
 * inherits a copy of its parent's event log, which the immutable Session header
 * records as `isSeeded`.
 */
function isForkSubagent(agent?: Agent): boolean {
  const header = agent?.session?.header
  return header?.origin === 'subagent' && header.isSeeded === true
}

/** Remove the child-model-selection surface from one assembly. */
function withoutModelSelection(
  assembly: PromptAssembly,
  config: SubagentModelConfig,
): PromptAssembly {
  if (
    config.allowAgentSelectModel !== false ||
    !Array.isArray(assembly.tools)
  ) {
    return assembly
  }

  const stripped = new Set(['model', 'provider', 'reasoning_effort'])

  const tools = assembly.tools
    .filter((tool) => tool.name !== 'list_subagent_models')
    .map((tool) => {
      const isDelegation =
        tool.name === 'subagent' || tool.name.startsWith('subagent_')
      if (
        !isDelegation ||
        !tool.parameters ||
        typeof tool.parameters !== 'object'
      ) {
        return tool
      }

      const parameters = tool.parameters as {
        properties?: Record<string, unknown>
        required?: unknown
      }
      const properties = parameters.properties
      if (!properties || typeof properties !== 'object') return tool

      const required = Array.isArray(parameters.required)
        ? parameters.required.filter(
            (name: unknown) => typeof name === 'string' && !stripped.has(name),
          )
        : parameters.required

      return {
        ...tool,
        parameters: {
          ...parameters,
          properties: Object.fromEntries(
            Object.entries(properties).filter(([name]) => !stripped.has(name)),
          ),
          ...(required === undefined ? {} : { required }),
        },
        description:
          typeof tool.description === 'string'
            ? tool.description
                .replace(
                  /Child LLM selection is optional\..*?default effort\./g,
                  '',
                )
                .trim()
            : tool.description,
      }
    })

  return { ...assembly, tools }
}

export function registerSubagentModelInterceptor(
  ctx: Context,
  getSessionSettingsStore: () => SessionSettingsStore,
): void {
  /** Effective subagent-model settings for the session an Agent belongs to. */
  const configFor = async (agent?: Agent): Promise<SubagentModelConfig> =>
    resolveEffectiveSubagentModel(
      getSessionSettingsStore(),
      resolveAgentSessionId(agent, ctx),
      await resolveWorkspaceForSession(ctx, resolveAgentSessionId(agent, ctx)),
    )

  /**
   * The route this interceptor must force onto a child, or `undefined` to leave
   * the child's own configuration alone.
   *
   * A forked child preserves its inherited prefix (and the parent's KV cache)
   * unless the user opted in through `overrideForkModel`. In forced mode the
   * child's own choice is overridden; otherwise an explicit child route wins.
   */
  const forcedRouteFor = async (
    agent?: Agent,
  ): Promise<SubagentModelTarget | undefined> => {
    if (agent?.session?.header?.origin !== 'subagent') return undefined

    const config = await configFor(agent)
    if (isForkSubagent(agent) && config.overrideForkModel !== true) {
      return undefined
    }

    const target = config.inherit ? undefined : config.model
    if (!target) return undefined
    if (
      config.allowAgentSelectModel !== false &&
      hasExplicitChildModel(ctx, agent)
    ) {
      return undefined
    }
    return target
  }

  // 1. Monotonic guard: refuse list_subagent_models while the agent is barred
  //    from choosing a child model.
  ctx.inject(['tools'], (toolsCtx: Context) => {
    const guard = (
      toolsCtx as {
        tools?: {
          guard?: (
            check: (exec: ToolExecution) => string | undefined,
          ) => unknown
        }
      }
    ).tools?.guard
    if (typeof guard !== 'function') return
    guard((exec) => {
      if (exec?.name !== 'list_subagent_models') return undefined
      return resolveEffectiveSubagentModel(
        getSessionSettingsStore(),
        resolveAgentSessionId(exec.agent, ctx),
      ).allowAgentSelectModel === false
        ? 'list_subagent_models is disabled by user settings for this session'
        : undefined
    })
  })

  // 2. Prompt assembly: hide the selection surface in forced mode, and keep the
  //    child's {{provider}}/{{model}} variables in step with the routed call.
  ctx.on(
    'system-prompt/assemble',
    async (
      _assembly: PromptAssembly,
      context: AssembleContext,
      next: () => Promise<PromptAssembly>,
    ): Promise<PromptAssembly> => {
      const agent = context?.agent
      const assembled = await next()
      if (!agent) return assembled

      const themed = withoutModelSelection(assembled, await configFor(agent))
      const target = await forcedRouteFor(agent)
      if (!target) return themed

      return {
        ...themed,
        variables: {
          ...themed.variables,
          provider: target.provider,
          model: target.model,
        },
      }
    },
  )

  // 3. Route the child's actual LLM call.
  ctx.on(
    'agent/request',
    async (
      payload: { agent: Agent },
      next: () => Promise<LlmCallConfig>,
    ): Promise<LlmCallConfig> => {
      const proposal = await next()
      const target = await forcedRouteFor(payload?.agent)
      if (!target) return proposal

      return {
        ...proposal,
        provider: target.provider,
        model: target.model,
        ...(target.reasoningEffort
          ? { reasoningEffort: target.reasoningEffort }
          : {}),
      }
    },
  )
}
