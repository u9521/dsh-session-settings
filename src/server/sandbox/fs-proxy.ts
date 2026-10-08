import type { Context } from '@deepseek-ai/cordis'
import type {
  FileSystemLike,
  FsSandboxPolicyLike,
  FsTargetLike,
} from '../../types.ts'
import type { SandboxInterceptor } from './interceptor.ts'
import type { ResolvedAllowRoot } from './paths.ts'

/**
 * Extending the sandbox allow-list to the `write` / `edit` tools.
 *
 * ## Why this is needed at all
 *
 * `ctx.sandbox.confine()` governs SUBPROCESSES (bash, the terminal). The
 * `write` and `edit` tools never spawn anything — they call `ctx.fs`, whose
 * sandboxing implementation fences mutations against `writableRoots(policy)`,
 * a derivation that knows nothing about this plugin's extra directories. Without
 * this proxy a configured directory would be writable by `bash` and refused by
 * `write`, which is precisely the asymmetry the shared `writableRoots` helper
 * exists to prevent on the host side.
 *
 * ## How it re-fences
 *
 * `tool-fs` passes the calling session's complete policy to `writeText` /
 * `editText` (the `sandboxPolicy` tail argument), so this proxy receives the
 * same `sessionId` the `confine` wrapper does and resolves the SAME cached root
 * list — one resolution path, so the two enforcement sides cannot disagree.
 *
 * For a target that lands under one of those roots the proxy delegates to the
 * UNFENCED implementation, because the host's fence is guaranteed to refuse it
 * (the extra root is by construction not in `writableRoots`). Everything else —
 * including every refusal under `read-only`, and every ordinary in-workspace
 * write — is passed straight through, so the host's own decisions are
 * untouched.
 *
 * The unfenced implementation is the provider's inherited `writeText` /
 * `editText`, found one step up the prototype chain (`SandboxedFileSystem
 * extends LocalFileSystem`). It is the host's own atomic write — lock, version
 * guard, staleness check — so this module re-implements no storage mechanics.
 * If that lookup fails the proxy delegates to the host WITH the policy, which
 * means the extra root is refused rather than silently written: the failure
 * mode is the previous behavior, never a loosened boundary.
 *
 * @module session-settings/sandbox/fs-proxy
 */

/** The two mutation methods this proxy re-fences. */
type MutationName = 'writeText' | 'editText'

/**
 * The provider's own un-fenced mutation implementations.
 *
 * Read off the prototype chain rather than from an imported class, so this
 * works against any sandboxing provider that follows the documented layering
 * (`SandboxedFileSystem extends LocalFileSystem`) without this plugin taking a
 * dependency on either package.
 */
interface UnfencedMutations {
  writeText?: (...args: unknown[]) => Promise<unknown>
  editText?: (...args: unknown[]) => Promise<unknown>
}

/**
 * Find the mutation implementations that skip the sandbox fence.
 *
 * The fenced provider declares both methods on its own prototype; the next
 * prototype up is the plain local implementation. Only a method that actually
 * differs from the fenced one is accepted, so a provider that does NOT layer
 * (and therefore has no unfenced variant) reports nothing instead of handing
 * back the same fenced function under a different name.
 *
 * @param fs - the mounted filesystem provider.
 * @returns whichever unfenced mutations exist.
 */
function findUnfencedMutations(fs: FileSystemLike): UnfencedMutations {
  const own = Object.getPrototypeOf(fs) as Record<string, unknown> | null
  const parent = own
    ? (Object.getPrototypeOf(own) as Record<string, unknown> | null)
    : null
  if (!own || !parent) return {}

  const found: UnfencedMutations = {}
  for (const name of ['writeText', 'editText'] as const) {
    const fenced = own[name]
    const unfenced = parent[name]
    if (typeof unfenced === 'function' && unfenced !== fenced) {
      found[name] = unfenced as (...args: unknown[]) => Promise<unknown>
    }
  }
  return found
}

/** One mutation's wrapper, bound to the interceptor's resolved roots. */
export class SandboxFsProxy {
  private readonly ctx: Context
  private readonly interceptor: SandboxInterceptor

  /** The provider whose methods were replaced; the restore target. */
  private patchedFs: FileSystemLike | undefined
  /** Installed wrappers, retained by identity for the restore check. */
  private readonly wrappers = new Map<
    MutationName,
    (...args: never[]) => Promise<unknown>
  >()
  /** Whether the unfenced implementations were found (reported once). */
  private unfencedAvailable = false

  constructor(ctx: Context, interceptor: SandboxInterceptor) {
    this.ctx = ctx
    this.interceptor = interceptor
  }

