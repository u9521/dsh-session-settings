import os from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import type {
  Agent,
  SandboxCapabilityInfo,
  SandboxPolicyServiceLike,
  SandboxSkippedEntry,
  Session,
  SessionSettingsStore,
  SystemPromptService,
} from '../../types.ts'
import { resolveEffectiveSandbox } from '../session/storage.ts'
import { resolveWorkspaceForSession } from '../session/resolution.ts'
import { resolveAllowSet, type ResolvedAllowRoot } from './paths.ts'

/**
 * Granting the session's configured extra directories, and telling the model
 * what it was given.
 *
 * ## The channel
 *
 * The host owns ONE policy per session and stamps its mode, workspace root, and
 * extra writable roots onto every confined capability call — the bash tool, the
 * persistent terminal, and the filesystem fence all ask `ctx.sandboxPolicy`.
 *
 * `registerWritableRoot(session, directory)` registers a grant against ONE live
 * Session for the lifetime of the calling effect, and `resolve()` folds active
 * registrations into the policy it hands out. That is exactly this feature's
 * shape, so it is the channel used here.
 *
 * - No own-property patch on a shared host service, so an unload cannot leave a
 *   disposed wrapper behind and a reload needs no restore bookkeeping.
 * - No cache to prime. A registration IS the state: adding or removing a grant
 *   takes effect on the next resolution with no invalidation seam.
 * - Isolation is the host's. A grant belongs to one Session object, so a
 *   subagent Session and an agentless call cannot inherit the root session's
 *   grants by id the way an id-keyed cache could.
 *
 * Registrations are runtime-only and must be repeated after a resume or fork,
 * which is why they are installed from `agent/created` (a fresh Agent, whether
 * new or resumed) rather than from a settings save.
 *
 * @module session-settings/sandbox/interceptor
 */

/** One live Session's installed grants, keyed by the exact Session object. */
interface SessionGrants {
  /** Disposers for the currently registered directories. */
  disposers: Array<() => void>
  /** The directories currently registered, for a cheap no-op check. */
  paths: Set<string>
  /**
   * The same directories as resolved entries, descriptions included.
   *
   * Kept here rather than rebuilt while rendering the prompt: a context text
   * provider is SYNCHRONOUS, and resolving the settings ladder for a session is
   * async (it may have to read the workspace registry). This is the same data
   * the installation pass already computed.
   */
  described: ResolvedAllowRoot[]
  /** Configured entries dropped at the last installation, for the panel. */
  skipped: SandboxSkippedEntry[]
}

/**
 * Owns the per-session writable-root registrations and the mode report the
 * settings UI reads.
 */
export class SandboxInterceptor {
  private readonly ctx: Context
  private readonly getSessionSettingsStore: () => SessionSettingsStore

  /**
   * Live grants, keyed by the Session object the host will hand to `resolve()`.
   *
   * The key is the object because that is the host's own key: `registerWritableRoot`
   * stores grants in a `WeakMap<Session, …>` and `resolve({ session })` looks
   * them up by identity, so a registration made with one Session instance is
   * invisible to a lookup made with another one of the same id.
   */
  private readonly grants = new WeakMap<Session, SessionGrants>()
  /**
   * The sessions currently holding grants.
   *
   * A WeakMap cannot be iterated, and every registration must be disposed
   * explicitly: `registerWritableRoot` creates its Cordis effect on the POLICY
   * SERVICE's context, not on this plugin's scope, so an unload of this plugin
   * does not unwind them. Dropping the strong references on release keeps the
   * set bounded by the number of live Agents.
   */
  private readonly tracked = new Set<Session>()

  /** The policy service, resolved once its injection scope is live. */
  private service: SandboxPolicyServiceLike | undefined

  constructor(
    ctx: Context,
    getSessionSettingsStore: () => SessionSettingsStore,
  ) {
    this.ctx = ctx
    this.getSessionSettingsStore = getSessionSettingsStore
  }

  /**
   * Bind to the policy service.
   *
   * A composition that mounts this plugin without mounting `sandboxPolicy` has
   * no way to enforce anything, so the injection never fires and the plugin
   * simply contributes no grants — the panel reports the mode it can resolve.
   */
  public start(): void {
    this.ctx.inject(['sandboxPolicy'], (scope: Context) => {
      this.service = scope.get('sandboxPolicy') as SandboxPolicyServiceLike
      // Cover Agents created before the service activated: `agent/created` ran
      // while it was absent and could not register anything.
      void this.applyToLiveSessions().catch(() => {})
      scope.effect(
        () => () => this.releaseAll(),
        'session-settings: sandbox writable roots',
      )
    })

    this.registerPromptSection()
  }

