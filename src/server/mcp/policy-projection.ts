import type { Context } from '@deepseek-ai/cordis'
import type {
  Agent,
  McpServerStore,
  SessionSettingsStore,
  SystemPromptService,
  ToolGuardFn,
  ToolsService,
} from '../../types.ts'
import type { McpManager } from './manager.ts'
import { resolveEffectiveMcp } from '../session/storage.ts'
import {
  resolveAgentSessionId,
  resolveWorkspaceForSession,
} from '../session/resolution.ts'

/**
 * The three shared resource tools registered by `@deepseek-ai/dsh-mcp-resources`.
 * They carry no `mcp__` prefix and are absent from the manager's tool metadata,
 * so they must be recognised by name.
 */
const RESOURCE_TOOLS = new Set([
  'list_mcp_resources',
  'list_mcp_resource_templates',
  'read_mcp_resource',
])

/** Prompt section owned by `@deepseek-ai/dsh-mcp-resources` listing addressable servers. */
const RESOURCE_SERVERS_SECTION = 'mcp-resource-servers'

/**
 * How many times a session's workspace may be re-resolved before we accept that
 * it has none. A session created before the workspace registry indexed it would
 * otherwise stay pinned to the global layer for its whole life.
 */
const MAX_WORKSPACE_RESOLVE_RETRIES = 5

/** Prompt section carrying one server's attributed instructions, owned by the official client. */
function instructionsSectionName(serverId: string): string {
  return `mcp:${serverId}`
}

/** Effective MCP policy for one session, resolved to a synchronously readable shape. */
interface McpPolicy {
  enabledServerIds: Set<string>
  /** serverId -> raw (wire) tool names disabled for this session. */
  disabledRawTools: Map<string, Set<string>>
}

/**
 * One agent's installed scope declarations, retained to make re-application
 * idempotent.
 *
 * Re-applying unconditionally would be a live-lock: `restrict()` mutates a scope
 * layer, which emits `tools/change`, which is the very signal a re-application
 * listens to.
 */
interface AgentProjection {
  /** Serialized deny set currently installed; `undefined` when no restriction is installed. */
  denyKey: string | undefined
  disposeRestrict: (() => void) | undefined
  /** Section name -> the exact text installed for it. */
  sections: Map<string, { text: string; dispose: () => void }>
}

/**
 * Enforce the per-session MCP policy through scope-layer declarations instead of
 * event interception.
 *
 * The official client is mounted once on the shared (root) layer, so its tools,
 * resource providers, and prompt sections are inherited by every agent. Each
 * agent then narrows that inherited surface on its own scope:
 *
 *  - `tools.restrict({deny})` removes disallowed tools from the agent's view.
 *    `view()` feeds both presentation (`schemas()`) and dispatch
 *    (`resolveExecution()`), so this single declaration covers both faces.
 *    It only filters the INHERITED surface, which is why the mount must stay on
 *    the shared layer.
 *  - `systemPrompt.section()` shadows the official instruction and resource-list
 *    sections by name; an empty text contributes nothing.
 *  - A root `tools.guard()` resolves the policy from the caller and is the
 *    monotonic backstop. It covers the window before `restrict()` lands and the
 *    resource tools' `server` argument, which a name-based filter cannot express.
 */
export class McpPolicyProjection {
  private readonly ctx: Context
  private readonly getMcpStore: () => McpServerStore
  private readonly getSessionSettingsStore: () => SessionSettingsStore
  private readonly manager: McpManager

  /** sessionId -> resolved policy. Keyed by the ROOT session so children share it. */
  private readonly policies = new Map<string, McpPolicy>()
  /**
   * sessionId -> the workspace its policy was resolved against.
   *
   * Kept OUTSIDE `policies` so dropping the cache recomputes with the SAME
   * workspace. `resolveWorkspaceForSession` is async while the execution guard
   * must read a policy synchronously, so the answer is remembered rather than
   * re-derived — re-deriving silently passed `undefined`, i.e. the global layer.
   */
  private readonly policyWorkspace = new Map<string, string | undefined>()
  /** sessionId -> bounded re-resolution attempts for a not-yet-indexed workspace. */
  private readonly workspaceRetries = new Map<string, number>()
  private readonly projections = new Map<Agent, AgentProjection>()
  /** Guards against re-entrancy while a repaint may itself emit `tools/change`. */
  private repainting = false

