import os from 'node:os'
import path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {
  ConfinedArgvLike,
  SandboxCapabilityInfo,
  SandboxPolicyServiceLike,
  SandboxProviderLike,
  SandboxSkippedEntry,
  SandboxPolicyLike,
  SessionSettingsStore,
  SystemPromptService,
} from '../../types.ts'
import { resolveEffectiveSandbox } from '../session/storage.ts'
import {
  resolveAgentSessionId,
  resolveWorkspaceForSession,
} from '../session/resolution.ts'
import { resolveAllowSet, type ResolvedAllowRoot } from './paths.ts'
import { SandboxFsProxy } from './fs-proxy.ts'

/**
 * Widening the provider's write grants with the session's configured extra
 * directories, and telling the model what it was given.
 *
 * ## Why `confine` and not the policy resolver
 *
 * The extra roots ultimately have to appear as ARGUMENTS in the argv the
 * provider returns, and `ctx.sandbox.confine()` is the one seam that produces
 * exactly that. Two properties make it the right cut:
 *
 * - **It is per call.** The provider's `runnerCommand` config is a
 *   deployment-time field: changing it needs a plugin reload and disqualifies
 *   the functional probes, so it cannot carry a per-session list. `confine` is
 *   invoked per execution and can.
 * - **It carries the caller's identity.** The `policy` argument already holds
 *   the branded `sessionId` that `sandboxPolicy.resolve()` stamped on it, so
 *   this module never has to reconstruct which session is asking. That is why
 *   the extra roots need no session event: only the prompt text does.
 *
 * The cost is that `confine` is a live service method, not a documented
 * extension point — `confine` is patched on the instance and the original is
 * restored on unload. {@link SandboxInterceptor.detectCapability} exists so a
 * DSH release that reshapes it degrades to "no extra roots, and the UI says so"
 * rather than to a silent no-op.
 *
 * ## Append grammar differs per backend
 *
 * Each backend expresses a grant its own way, and the selected one is only
 * knowable from the argv that came back:
 *
 * | backend  | argv[0]                    | appended form                |
 * |----------|----------------------------|------------------------------|
 * | landlock | `…/landlock-run`           | `--rw <path>`                |
 * | bwrap    | `bwrap`                    | `--bind <path> <path>`       |
 * | seatbelt | `sandbox-exec`             | not expressible (see below)  |
 *
 * Seatbelt's profile is a single SBPL string passed to `-p`; extending it means
 * rewriting that string, which is a different (and much larger) change. The
 * capability report says so instead of pretending.
 *
 * Every addition goes BEFORE the `--` separator, since anything after it is
 * argv for the wrapped command.
 *
 * @module session-settings/sandbox/interceptor
 */

/** Separator between the runner's own arguments and the wrapped command. */
const ARGV_SEPARATOR = '--'

/** Backends recognized by their program name, mapped to how they take a grant. */
type BackendKind = 'landlock' | 'bwrap' | 'seatbelt' | 'windows-acl'

/** Identify the backend from the program the provider chose, or `undefined`. */
function backendOf(argv: readonly string[]): BackendKind | undefined {
  const program = argv[0]
  if (!program) return undefined
  const base = path.basename(program).toLowerCase()
  if (base === 'bwrap' || base.startsWith('bwrap')) return 'bwrap'
  if (base === 'sandbox-exec' || base.startsWith('sandbox-exec'))
    return 'seatbelt'
  if (base === 'landlock-run' || base.includes('landlock')) return 'landlock'
  if (base.includes('windows-acl') || base.includes('acl-run'))
    return 'windows-acl'
  return undefined
}

/**
 * Insert grant arguments for `roots` into a confined argv.
 *
 * Returns the argv unchanged when the backend cannot express them, so the
 * caller's confinement stays exactly as the provider produced it.
 *
 * @param argv - the argv the provider returned.
 * @param roots - absolute directories to add to the write grant.
 * @returns the widened argv, or the original when nothing can be added.
 */
function withExtraRoots(
  argv: readonly string[],
  roots: readonly ResolvedAllowRoot[],
): {
  argv: string[]
  applied: 'landlock' | 'bwrap'
  skippedBackend?: BackendKind
} {
  const backend = backendOf(argv)
  if (backend !== 'landlock' && backend !== 'bwrap') {
    return {
      argv: argv as string[],
      applied: 'landlock',
      ...(backend ? { skippedBackend: backend } : {}),
    }
  }

  const separator = argv.lastIndexOf(ARGV_SEPARATOR)
  // No separator means this is not the shape this module understands; leave it
  // alone rather than guess where the runner's arguments end.
  if (separator < 0) {
    return { argv: argv as string[], applied: 'landlock' }
  }

  const extra =
    backend === 'bwrap'
      ? roots.flatMap((root) => ['--bind', root.path, root.path])
      : roots.flatMap((root) => ['--rw', root.path])

  return {
    argv: [...argv.slice(0, separator), ...extra, ...argv.slice(separator)],
    applied: backend,
  }
}

/**
 * Owns the `confine` widening, the per-session resolution cache, and the
 * capability report the settings UI reads.
 */