  /**
   * Bring one Session's registrations in line with its settings.
   *
   * Idempotent and diff-based: a call whose resolved paths match what is already
   * registered does nothing, so the frequent caller (`agent/created` plus each
   * settings change) does not churn the host's registration store.
   *
   * @param session - the exact live Session the grants apply to.
   * @param workspaceRoot - the session's workspace boundary, for `.` resolution.
   */
  public async applyForSession(
    session: Session | undefined,
    workspaceRoot: string,
  ): Promise<void> {
    if (!session) return
    const service = this.service
    if (!service) return

    const sessionId = session.id
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
    const skipped = rejected.map((entry) => ({
      path: entry.path,
      reason: entry.reason,
    }))

    const current = this.grants.get(session)
    const nextPaths = new Set(roots.map((root) => root.path))
    if (current && samePathSet(current.paths, nextPaths)) {
      // Same directories: keep the registrations, refresh only the report.
      current.described = roots
      current.skipped = skipped
      return
    }

    // Replace wholesale rather than diffing individual roots. A changed entry is
    // usually a changed description or a re-spelled path, and the host keeps
    // duplicate registrations independent — reusing one here would leave a
    // stale directory registered when the user replaced it.
    this.releaseSession(session)
    const next: SessionGrants = {
      disposers: [],
      paths: nextPaths,
      described: roots,
      skipped,
    }
    for (const root of roots) {
      try {
        next.disposers.push(service.registerWritableRoot(session, root.path))
      } catch {
        // A directory the host refuses (vanished, swapped for a symlink, a
        // permission problem) must not fail the agent: record it as skipped so
        // the panel can say "saved but not in effect" instead of claiming
        // success.
        nextPaths.delete(root.path)
        skipped.push({
          path: root.path,
          reason: 'the sandbox policy rejected this directory',
        })
      }
    }
    this.grants.set(session, next)
    this.tracked.add(session)
  }

  /** Drop every registration installed for one Session. */
  public releaseSession(session: Session): void {
    const grants = this.grants.get(session)
    this.tracked.delete(session)
    if (!grants) return
    this.grants.delete(session)
    for (const dispose of grants.disposers) {
      try {
        dispose()
      } catch {
        // A disposer that throws has already removed its registration (Cordis
        // effects are idempotent); swallowing keeps the remaining ones running.
      }
    }
  }

  /**
   * Drop every registration this plugin installed.
   *
   * Required on unload: the host's disposer belongs to the policy service's own
   * context, so without this an unloaded plugin would leave grants in force for
   * Sessions that outlive it.
   */
  public releaseAll(): void {
    for (const session of [...this.tracked]) this.releaseSession(session)
    this.tracked.clear()
  }

  /** The live Session with this id, when one is tracked. */
  private trackedSession(sessionId: string): Session | undefined {
    for (const session of this.tracked) {
      if (session.id === sessionId) return session
    }
    return undefined
  }

