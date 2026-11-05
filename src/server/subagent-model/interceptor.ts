import type { Context } from '@deepseek-ai/cordis'
import type {
  Agent,
  ModelSelection,
  SessionSettingsStore,
  SubagentModelConfig,
  SubagentModelTarget,
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
 * would destroy the signal it depends on. It records a model selection instead.
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

/** Whether two routes name the same provider/model/effort. */
function sameSelection(
  a: ModelSelection | undefined,
  b: SubagentModelTarget | undefined,
): boolean {
  if (!a || !b) return false
  return (
    a.provider === b.provider &&
    a.model === b.model &&
    a.reasoningEffort === b.reasoningEffort
  )
}

/**
 * Record a forced route as the child's next model selection.
 *
 * `agent.model.select()` is the host's only supported way to change a model
 * route: it appends a durable `model/selection` event, and step preparation
 * reads it before fixing the selection the request must match. Writing
 * `agent.options` instead would corrupt the explicit-choice signal this module
 * depends on, and rewriting the request waterfall is now a hard error.
 *
 * The selection is recorded only when it differs from what the child would use
 * anyway, because `select()` appends an event and an unchanged route would add
 * noise to the session log.
 */
function applyRoute(agent: Agent, target: SubagentModelTarget): void {
  const current = agent.model?.current()
  const selection: ModelSelection = {
    provider: target.provider,
    model: target.model,
    ...(target.reasoningEffort === undefined
      ? {}
      : { reasoningEffort: target.reasoningEffort }),
  }
  if (sameSelection(current, target)) return
  agent.model?.select(selection)
}

/** The part of the `agent/pre-step` payload this module reads. */
interface PreStepPayload {
  agent: Agent
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

  /** Record the forced route when the child has one. */
  const applyForcedRoute = async (agent?: Agent): Promise<void> => {
    if (!agent) return
    const target = await forcedRouteFor(agent)
    if (target) applyRoute(agent, target)
  }

  // 1. Enforcement: hide the model-selection surface from the child while the
  //    session forbids it from choosing.
  //
  //    This used to be a prompt-assembly rewrite that stripped the selection
  //    parameters off `list_subagent_models`/`subagent`. That seam no longer
  //    exists: the host assembles sections and variables, then attaches tools
  //    from the registry AFTER the waterfall, so an assembly never carries a
  //    tool list to rewrite. The registry's own scope layer is the seam that
  //    survives, and it is per-agent, which is exactly the granularity wanted.
  ctx.on('agent/created', async ({ agent }) => {
    if (!agent) return
    await applyForcedRoute(agent)

    const config = await configFor(agent)
    if (config.allowAgentSelectModel !== false) return
    // The agent's own scope, not the plugin's: a restriction declared here
    // applies to this child alone and unwinds with its context.
    const tools = agent.ctx?.get?.('tools')
    if (typeof tools?.restrict !== 'function') return
    tools.restrict({ deny: ['list_subagent_models'] })
  })

  // 2. Keep the recorded route current when the setting changes mid-session.
  //
  //    The loop captures a step's selection BEFORE dispatching `agent/pre-step`,
  //    so nothing recorded here can change the step already being prepared; it
  //    applies from the following step. That is the best a listener can do, and
  //    the first step is already covered by `agent/created`. The listener is
  //    prepended so other pre-step observers read the forced route rather than
  //    the stale one.
  ctx.on(
    'agent/pre-step',
    async (
      { agent }: PreStepPayload,
      next: () => Promise<unknown>,
    ): Promise<unknown> => {
      await applyForcedRoute(agent)
      return next()
    },
    { prepend: true },
  )
}
