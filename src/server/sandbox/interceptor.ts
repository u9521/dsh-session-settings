import os from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import type {
  SandboxCapabilityInfo,
  SandboxPolicyLike,
  SandboxPolicyServiceLike,
  SandboxSkippedEntry,
  SessionSettingsStore,
  SystemPromptService,
} from '../../types.ts'
import { resolveEffectiveSandbox } from '../session/storage.ts'
import {
  resolveAgentSessionId,
  resolveWorkspaceForSession,
} from '../session/resolution.ts'
import { resolveAllowSet, type ResolvedAllowRoot } from './paths.ts'

/**
 * Widening the session's writable roots with its configured extra directories,
 * and telling the model what it was given.
 *
 * ## Where the widening happens
 *
 * The host stamps ONE complete policy per call from `ctx.sandboxPolicy.resolve()`
 * — the bash tool, the persistent terminal, and the filesystem mutation fence
 * all ask that same service — and that policy carries a documented
 * `additionalWritableRoots` field which every enforcing backend already folds
 * into its writable-root derivation.
 *
 * So the plugin wraps `resolve()`. Editing the runner argv instead (the
 * previous approach) was wrong in two ways that only became visible after the
 * field existed: the provider composes the argv as `[...runnerArgv, '--', …]`,
 * so an inserted `--rw`/`--bind` lands inside the runner's own argument list
 * AFTER the grant block rather than as another grant, and a backend that cannot
 * accept extra roots (windows-acl) throws instead of ignoring them.
 *
 * ## Why the wrapper is installed on the service instance
 *
 * `ctx.get(name)` returns a traced Proxy, and reading a FUNCTION property
 * through it hands back a fresh shadow wrapper on every access. The write still
 * forwards to the one shared target, but an identity comparison against a
 * previously-read function can never hold — hence {@link installed} rather than
 * a live-function check.
 *
 * @module session-settings/sandbox/interceptor
 */

/**
 * Owns the `resolve` widening, the per-session resolution cache, and the
 * capability report the settings UI reads.
 */
export class SandboxInterceptor {
  private readonly ctx: Context
  private readonly getSessionSettingsStore: () => SessionSettingsStore

  /** The policy service whose `resolve` was replaced; the restore target. */
  private patchedService: SandboxPolicyServiceLike | undefined
  /** The wrapper installed on the service, or `undefined` before installation. */
  private wrapper: ((request?: unknown) => SandboxPolicyLike) | undefined
  /**
   * Whether this interceptor's wrapper is installed and live.
   *
   * The honest capability signal. It is cleared by {@link restore} — including
   * the restore that a scope disposal triggers — so a reload or unload that
   * removes the patch also removes the claim, rather than reporting a
   * capability nothing implements.
   */
  private installed = false
  /**
   * Why the wrapper is not installed, when it is not.
   *
   * Distinguishes "the service has not activated yet" from "the service cannot
   * be extended", so {@link detectCapability} can report which one the user is
   * actually looking at instead of collapsing both into "unsupported".
   */
  private patchFailure: string | undefined

  /**
   * sessionId -> resolved roots. Keyed by the ROOT session, so a child inherits
   * its parent's grants without a second lookup.
   */
  private readonly cache = new Map<string, ResolvedAllowRoot[]>()
  /** sessionId -> the workspace its roots were resolved against. */
  private readonly cacheWorkspace = new Map<string, string | undefined>()
  /** Configured entries dropped at the last resolution, by session. */
  private readonly skipped = new Map<string, SandboxSkippedEntry[]>()

  constructor(
    ctx: Context,
    getSessionSettingsStore: () => SessionSettingsStore,
  ) {
    this.ctx = ctx
    this.getSessionSettingsStore = getSessionSettingsStore
  }

  /**
   * Install the `resolve` widening and the prompt contribution.
   *
   * The widening must be installed through `ctx.inject(['sandboxPolicy'], …)`.
   * `apply` runs once when this plugin loads, and composition row order carries
   * no load semantics — a row activates when its own services become available.
   * A synchronous `ctx.get('sandboxPolicy')` in `apply` therefore returns
   * `undefined` whenever the policy row activates later, leaving every
   * configured directory unenforced.
   */
  public start(): void {
    this.ctx.inject(['sandboxPolicy'], (scope: Context) => {
      const service = scope.get('sandboxPolicy') as
        SandboxPolicyServiceLike | undefined
      if (!service || typeof service.resolve !== 'function') {
        this.patchFailure =
          'The mounted sandbox policy service exposes no resolve() method.'
        return
      }
      const original = service.resolve.bind(service)
      this.patchedService = service
      this.patchFailure = undefined
      const wrapper = (request?: unknown) =>
        this.withExtraRoots(original(request), request)
      this.wrapper = wrapper
      this.installed = true
      service.resolve = wrapper

      // Restore on scope disposal, so a reload or unload cannot leave the
      // service wrapped by a disposed interceptor.
      scope.effect(
        () => () => this.restore(),
        'session-settings: sandbox policy wrapper',
      )
    })

    this.registerPromptSection()
  }