export class SandboxInterceptor {
  private readonly ctx: Context
  private readonly getSessionSettingsStore: () => SessionSettingsStore

  /** The provider whose `confine` was replaced; the restore target. */
  private patchedProvider: SandboxProviderLike | undefined
  /**
   * The wrapper installed on the provider, or `undefined` before installation.
   *
   * Kept for the restore path (the patch may only be removed while this exact
   * value is still live). It is deliberately NOT used to decide capability:
   * cordis hands back a fresh shadow wrapper for every function read through a
   * service Proxy, so an identity check against it can never succeed.
   */
  private wrapper: SandboxProviderLike['confine'] | undefined
  /**
   * Whether this interceptor's `confine` wrapper is installed and live.
   *
   * The honest capability signal. It is cleared by {@link restore} — including
   * the restore that a scope disposal triggers — so a reload or unload that
   * removes the patch also removes the claim, rather than reporting a
   * capability nothing implements.
   */
  private installed = false
  /**
   * Why the `confine` wrapper is not installed, when it is not.
   *
   * Distinguishes "the provider has not activated yet" from "the provider
   * cannot be extended", so {@link detectCapability} can report which one the
   * user is actually looking at instead of collapsing both into "unsupported".
   */
  private patchFailure: string | undefined
  /** The backend the argv identified at the last wrap, for diagnostics. */
  private observedBackend: string | undefined

  /**
   * sessionId -> resolved roots. Keyed by the ROOT session, so a child inherits
   * its parent's grants without a second lookup.
   */
  private readonly cache = new Map<string, ResolvedAllowRoot[]>()
  /** sessionId -> the workspace its roots were resolved against. */
  private readonly cacheWorkspace = new Map<string, string | undefined>()
  /** Configured entries dropped at the last resolution, by session. */
  private readonly skipped = new Map<string, SandboxSkippedEntry[]>()
  /** Guards the one-time degradation warning so a per-call path cannot spam it. */
  private backendWarningEmitted = false

  constructor(
    ctx: Context,
    getSessionSettingsStore: () => SessionSettingsStore,
  ) {
    this.ctx = ctx
    this.getSessionSettingsStore = getSessionSettingsStore
  }

  /**
   * Install the `confine` widening and the prompt contribution.
   *
   * Two facts about cordis shape this method, and each one silently produced
   * "the UI says unsupported" when ignored:
   *
   * 1. **The widening must be installed through `ctx.inject(['sandbox'], …)`.**
   *    `apply` runs once when this plugin loads, and the base bundle states that
   *    COMPOSITION ROW ORDER CARRIES NO LOAD SEMANTICS — a row activates when
   *    its own services become available. A synchronous `ctx.get('sandbox')` in
   *    `apply` therefore returns `undefined` whenever the sandbox row activates
   *    later, leaving every configured directory unenforced.
   *
   * 2. **The patch is installed once, on the service object.** `ctx.get(name)`
   *    returns a traced Proxy, and reading a FUNCTION property through it hands
   *    back a fresh shadow wrapper on every access. The write still forwards to
   *    the one shared target (verified: a consumer's later `ctx.get` observes
   *    it), but an identity comparison against a previously-read function can
   *    never hold — hence {@link installed} rather than a live-function check.
   *
   * A composition with no sandbox provider never fires the callback; the
   * capability report then says so, which is correct rather than degraded.
   */
  public start(): void {
    this.ctx.inject(['sandbox'], (scope: Context) => {
      const provider = scope.get('sandbox') as SandboxProviderLike | undefined
      if (!provider || typeof provider.confine !== 'function') {
        this.patchFailure =
          'The mounted sandbox service exposes no confine() method.'
        return
      }
      // `confine` is an ordinary prototype method, so the wrapper is installed
      // as an own property that shadows it; the inherited method stays intact
      // and is what `restore()` falls back to.
      const bound = provider.confine.bind(provider)
      this.patchedProvider = provider
      this.patchFailure = undefined
      const wrapper: SandboxProviderLike['confine'] = (argv, policy, signal) =>
        this.confined(bound, argv, policy, signal)
      this.wrapper = wrapper
      this.installed = true
      provider.confine = wrapper

      // Restore on scope disposal, so a reload or unload cannot leave the
      // provider wrapped by a disposed interceptor.
      scope.effect(
        () => () => this.restore(),
        'session-settings: sandbox confine wrapper',
      )
    })

    this.registerPromptSection()
  }