  constructor(
    ctx: Context,
    getMcpStore: () => McpServerStore,
    getSessionSettingsStore: () => SessionSettingsStore,
    manager: McpManager,
  ) {
    this.ctx = ctx
    this.getMcpStore = getMcpStore
    this.getSessionSettingsStore = getSessionSettingsStore
    this.manager = manager
  }

  /** Install the monotonic execution guard and start observing tool-set changes. */
  public start(): void {
    const rootTools = this.toolsService()
    rootTools?.guard(((exec) => {
      try {
        return this.executionDenial(exec)
      } catch (err: unknown) {
        // Fail CLOSED: a policy that cannot be evaluated must not become an
        // allow. The scope restriction remains the presentation-side gate, but
        // execution is denied on the safe side.
        console.warn(
          '[session-settings] [MCP-POLICY] Policy evaluation failed; denying the call:',
          err instanceof Error ? err.message : String(err),
        )
        return `unknown tool "${typeof exec?.name === 'string' ? exec.name : 'unknown'}"`
      }
    }) as ToolGuardFn)

    this.ctx.on('tools/change', () => {
      this.repaint()
    })
  }

  /**
   * Apply the policy for one newly created agent.
   *
   * Awaited by the `agent/created` listener so the restriction and section
   * shadows exist before the agent's first prompt assembly. Mounting is
   * deliberately NOT awaited: a slow or unreachable stdio server must not delay
   * agent creation, and the `tools/change` repaint installs the restriction over
   * its tools as soon as they register.
   */
  public async applyToAgent(agent: Agent): Promise<void> {
    const sessionId = this.sessionIdOf(agent)
    const workspaceId = await resolveWorkspaceForSession(this.ctx, sessionId)

    if (sessionId) {
      // Remember the workspace BEFORE the policy so a later recompute (which
      // cannot await) resolves against the same layer.
      this.policyWorkspace.set(sessionId, workspaceId)
      this.workspaceRetries.delete(sessionId)
      this.policies.set(sessionId, this.computePolicy(sessionId, workspaceId))
    }

    const policy = this.policyFor(sessionId)
    const tools = agent.ctx.get('tools') as ToolsService | undefined
    if (!tools) return

    this.installRestriction(agent, tools, policy, this.registeredToolNames())
    this.syncSections(agent, policy)
    this.mountInBackground(policy)
  }

  /** Drop bookkeeping for a disposed agent; its scope declarations unwind with its context. */
  public forget(agent: Agent): void {
    this.projections.delete(agent)

    // Children share the root session's policy, so only evict it once no other
    // live agent still resolves to it.
    const sessionId = this.sessionIdOf(agent)
    if (!sessionId) return
    for (const other of this.projections.keys()) {
      if (this.sessionIdOf(other) === sessionId) return
    }
    this.policies.delete(sessionId)
    this.policyWorkspace.delete(sessionId)
    this.workspaceRetries.delete(sessionId)
  }

  /**
   * Make sure the servers this agent's session enables are mounted.
   *
   * Called from the prompt-assembly path so the first turn of a cold server
   * already sees its tools. This is a MOUNT TRIGGER only — the tool set is
   * narrowed by the scope declarations, never by this call, and it returns the
   * assembly untouched.
   */
  public async ensureMountedFor(agent?: Agent): Promise<void> {
    const sessionId = this.sessionIdOf(agent)
    await this.retryWorkspaceResolution(sessionId)
    const policy = this.policyFor(sessionId)
    const ids = Array.from(policy.enabledServerIds)
    if (ids.length === 0) return
    try {
      await this.manager.ensureServersMounted(ids)
    } catch {
      // Mount failures are reported through the manager's own status bookkeeping.
    }
  }