  /**
   * Attach this session's extra roots to one resolved policy.
   *
   * The session is re-derived from the request the caller passed rather than
   * from the policy, because a policy's `sessionId` is stamped only after the
   * host resolves it and a caller may legitimately ask for a policy that names
   * no session (agentless calls, which get no grants).
   *
   * Resolution is synchronous on purpose: `resolve()` is called on the hot path
   * of every subprocess and every filesystem mutation, so it must not await.
   * The cache is populated ahead of time by {@link prime} — called from the
   * prompt-assembly path, which is the only place a session's settings can
   * change between turns.
   */
  private withExtraRoots(
    policy: SandboxPolicyLike,
    request?: unknown,
  ): SandboxPolicyLike {
    const sessionId = this.sessionIdOf(request) ?? policy.sessionId
    if (!sessionId) return policy

    const roots = this.cache.get(sessionId)
    if (!roots || roots.length === 0) return policy

    return {
      ...policy,
      additionalWritableRoots: [
        ...(policy.additionalWritableRoots ?? []),
        ...roots.map((root) => root.path),
      ],
    }
  }

  /** The session a `resolve()` request names, if any. */
  private sessionIdOf(request?: unknown): string | undefined {
    if (!request || typeof request !== 'object') return undefined
    const session = (request as { session?: { id?: unknown } }).session
    const id = session?.id
    return typeof id === 'string' ? id : undefined
  }

  /**
   * Resolve a session's allow list into the cache, ahead of any `resolve()` call
   * that would need it.
   *
   * @param sessionId - the session whose settings are being read.
   * @param workspaceRoot - the session's workspace boundary.
   */
  public async prime(
    sessionId: string | undefined,
    workspaceRoot: string,
  ): Promise<void> {
    if (!sessionId) return
    if (this.cache.has(sessionId) || this.priming.has(sessionId)) return
    this.priming.add(sessionId)
    try {
      const workspaceId = await resolveWorkspaceForSession(this.ctx, sessionId)
      const { allow } = resolveEffectiveSandbox(
        this.getSessionSettingsStore(),
        sessionId,
        workspaceId,
      )
      const { roots, rejected } = resolveAllowSet(
        allow,
        workspaceRoot,
        os.homedir(),
      )
      this.cacheWorkspace.set(sessionId, workspaceId)
      this.cache.set(sessionId, roots)
      this.skipped.set(
        sessionId,
        rejected.map((entry) => ({ path: entry.path, reason: entry.reason })),
      )
    } finally {
      this.priming.delete(sessionId)
    }
  }

  /** Sessions whose resolution is in flight, so `prime` is idempotent. */
  private readonly priming = new Set<string>()

  /**
   * What the mounted backend can do, for the settings UI.
   *
   * Reads the policy service's own facts rather than the plugin's patch state:
   * the `additionalWritableRoots` channel is the host's, so the capability
   * exists whenever the service is mounted. The plugin only supplies the roots.
   */
  public detectCapability(sessionId?: string): SandboxCapabilityInfo {
    const mode = this.effectiveModeFor(sessionId)
    const withMode = mode ? { effectiveMode: mode } : {}
    const service = this.ctx.get('sandboxPolicy') as
      SandboxPolicyServiceLike | undefined
    if (!service || typeof service.resolve !== 'function') {
      return {
        canAllowExtraRoots: false,
        reason:
          'No sandbox policy service is mounted in this composition, so extra directories cannot take effect.',
        ...withMode,
      }
    }
    if (!this.installed) {
      return {
        canAllowExtraRoots: false,
        reason:
          this.patchFailure ??
          'The sandbox policy service has not been extended by this plugin, so extra directories would not take effect.',
        ...withMode,
      }
    }
    return { canAllowExtraRoots: true, ...withMode }
  }

  /**
   * The session's effective file-effect mode, or `undefined` when unknown.
   *
   * Read from the host's policy owner — the session's `sandbox/mode` projection
   * is host state the browser cannot see. A missing session (a New-Session page)
   * falls back to the deployment default, which is what such a session would
   * actually start from.
   *
   * @param sessionId - the session whose mode is asked for.
   * @returns the mode, or undefined when no policy service is mounted.
   */
  private effectiveModeFor(sessionId?: string): string | undefined {
    const policy = this.ctx.get('sandboxPolicy') as
      SandboxPolicyServiceLike | undefined
    if (!policy) return undefined
    const session = sessionId
      ? (
          this.ctx.get('sessions') as
            { get?: (id: string) => unknown } | undefined
        )?.get?.(sessionId)
      : undefined
    if (!session) return policy.defaultMode
    try {
      return policy.overrideOf(session) ?? policy.defaultMode
    } catch {
      return policy.defaultMode
    }
  }

  /** Configured entries skipped at the last resolution for one session. */
  public skippedFor(sessionId?: string): SandboxSkippedEntry[] {
    if (!sessionId) return []
    return this.skipped.get(sessionId) ?? []
  }