  /**
   * Install the two mutation wrappers.
   *
   * Deferred through `ctx.inject(['fs'], …)` for the same reason the `confine`
   * wrapper is: this plugin's `apply` runs before the composition's rows have
   * necessarily activated, so a synchronous `ctx.get('fs')` here would find
   * nothing. See {@link SandboxInterceptor.start}.
   */
  public start(): void {
    this.ctx.inject(['fs'], (scope: Context) => {
      const fs = scope.get('fs') as FileSystemLike | undefined
      if (!fs || typeof fs.writeText !== 'function') return

      const unfenced = findUnfencedMutations(fs)
      this.unfencedAvailable =
        typeof unfenced.writeText === 'function' ||
        typeof unfenced.editText === 'function'
      this.patchedFs = fs

      for (const name of ['writeText', 'editText'] as const) {
        const original = fs[name].bind(fs) as (
          ...args: never[]
        ) => Promise<unknown>
        const wrapper = ((...args: unknown[]) =>
          this.mutate(name, original, unfenced, args)) as (
          ...args: never[]
        ) => Promise<unknown>
        this.wrappers.set(name, wrapper)
        ;(fs as unknown as Record<string, unknown>)[name] = wrapper
      }

      scope.effect(
        () => () => this.restore(),
        'session-settings: sandbox fs proxy',
      )
    })
  }

  /** Whether the unfenced delegation target was found (for diagnostics). */
  public get canBypassFence(): boolean {
    return this.unfencedAvailable
  }

  /**
   * Re-fence one mutation.
   *
   * The decision logic is separated from the acting logic on purpose: only
   * DECIDING whether to lift the fence is guarded, and a failure there falls
   * back to the host (the behavior this proxy replaced, so the host's own
   * refusal is the worst case). The delegated write itself is NOT inside that
   * guard — an error it raises is the host's legitimate verdict
   * (`FS_STALE_VERSION`, `FS_NOT_REGULAR_FILE`, an abort) and must reach the
   * caller intact rather than being rewritten into a policy denial.
   */
  private async mutate(
    name: MutationName,
    original: (...args: never[]) => Promise<unknown>,
    unfenced: UnfencedMutations,
    args: unknown[],
  ): Promise<unknown> {
    // `writeText(target, content, expected, signal, policy)`: only the target
    // and the policy are read here; every argument is forwarded untouched.
    const target = args[0] as FsTargetLike | undefined
    const policy = args[4] as FsSandboxPolicyLike | undefined

    // Nothing to add for an agentless call, a widening mode (`danger-full-access`
    // needs no help), or `read-only` — which must keep refusing outright, since
    // extra roots are not a read-only loophole.
    if (!target || !policy || policy.mode !== 'workspace-write') {
      return original(...(args as never[]))
    }

    let delegate: ((...args: unknown[]) => Promise<unknown>) | undefined
    try {
      const roots = await this.interceptor.rootsFor(policy)
      if (roots.length > 0 && (await this.matchRoot(roots, target))) {
        const candidate = unfenced[name]
        if (typeof candidate === 'function') delegate = candidate
      }
    } catch (error) {
      // A broken lookup must only ever restore the host's own decision.
      console.warn(
        '[session-settings] [SANDBOX-ALLOW] Filesystem allow-list check failed; deferring to the host fence:',
        error instanceof Error ? error.message : String(error),
      )
    }

    if (!delegate) {
      // Either the target is not granted, or no unfenced implementation exists
      // to borrow — both keep the host's own fence.
      return original(...(args as never[]))
    }

    // Call the provider's plain implementation with the SAME arguments. The
    // policy stays in the tail position for signature compatibility; the plain
    // implementation ignores it, which is exactly what lifts the fence.
    return delegate.apply(this.patchedFs, args)
  }

  /**
   * Whether the target sits under any granted root.
   *
   * Containment is asked of the provider (`contains`) instead of comparing
   * strings, so the answer stays correct on a case-insensitive or alias-bearing
   * host filesystem, and for backends whose `displayPath` is not a host path.
   * A root that cannot be resolved (a directory removed since the settings were
   * read) simply does not match.
   *
   * @param roots - the session's resolved extra directories.
   * @param target - the resolved mutation target.
   * @returns the matching root, or undefined.
   */
  private async matchRoot(
    roots: readonly ResolvedAllowRoot[],
    target: FsTargetLike,
  ): Promise<ResolvedAllowRoot | undefined> {
    const fs = this.patchedFs
    if (!fs) return undefined
    for (const root of roots) {
      let parent: FsTargetLike
      try {
        parent = await fs.resolve(root.path)
      } catch {
        continue
      }
      try {
        if (fs.contains(parent, target)) return root
      } catch {
        // A provider that cannot answer containment for these targets is not
        // evidence of a match; skip the root.
        continue
      }
    }
    return undefined
  }

  /**
   * Remove this proxy's wrappers.
   *
   * Unconditional once a patch was installed, for the same reason the
   * `confine` restore is: `ctx.get('fs')` yields a traced Proxy whose function
   * reads produce a fresh shadow wrapper each time, so "is the live method
   * still ours?" cannot be decided by comparison. The recorded wrappers serve
   * only as the signal that a patch exists to remove.
   */
  public restore(): void {
    const fs = this.patchedFs
    if (fs && this.wrappers.size > 0) {
      for (const name of ['writeText', 'editText'] as const) {
        delete (fs as unknown as Record<string, unknown>)[name]
      }
    }
    this.wrappers.clear()
    this.patchedFs = undefined
  }
}