  /**
   * Re-resolve a workspace that was not indexed when the agent was created.
   *
   * `agent/created` can run before `workspaceRegistry` knows the session, and a
   * policy computed then is pinned to the global layer forever. Bounded so a
   * session that genuinely has no workspace stops costing an async lookup.
   */
  private async retryWorkspaceResolution(sessionId?: string): Promise<void> {
    if (!sessionId) return
    if (this.policyWorkspace.get(sessionId) !== undefined) return

    const attempts = this.workspaceRetries.get(sessionId) ?? 0
    if (attempts >= MAX_WORKSPACE_RESOLVE_RETRIES) return
    this.workspaceRetries.set(sessionId, attempts + 1)

    const workspaceId = await resolveWorkspaceForSession(this.ctx, sessionId)
    if (!workspaceId) return

    this.policyWorkspace.set(sessionId, workspaceId)
    // Recompute every live agent's declarations against the corrected layer.
    this.notifyPolicyChanged()
  }

  /**
   * Invalidate cached policies and re-apply every live agent.
   *
   * Called after settings or server edits so a change takes effect on the next
   * turn without a restart.
   */
  public notifyPolicyChanged(): void {
    this.policies.clear()
    this.repaint(true)
  }

  /** Re-resolve the policy for live agents and re-install their declarations. */
  private repaint(force = false): void {
    if (this.repainting) return
    this.repainting = true
    try {
      // The registry view is scope-independent (it walks the root `ctx.tools`),
      // so walk it once for the whole repaint rather than once per agent.
      const registeredNames = this.registeredToolNames()
      for (const agent of Array.from(this.projections.keys())) {
        const sessionId = this.sessionIdOf(agent)
        const tools = agent.ctx.get('tools') as ToolsService | undefined
        if (!tools) continue
        if (force && sessionId) {
          this.policies.delete(sessionId)
        }
        const policy = this.policyFor(sessionId)
        this.installRestriction(agent, tools, policy, registeredNames)
        this.syncSections(agent, policy)
        this.mountInBackground(policy)
      }
    } finally {
      this.repainting = false
    }
  }