  /** Drop every cached resolution; the next call re-reads the settings store. */
  public notifyPolicyChanged(): void {
    this.cache.clear()
    this.cacheWorkspace.clear()
    this.skipped.clear()
  }

  /**
   * Restore the service's own `resolve`.
   *
   * `resolve` is a prototype method, so the patch is an own property shadowing
   * it and removal is a `delete` — assigning the bound original back would
   * leave an own property that outlives the plugin.
   */
  public restore(): void {
    const service = this.patchedService
    if (service && this.wrapper) {
      delete (service as { resolve?: unknown }).resolve
    }
    this.wrapper = undefined
    this.installed = false
    this.patchedService = undefined
  }

  /**
   * Contribute the granted directories to the model's runtime context.
   *
   * Registered as its OWN context entry immediately after the host's
   * `sandbox:policy` rather than by editing that text: the host's section is
   * written by `@deepseek-ai/dsh-sandbox-policy` and is not ours to reword, and
   * an appended entry keeps the mode statement and the grants stated
   * separately, which is how they are actually decided.
   *
   * The same assembly callback primes the cache: it is the one point per turn
   * where the agent and its settings are both at hand, and `resolve()` cannot
   * await.
   */
  private registerPromptSection(): void {
    this.ctx.inject(['systemPrompt'], (scope: Context) => {
      const systemPrompt = scope.get('systemPrompt') as
        SystemPromptService | undefined
      if (!systemPrompt || typeof systemPrompt.context !== 'function') return

      const order =
        typeof systemPrompt.getContextOrder === 'function'
          ? systemPrompt.getContextOrder('SANDBOX_POLICY') + 1
          : undefined

      scope.effect(() => {
        const dispose = systemPrompt.context!({
          name: 'session-settings:sandbox-allow',
          ...(order === undefined ? {} : { order }),
          text: (context) => {
            const agent = context?.agent
            const sessionId = resolveAgentSessionId(agent, this.ctx)
            if (!sessionId) return ''
            const roots = this.cache.get(sessionId)
            if (!roots || roots.length === 0) return ''
            return renderAllowContext(roots)
          },
        })
        return () => dispose()
      }, 'session-settings: sandbox allow context')
    })
  }
}

/**
 * Render the granted-directory paragraph.
 *
 * Mirrors the host's own `sandbox:policy` wording so the two read as one
 * policy statement: the paths are JSON-quoted for the same reason, and the
 * sentence that keeps the boundary honest — everything else outside the
 * workspace stays unwritable — is stated rather than implied, because a list of
 * grants with no boundary invites the model to treat them as the whole rule.
 *
 * @param roots - resolved, existing directories.
 * @returns the context text, or an empty string when there is nothing to say.
 */
export function renderAllowContext(
  roots: readonly ResolvedAllowRoot[],
): string {
  if (roots.length === 0) return ''
  const lines = roots.map((root) =>
    root.description
      ? `- ${JSON.stringify(root.path)} — ${root.description}`
      : `- ${JSON.stringify(root.path)}`,
  )
  return [
    'This session is additionally allowed to write these directories outside the session workspace:',
    ...lines,
    'Every other location outside the session workspace remains read-only; a denied write reports the sandbox denial marker.',
  ].join('\n')
}
/**
 * Wire the sandbox allow-list onto the runtime.
 *
 * @param ctx - the plugin context.
 * @param getSessionSettingsStore - lazily loaded settings store accessor.
 * @returns the interceptor, so callers can invalidate its cache after a save.
 */
export function registerSandboxInterceptor(
  ctx: Context,
  getSessionSettingsStore: () => SessionSettingsStore,
): SandboxInterceptor {
  const interceptor = new SandboxInterceptor(ctx, getSessionSettingsStore)
  interceptor.start()

  // Prime the cache from the two places a session's settings can become
  // relevant: a new agent (its first prompt is about to ask for a policy) and
  // every assembly (a setting may have changed between turns).
  ctx.on('agent/created', async ({ agent }) => {
    try {
      const sessionId = resolveAgentSessionId(agent, ctx)
      const workspaceRoot = agent?.session?.header?.cwd
      await interceptor.prime(sessionId, workspaceRoot ?? process.cwd())
    } catch {
      // A resolution problem must never fail agent creation; the next
      // assembly retries.
    }
  })

  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    try {
      const agent = context?.agent
      const sessionId = resolveAgentSessionId(agent, ctx)
      const workspaceRoot =
        agent?.session?.header?.cwd ??
        (ctx.get('sandboxPolicy') as { workspaceRoot?: string } | undefined)
          ?.workspaceRoot ??
        process.cwd()
      await interceptor.prime(sessionId, workspaceRoot)
    } catch {
      // A resolution problem must never fail assembly.
    }
    return next()
  })

  ctx.effect(
    () => () => interceptor.restore(),
    'session-settings: sandbox allow interceptor',
  )
  return interceptor
}