  /**
   * The target session's resolved sandbox facts, for the settings UI.
   *
   * @param sessionId - the session the panel is showing.
   * @returns the mode the session would run under.
   */
  public capabilityFor(sessionId?: string): SandboxCapabilityInfo {
    return {
      effectiveMode:
        this.effectiveModeFor(sessionId) ??
        this.service?.defaultMode ??
        'workspace-write',
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
    const policy = this.service
    if (!policy) return undefined
    const session = sessionId
      ? (this.trackedSession(sessionId) ?? this.sessionById(sessionId))
      : undefined
    if (!session) return policy.defaultMode
    try {
      return policy.overrideOf(session) ?? policy.defaultMode
    } catch {
      return policy.defaultMode
    }
  }

  /** The live Session with this id, from the host's own registry. */
  private sessionById(sessionId: string): Session | undefined {
    return (
      this.ctx.get('sessions') as
        { get?: (id: string) => Session | undefined } | undefined
    )?.get?.(sessionId)
  }

  /** Configured entries dropped at the last installation for one session. */
  public skippedFor(sessionId?: string): SandboxSkippedEntry[] {
    if (!sessionId) return []
    const session = this.trackedSession(sessionId)
    if (!session) return []
    return this.grants.get(session)?.skipped ?? []
  }

  /** Re-apply grants for every live Session after a settings change. */
  public notifyPolicyChanged(): Promise<void> {
    return this.applyToLiveSessions()
  }

  /**
   * Re-apply grants for every live Session.
   *
   * Reads `ctx.sessions` rather than {@link tracked} so a Session that was
   * skipped earlier — created before the policy service activated, or before
   * this plugin mounted at all — is picked up instead of staying unenforced
   * forever. The store hands back the same Session objects its callers pass to
   * `resolve()`, which is the key the host registers against.
   */
  private async applyToLiveSessions(): Promise<void> {
    const sessions = this.ctx.get('sessions') as
      { list?: () => Session[] } | undefined
    if (typeof sessions?.list !== 'function') return
    for (const session of sessions.list()) {
      const workspaceRoot = session.header.cwd ?? process.cwd()
      try {
        await this.applyForSession(session, workspaceRoot)
      } catch {
        // One Session's resolution failing must not strand the others.
      }
    }
  }

  /**
   * Contribute the granted directories to the model's runtime context.
   *
   * Registered as its OWN context entry immediately after the host's
   * `sandbox:policy` rather than by editing that text: the host's section is
   * written by `@deepseek-ai/dsh-sandbox-policy` and is not ours to reword. The
   * host already names the granted paths; this entry adds the one thing it
   * cannot know, which is what each directory is FOR.
   */
  private registerPromptSection(): void {
    this.ctx.inject(['systemPrompt'], (scope: Context) => {
      const systemPrompt = scope.get('systemPrompt') as SystemPromptService
      if (!systemPrompt) return

      const order = systemPrompt.getContextOrder('SANDBOX_POLICY') + 1

      scope.effect(() => {
        const dispose = systemPrompt.context({
          name: 'session-settings:sandbox-allow',
          order,
          text: (context) => {
            const session = context?.agent?.session
            if (!session) return ''
            // Synchronous by contract: everything needed was resolved when the
            // grants were installed, so this reads a snapshot and does no I/O.
            const grants = this.grants.get(session)
            return grants ? renderAllowContext(grants.described) : ''
          },
        })
        return () => dispose()
      }, 'session-settings: sandbox allow context')
    })
  }
}

/** Whether two path sets hold the same directories. */
function samePathSet(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false
  for (const value of left) if (!right.has(value)) return false
  return true
}

/**
 * Render the granted-directory paragraph.
 *
 * The host's own `sandbox:policy` entry already lists the paths — that list is
 * derived from the policy, which now includes these registrations. Repeating the
 * paths here would say the same thing twice in one runtime-context snapshot, so
 * this entry carries only the purpose text, which the host cannot know.
 *
 * @param roots - resolved, registered directories that have a description.
 * @returns the context text, or an empty string when there is nothing to say.
 */
export function renderAllowContext(
  roots: readonly ResolvedAllowRoot[],
): string {
  const described = roots.filter((root) => root.description)
  if (described.length === 0) return ''
  const lines = described.map(
    (root) => `- ${JSON.stringify(root.path)} — ${root.description}`,
  )
  return [
    'The session is additionally allowed to write these directories outside the session workspace, for the purposes stated:',
    ...lines,
  ].join('\n')
}

/**
 * Wire the sandbox allow-list onto the runtime.
 *
 * @param ctx - the plugin context.
 * @param getSessionSettingsStore - lazily loaded settings store accessor.
 * @returns the interceptor, so callers can re-apply after a save.
 */
export function registerSandboxInterceptor(
  ctx: Context,
  getSessionSettingsStore: () => SessionSettingsStore,
): SandboxInterceptor {
  const interceptor = new SandboxInterceptor(ctx, getSessionSettingsStore)
  interceptor.start()

  // Install grants when an Agent appears. This is the authoritative point: a
  // resumed Session gets a NEW Session object, and the host keys registrations
  // by object, so re-registering here is what makes grants survive a resume.
  // `agent/created` is serial and holds queued input until listeners settle, so
  // the grants exist before the Agent's first confined call.
  ctx.on('agent/created', async ({ agent }: { agent: Agent }) => {
    try {
      const workspaceRoot = agent.session.header.cwd ?? process.cwd()
      await interceptor.applyForSession(agent.session, workspaceRoot)
    } catch {
      // A resolution problem must never fail agent creation; the next settings
      // change or assembly retries.
    }
  })

  // End the grants with the Agent. The host's effect would unwind anyway, but
  // relying on that leaves `skippedFor` reporting against a disposed Session.
  ctx.on('agent/disposed', ({ agent }: { agent: Agent }) => {
    interceptor.releaseSession(agent.session)
  })

  ctx.effect(
    () => () => interceptor.releaseAll(),
    'session-settings: sandbox allow interceptor',
  )
  return interceptor
}