  /** Install or refresh the agent's tool restriction, skipping a no-op repaint. */
  private installRestriction(
    agent: Agent,
    tools: ToolsService,
    policy: McpPolicy,
    registeredNames: string[],
  ): void {
    const projection = this.projectionFor(agent)
    const deny = this.denySetFor(policy, registeredNames).sort()
    const denyKey = deny.length > 0 ? deny.join('\u0000') : undefined

    if (denyKey === projection.denyKey) return

    projection.disposeRestrict?.()
    projection.disposeRestrict = undefined
    projection.denyKey = denyKey

    if (deny.length === 0) return
    try {
      projection.disposeRestrict = tools.restrict({ deny })
    } catch (err: unknown) {
      // `restrict()` rejects unknown names. Treat a failure as "no restriction"
      // rather than breaking the agent; the root guard still gates execution.
      projection.denyKey = undefined
      console.warn(
        '[session-settings] [MCP-POLICY] restrict() rejected the deny set; falling back to the execution guard only:',
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  /**
   * Shadow the official MCP prompt sections for this agent.
   *
   * Both official sections are registered on the shared layer, where every agent
   * inherits them. Re-registering the same name on the agent's own scope wins the
   * name for that scope alone, and an empty text contributes nothing.
   */
  private syncSections(agent: Agent, policy: McpPolicy): void {
    const systemPrompt = agent.ctx.get('systemPrompt') as
      SystemPromptService | undefined
    if (!systemPrompt) return

    const projection = this.projectionFor(agent)
    const desired = new Map<string, string>()

    // Hide instructions for servers this session did not enable. Enabled servers
    // are left alone so the official section shows through.
    for (const serverId of Object.keys(this.getMcpStore().servers)) {
      if (!policy.enabledServerIds.has(serverId)) {
        desired.set(instructionsSectionName(serverId), '')
      }
    }

    // The official section lists every mounted server; re-render a filtered list.
    desired.set(RESOURCE_SERVERS_SECTION, this.resourceServersText(policy))

    for (const [name, text] of desired) {
      const installed = projection.sections.get(name)
      if (installed?.text === text) continue
      installed?.dispose()
      projection.sections.delete(name)
      try {
        const order = systemPrompt.getSectionOrder('MCP_SERVERS')
        const dispose = systemPrompt.section({ name, order, text })
        projection.sections.set(name, { text, dispose })
      } catch (err: unknown) {
        console.warn(
          `[session-settings] [MCP-POLICY] Failed to shadow prompt section "${name}":`,
          err instanceof Error ? err.message : String(err),
        )
      }
    }

    // Drop shadows for names we no longer want to override (e.g. a server that
    // was just enabled must fall back to the official instructions).
    for (const [name, installed] of Array.from(projection.sections)) {
      if (desired.has(name)) continue
      installed.dispose()
      projection.sections.delete(name)
    }
  }

  /** Mirror the official resource-server section, restricted to this session's servers. */
  private resourceServersText(policy: McpPolicy): string {
    const names = Object.keys(this.getMcpStore().servers)
      .filter((serverId) => policy.enabledServerIds.has(serverId))
      .sort()
    if (names.length === 0) return ''
    return `## MCP resource servers\n\nUse list_mcp_resources, list_mcp_resource_templates, or read_mcp_resource with one of these names as the server argument: ${JSON.stringify(names)}.`
  }

  /** Every registered name the agent would otherwise inherit, from the global view. */
  private registeredToolNames(): string[] {
    const tools = this.toolsService()
    if (!tools) return []
    try {
      const schemas = tools.schemas()
      if (!Array.isArray(schemas)) return []
      return schemas
        .map((schema) => schema?.name)
        .filter((name): name is string => typeof name === 'string')
    } catch {
      return []
    }
  }

  /**
   * Enabled ids that actually name a configured server.
   *
   * A dangling id (its server was deleted while the config kept referencing it)
   * must not count as "something is enabled": the resource tools address a
   * server by name and there is nothing behind that name to reach.
   */
  private resolvableEnabled(policy: McpPolicy): Set<string> {
    const servers = this.getMcpStore().servers
    const resolvable = new Set<string>()
    for (const serverId of policy.enabledServerIds) {
      if (serverId in servers) resolvable.add(serverId)
    }
    return resolvable
  }

  /**
   * Names to deny.
   *
   * Intersected with the registry's own view so `restrict()` never sees an
   * unknown name: a server that failed to mount contributes no tools, and
   * denying a name that was never registered would throw.
   */
  private denySetFor(policy: McpPolicy, registeredNames: string[]): string[] {
    const deny: string[] = []
    for (const name of registeredNames) {
      if (RESOURCE_TOOLS.has(name)) {
        // Resource tools address a server by argument, so they cannot be filtered
        // per server here. Hide them entirely when no reachable server is enabled.
        if (this.resolvableEnabled(policy).size === 0) deny.push(name)
        continue
      }
      if (!this.manager.isMcpTool(name)) continue
      if (this.denyMcpToolName(name, policy) !== undefined) deny.push(name)
    }
    return deny
  }

  /** Resolve the denial for one execution, reading the caller's policy. */
  private executionDenial(exec: {
    name?: unknown
    arguments?: unknown
    agent?: Agent
  }): string | undefined {
    const name = exec?.name
    if (typeof name !== 'string') return undefined
    const isResourceTool = RESOURCE_TOOLS.has(name)
    if (!isResourceTool && !this.manager.isMcpTool(name)) return undefined

    const policy = this.policyFor(this.sessionIdOf(exec.agent))
    if (isResourceTool) {
      // `server` is a required parameter on all three resource tools, so a
      // missing or malformed value is not a legitimate call: fail closed rather
      // than letting an unparsable argument bypass the policy.
      const server = readServerArgument(exec.arguments)
      if (server === undefined) return `unknown tool "${name}"`
      return this.resolvableEnabled(policy).has(server)
        ? undefined
        : `unknown tool "${name}"`
    }
    return this.denyMcpToolName(name, policy)
  }

  /** Denial reason for one already-registered MCP tool name, or undefined when allowed. */
  private denyMcpToolName(name: string, policy: McpPolicy): string | undefined {
    const meta = this.manager.getToolMeta(name)
    const serverId = meta?.serverId ?? this.serverIdFromPrefix(name)
    if (serverId === undefined) return undefined

    if (!policy.enabledServerIds.has(serverId)) {
      return `unknown tool "${name}"`
    }

    const disabled = policy.disabledRawTools.get(serverId)
    if (!disabled || disabled.size === 0) return undefined
    const rawName = meta?.rawName ?? name.slice(`mcp__${serverId}__`.length)
    return disabled.has(rawName) ? `unknown tool "${name}"` : undefined
  }

  /** Match a `mcp__<serverId>__*` name against the configured servers. */
  private serverIdFromPrefix(name: string): string | undefined {
    if (!name.startsWith('mcp__')) return undefined
    for (const serverId of Object.keys(this.getMcpStore().servers)) {
      if (name.startsWith(`mcp__${serverId}__`)) return serverId
    }
    return undefined
  }

  /** Resolve a policy, falling back to the global scope when the session is unknown yet. */
  private policyFor(sessionId?: string): McpPolicy {
    if (!sessionId) return this.computePolicy(undefined, undefined)

    const cached = this.policies.get(sessionId)
    if (cached) return cached

    // A cache miss must reuse the remembered workspace: re-deriving it is
    // impossible here (async) and `undefined` would silently mean the global layer.
    return this.computePolicy(sessionId, this.policyWorkspace.get(sessionId))
  }

  private computePolicy(sessionId?: string, workspaceId?: string): McpPolicy {
    const effective = resolveEffectiveMcp(
      this.getSessionSettingsStore(),
      this.getMcpStore(),
      sessionId,
      workspaceId,
    )
    const disabledRawTools = new Map<string, Set<string>>()
    for (const [serverId, rawNames] of Object.entries(
      effective.effectiveDisabledTools,
    )) {
      if (rawNames.length > 0) disabledRawTools.set(serverId, new Set(rawNames))
    }
    return {
      enabledServerIds: new Set(effective.enabledServerIds),
      disabledRawTools,
    }
  }

  /**
   * Mount the session's servers without blocking agent creation.
   *
   * `agent/created` is awaited by the registry, so awaiting a network mount here
   * would delay the agent's first turn.
   */
  private mountInBackground(policy: McpPolicy): void {
    const ids = Array.from(policy.enabledServerIds)
    if (ids.length === 0) return
    void this.manager.ensureServersMounted(ids).catch(() => {
      // Mount failures are surfaced by the manager's own status bookkeeping.
    })
  }

  private projectionFor(agent: Agent): AgentProjection {
    let projection = this.projections.get(agent)
    if (!projection) {
      projection = {
        denyKey: undefined,
        disposeRestrict: undefined,
        sections: new Map(),
      }
      this.projections.set(agent, projection)
    }
    return projection
  }

  private sessionIdOf(agent?: Agent): string | undefined {
    if (!agent) return undefined
    return (
      resolveAgentSessionId(agent, this.ctx) ?? agent.session?.id ?? agent.id
    )
  }

  private toolsService(): ToolsService | undefined {
    return this.ctx.get('tools') as ToolsService | undefined
  }
}

/** Read the `server` argument of a resource tool call. */
function readServerArgument(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') return undefined
  const server = (args as { server?: unknown }).server
  return typeof server === 'string' && server.length > 0 ? server : undefined
}