  /**
   * What the mounted backend can do, for the settings UI.
   *
   * The test is whether THIS interceptor's wrapper is still the function the
   * provider will call — not whether a patch was applied at some point. A
   * plugin reload or an HMR swap can replace the provider behind the plugin's
   * back, and a stored "patched" flag would keep claiming a capability nothing
   * implements. Comparing the live function is the only check that stays true.
   *
   * Reports WHICH failure it is: a provider that has not activated yet is a
   * different fact from one that cannot be extended, and collapsing them into
   * one "unsupported" message is what made the first diagnosis hard.
   *
   * Deliberately never forces a runner probe, so a client reading it cannot
   * itself make the deployment select a backend.
   */
  public detectCapability(sessionId?: string): SandboxCapabilityInfo {
    const mode = this.effectiveModeFor(sessionId)
    const withMode = mode ? { effectiveMode: mode } : {}
    const provider = this.ctx.get('sandbox') as SandboxProviderLike | undefined
    if (!provider || typeof provider.confine !== 'function') {
      return {
        canAllowExtraRoots: false,
        reason:
          this.patchFailure ??
          'No sandbox provider is mounted in this composition, so extra directories cannot take effect.',
        ...withMode,
      }
    }
    if (!this.installed) {
      return {
        canAllowExtraRoots: false,
        reason:
          this.patchFailure ??
          'The sandbox provider has not been extended by this plugin, so extra directories would not take effect.',
        ...withMode,
      }
    }
    return {
      canAllowExtraRoots: true,
      ...(this.observedBackend ? { backend: this.observedBackend } : {}),
      ...withMode,
    }
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
   * Restore the provider's own `confine`.
   *
   * `confine` is a prototype method, so the patch is an own property shadowing
   * it and removal is a `delete` — assigning the bound original back would leave
   * an own property that outlives the plugin.
   *
   * The removal is deliberately unconditional once the interceptor owns a
   * patch. A cordis service Proxy hands back a fresh shadow wrapper for every
   * function read, so "is the live `confine` still ours?" cannot be answered by
   * comparison, and a guarded delete would silently skip the cleanup. The
   * retained {@link wrapper} is instead used only as the signal that a patch
   * was ever installed.
   */
  public restore(): void {
    const provider = this.patchedProvider
    if (provider && this.wrapper) {
      delete (provider as { confine?: unknown }).confine
    }
    this.wrapper = undefined
    this.installed = false
    this.patchedProvider = undefined
  }

  /** Wrap one `confine` call with the caller's extra roots. */
  private async confined(
    original: SandboxProviderLike['confine'],
    argv: readonly string[],
    policy: SandboxPolicyLike,
    signal?: AbortSignal,
  ): Promise<ConfinedArgvLike> {
    const result = await original(argv, policy, signal)

    // Everything below is pure widening of an already-correct confinement. Any
    // failure here must therefore return the provider's own result untouched:
    // the safe direction is the boundary the provider already established, not
    // a failed command.
    try {
      const roots = await this.rootsFor(policy)
      if (roots.length === 0) return result

      const widened = withExtraRoots(result.argv, roots)
      if (widened.skippedBackend) {
        this.warnUnsupportedBackend(widened.skippedBackend)
        return result
      }
      // Recorded so the capability report can name the backend the provider
      // actually selected, rather than the plugin guessing from the platform.
      this.observedBackend = widened.applied
      return { ...result, argv: widened.argv }
    } catch (error) {
      console.warn(
        "[session-settings] [SANDBOX-ALLOW] Failed to widen the sandbox grants; running under the provider's own policy:",
        error instanceof Error ? error.message : String(error),
      )
      return result
    }
  }

  /**
   * The resolved extra roots for the session a call belongs to.
   *
   * Shared with the filesystem proxy so both enforcement sides resolve from one
   * cache: a second resolution path could answer differently and produce the
   * very "bash writes it but the write tool cannot" split this module exists to
   * remove.
   *
   * @param policy - the per-call policy whose session names the settings scope.
   * @returns the resolved, existing directories granted to that session.
   */
  public async rootsFor(
    policy: SandboxPolicyLike,
  ): Promise<ResolvedAllowRoot[]> {
    const sessionId = policy.sessionId
    if (sessionId === undefined) return []

    const cached = this.cache.get(sessionId)
    if (cached) return cached

    const workspaceId = await resolveWorkspaceForSession(this.ctx, sessionId)
    const workspaceRoot = policy.workspaceRoot
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
    return roots
  }

  /**
   * Report the appended-root refusal once per backend.
   *
   * A per-call warning would drown the log; silence would let a macOS user
   * believe a saved grant is in force. Once per backend is the honest middle.
   */
  private warnUnsupportedBackend(backend: BackendKind): void {
    if (this.backendWarningEmitted) return
    this.backendWarningEmitted = true
    console.warn(
      `[session-settings] [SANDBOX-ALLOW] The selected sandbox backend ("${backend}") cannot accept extra writable directories; configured allow entries are not applied on this host.`,
    )
  }

  /**
   * Contribute the granted directories to the model's runtime context.
   *
   * Registered as its OWN context entry immediately after the host's
   * `sandbox:policy` rather than by editing that text: the host's section is
   * written by `@deepseek-ai/dsh-sandbox-policy` and is not ours to reword, and
   * an appended entry keeps the mode statement and the grants stated
   * separately, which is how they are actually decided.
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

  // The filesystem half: same grant list, applied to the `write` / `edit`
  // tools, which never go through `confine`.
  const fsProxy = new SandboxFsProxy(ctx, interceptor)
  fsProxy.start()

  ctx.effect(
    () => () => {
      interceptor.notifyPolicyChanged()
      fsProxy.restore()
      interceptor.restore()
    },
    'session-settings: sandbox allow interceptor',
  )
  return interceptor
}
