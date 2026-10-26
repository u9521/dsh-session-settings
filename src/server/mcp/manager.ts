import type { Context, Fiber, Plugin } from '@deepseek-ai/cordis'
import type {
  GlobalMcpServerConfig,
  McpServerRuntimeStatus,
  McpServerStore,
  SessionSettingsStore,
} from '../../types.ts'
import { publicToolName } from './naming.ts'

export interface ToolMeta {
  serverId: string
  rawName: string
}

/** Outcome of a manual official-client remount, composed into the refresh response. */
export interface McpRefreshOutcome {
  /** True when the official client fork was actually remounted (not only torn down). */
  remounted: boolean
  /**
   * False when the rebuild happened but the fork is still finishing its
   * handshake inside the settle budget. The connection is then live but its
   * tools are not registered yet — a "still starting", not a failure.
   */
  settled: boolean
  /** Runtime status read after the remount settled. */
  status: McpServerRuntimeStatus
  /** Wall-clock duration of teardown + remount + settle. */
  durationMs: number
}

/** Minimal view of the ctx.tools registry needed for a registration probe. */
interface ToolRegistryProbe {
  schemas?: () => Array<{ name?: unknown }> | undefined
}

/** How often the remount path re-reads the tool registry while it settles. */
const MCP_TOOL_POLL_INTERVAL_MS = 100

const OFFICIAL_PLUGIN_MISSING =
  'Official @deepseek-ai/dsh-mcp-client plugin is not available in this Host.'

let cachedOfficialPlugin: Plugin | null = null

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms) as ReturnType<typeof setTimeout> & {
      unref?: () => void
    }
    if (typeof timer.unref === 'function') timer.unref()
  })
}

/**
 * Resolve the official @deepseek-ai/dsh-mcp-client Cordis plugin module directly via ctx.loader.
 */
async function loadOfficialMcpClientPlugin(
  ctx: Context,
): Promise<Plugin | null> {
  if (cachedOfficialPlugin) return cachedOfficialPlugin

  const loader =
    (
      ctx as {
        loader?: {
          import?: (name: string) => Promise<unknown>
          unwrapExports?: (exports: unknown) => unknown
        }
      }
    ).loader ?? (typeof ctx.get === 'function' ? ctx.get('loader') : undefined)

  if (!loader) {
    console.warn(
      '[session-settings] [MCP-LOADER] Cordis loader service is not available on context.',
      {
        hasCtx: Boolean(ctx),
        availableServices:
          typeof (ctx as { reflect?: { store?: Record<string, unknown> } })
            .reflect?.store === 'object'
            ? Object.keys(
                (ctx as { reflect?: { store?: Record<string, unknown> } })
                  .reflect?.store ?? {},
              )
            : undefined,
      },
    )
    return null
  }

  if (typeof loader.import !== 'function') {
    console.warn(
      '[session-settings] [MCP-LOADER] Loader service exists but does not have .import() method.',
      {
        loaderType: typeof loader,
        loaderKeys: Object.keys(loader),
      },
    )
    return null
  }

  try {
    const raw = await loader.import('@deepseek-ai/dsh-mcp-client')
    const mod = (
      typeof loader.unwrapExports === 'function'
        ? loader.unwrapExports(raw)
        : raw
    ) as Plugin | null
    if (
      mod &&
      (typeof mod === 'function' ||
        typeof (mod as { apply?: unknown }).apply === 'function')
    ) {
      cachedOfficialPlugin = mod
      return mod
    } else {
      console.warn(
        '[session-settings] [MCP-LOADER] Imported @deepseek-ai/dsh-mcp-client, but module shape does not match Cordis Plugin:',
        {
          rawType: typeof raw,
          rawKeys:
            raw && typeof raw === 'object' ? Object.keys(raw) : undefined,
          modType: typeof mod,
          modKeys:
            mod && typeof mod === 'object' ? Object.keys(mod) : undefined,
        },
      )
    }
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err))
    console.warn(
      '[session-settings] [MCP-LOADER] Failed to import @deepseek-ai/dsh-mcp-client via loader:',
      {
        name: errorObj.name,
        message: errorObj.message,
        code: (errorObj as { code?: string }).code,
        stack: errorObj.stack,
        baseUrl:
          (ctx as { baseUrl?: string }).baseUrl ??
          (ctx.root as { baseUrl?: string })?.baseUrl,
      },
    )
  }

  return null
}

export class McpManager {
  private ctx: Context
  private getMcpStore: () => McpServerStore
  private getSessionSettingsStore?: () => SessionSettingsStore

  /** Map of serverId -> active Cordis Plugin Fork instance of @deepseek-ai/dsh-mcp-client */
  private officialForks = new Map<string, Fiber>()

  /** Map of publicToolName -> { serverId, rawName } metadata */
  private toolMeta = new Map<string, ToolMeta>()

  /** Map of serverId -> Set of publicToolNames registered for that server */
  private serverToolMap = new Map<string, Set<string>>()

  /** Map of serverId -> last activation/mount error message (cleared on refresh/unmount) */
  private lastErrors = new Map<string, string>()

  /** serverIds whose current mount lifecycle we attempted to mount */
  private mountAttempted = new Set<string>()

  /**
   * serverId -> wall clock when the current mount attempt began.
   *
   * Runtime status is a TRANSIENT observation: a freshly started fork reports
   * zero tools until its handshake completes, which is indistinguishable from a
   * permanent failure without knowing how long it has been that way.
   */
  private mountStartedAt = new Map<string, number>()

  /**
   * serverId -> fingerprint of the config the live fork was mounted with.
   *
   * Lets `syncServer()` skip a teardown+remount when nothing that affects the
   * connection actually changed; a settings save used to rebuild every live
   * connection even when it touched no server config at all.
   */
  private mountedConfigKeys = new Map<string, string>()

  /** Map of serverId -> timestamp of the last manual client refresh */
  private lastRefreshAt = new Map<string, number>()

  /** Active sync promises to prevent race conditions */
  private activeSyncs = new Map<string, Promise<void>>()

  constructor(
    ctx: Context,
    getMcpStore: () => McpServerStore,
    getSessionSettingsStore?: () => SessionSettingsStore,
  ) {
    this.ctx = ctx
    this.getMcpStore = getMcpStore
    this.getSessionSettingsStore = getSessionSettingsStore
  }

  /**
   * Check if an MCP server is currently needed.
   *
   * "Needed" means some scope's explicit `enabledServerIds` names it. There is
   * deliberately no per-server default flag: such a flag could only ever drive
   * mounting, since visibility is resolved from the scope lists, and a server
   * that is connected but visible nowhere is pure cost.
   */
  public isServerNeeded(serverId: string): boolean {
    const store = this.getMcpStore()
    const server = store.servers[serverId]
    if (!server) return false

    const sessionSettingsStore = this.getSessionSettingsStore?.()
    if (sessionSettingsStore) {
      if (
        sessionSettingsStore.globalConfig?.mcp?.enabledServerIds?.includes(
          serverId,
        )
      ) {
        return true
      }

      if (sessionSettingsStore.workspaces) {
        for (const wsConfig of Object.values(sessionSettingsStore.workspaces)) {
          if (
            wsConfig?.mcp?.mode === 'custom' &&
            wsConfig.mcp.enabledServerIds?.includes(serverId)
          ) {
            return true
          }
        }
      }

      if (sessionSettingsStore.sessions) {
        for (const sessionConfig of Object.values(
          sessionSettingsStore.sessions,
        )) {
          if (
            sessionConfig.mcp?.mode === 'custom' &&
            sessionConfig.mcp.enabledServerIds?.includes(serverId)
          ) {
            return true
          }
        }
      }
    }

    return false
  }

  /**
   * Get metadata for a public tool name.
   */
  public getToolMeta(publicName: string): ToolMeta | undefined {
    return this.toolMeta.get(publicName)
  }

  /**
   * Check if a tool is an MCP tool managed by this plugin.
   */
  public isMcpTool(publicName: string): boolean {
    return this.toolMeta.has(publicName) || publicName.startsWith('mcp__')
  }

  /**
   * The exact config object handed to the official client.
   *
   * The single source for BOTH the fork's config and its fingerprint, so the
   * two cannot drift: a field added here is automatically part of the identity
   * that decides whether a remount is needed.
   */
  private mountConfigOf(
    server: GlobalMcpServerConfig,
  ): Record<string, unknown> {
    const baseConfig = {
      serverName: server.id,
      toolCallTimeoutMs: server.toolCallTimeoutMs ?? 60000,
      failOnStartupError: Boolean(server.failOnStartupError),
      ...(server.maxInstructionBytes !== undefined
        ? { maxInstructionBytes: server.maxInstructionBytes }
        : {}),
      reconnect: {
        enabled: server.reconnect?.enabled ?? true,
        initialDelayMs: server.reconnect?.initialDelayMs ?? 500,
        maxDelayMs: server.reconnect?.maxDelayMs ?? 30000,
        maxAttempts: server.reconnect?.maxAttempts ?? 10,
      },
    }

    return server.transport === 'stdio'
      ? {
          ...baseConfig,
          transport: 'stdio',
          command: server.command ?? '',
          args: server.args ?? [],
          env: server.env ?? {},
          cwd: server.cwd ?? '',
        }
      : {
          ...baseConfig,
          transport: 'streamable-http',
          url: server.url ?? '',
          headers: server.headers ?? {},
        }
  }

  /**
   * Key-order-independent serialization for config comparison.
   *
   * `JSON.stringify` alone would report a change whenever the form re-submits
   * the same `env`/`headers` entries in a different order, causing a remount
   * that changes nothing.
   */
  private canonical(value: unknown): string {
    if (value === null || typeof value !== 'object')
      return JSON.stringify(value)
    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.canonical(entry)).join(',')}]`
    }
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${this.canonical(entry)}`)
    return `{${entries.join(',')}}`
  }

  /**
   * Mount official @deepseek-ai/dsh-mcp-client plugin instance dynamically in memory.
   */
  public async mountOfficialClient(
    server: GlobalMcpServerConfig,
    officialPlugin: Plugin,
    opts: { settleMs?: number } = {},
  ): Promise<boolean> {
    await this.unmountOfficialClient(server.id)

    const officialConfig = this.mountConfigOf(server)

    try {
      const fork = this.ctx.plugin(officialPlugin, officialConfig)
      this.officialForks.set(server.id, fork)
      this.mountAttempted.add(server.id)
      this.mountStartedAt.set(server.id, Date.now())
      this.mountedConfigKeys.set(server.id, this.canonical(officialConfig))

      // Surface activation errors (invalid config, startup rejection, ...).
      // NOTE: the official bridge retries plain connection failures internally and
      // does NOT reject await(), so this only covers activation-time problems.
      let settled: Promise<void>
      try {
        settled = Promise.resolve(fork.await()).then(
          () => undefined,
          (err: unknown) => {
            this.recordMountError(server.id, err)
          },
        )
      } catch (err: unknown) {
        this.recordMountError(server.id, err)
        settled = Promise.resolve()
      }

      // Index tool names for fast session interception
      if (Array.isArray(server.toolDetails)) {
        const names = new Set<string>()
        for (const t of server.toolDetails) {
          const pub = publicToolName(server.id, t.name)
          this.toolMeta.set(pub, { serverId: server.id, rawName: t.name })
          names.add(pub)
        }
        this.serverToolMap.set(server.id, names)
      }

      // Manual refresh waits (bounded) for activation, so an activation-time
      // rejection is already recorded when the caller reads the status. Lazy
      // mounts pass 0 and stay non-blocking.
      //
      // NOTE: activation is not the handshake. fork.await() resolves once the
      // plugin is applied, which is well before tools/list returns, so the
      // tool count has to be polled separately — see waitForTools().
      const settleMs = opts.settleMs ?? 0
      if (settleMs > 0) {
        await Promise.race([settled, delay(settleMs)])
      }

      return true
    } catch (err: unknown) {
      this.recordMountError(server.id, err)
      console.error(
        `[session-settings] [MCP-MOUNT] Failed to mount official mcp-client for server "${server.name || server.id}" (${server.id}):`,
        {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          config: {
            serverName: server.id,
            transport: server.transport,
            endpoint:
              server.transport === 'stdio' ? server.command : server.url,
          },
        },
      )
      return false
    }
  }

  /**
   * Unmount official mcp-client fork for a server.
   *
   * The map entry is removed before awaiting dispose() so `isMounted()` turns
   * false immediately; awaiting dispose() makes sure the Cordis fiber has
   * released the `serverName` reservation before a remount reuses it.
   *
   * Unmounting also resets the inferred status ("unknown" instead of "failed").
   */
  public async unmountOfficialClient(serverId: string): Promise<void> {
    const fork = this.officialForks.get(serverId)
    this.officialForks.delete(serverId)

    const existingNames = this.serverToolMap.get(serverId)
    if (existingNames) {
      for (const pubName of existingNames) {
        this.toolMeta.delete(pubName)
      }
      this.serverToolMap.delete(serverId)
    }

    this.lastErrors.delete(serverId)
    this.mountAttempted.delete(serverId)
    this.mountStartedAt.delete(serverId)
    this.mountedConfigKeys.delete(serverId)

    if (!fork) return
    try {
      await fork.dispose()
    } catch (err: unknown) {
      console.warn(
        `[session-settings] [MCP-UNMOUNT] Error while disposing official mcp-client fork for "${serverId}":`,
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  /**
   * True while a non-disposed Cordis fork exists for the server.
   *
   * Do NOT use `officialForks.has()` instead: after the official bridge gives up
   * it unregisters every tool but keeps the fiber alive, so the map entry
   * survives a permanent failure.
   */
  public isMounted(serverId: string): boolean {
    const fork = this.officialForks.get(serverId)
    return Boolean(fork && fork.uid !== null)
  }

  /**
   * Snapshot of every tool name currently registered on ctx.tools.
   *
   * `tools.schemas()` is presentation-agnostic and restriction-aware, which is
   * exactly what a registration probe needs.
   */
  public collectRegisteredToolNames(): Set<string> {
    const names = new Set<string>()
    try {
      const registry =
        typeof this.ctx.get === 'function'
          ? (this.ctx.get('tools') as ToolRegistryProbe | undefined)
          : undefined
      const schemas = registry?.schemas?.()
      if (Array.isArray(schemas)) {
        for (const schema of schemas) {
          if (schema && typeof schema.name === 'string') {
            names.add(schema.name)
          }
        }
      }
    } catch {
      // Tools service unavailable (e.g. plugin unloading) — report an empty registry.
    }
    return names
  }

  /**
   * Inferred runtime status of the official client for one server.
   *
   * Pass a pre-collected `registeredNames` set when computing status for many
   * servers at once to avoid re-walking the registry per server.
   */
  public getServerStatus(
    serverId: string,
    registeredNames?: Set<string>,
  ): McpServerRuntimeStatus {
    const names = registeredNames ?? this.collectRegisteredToolNames()
    const prefix = `mcp__${serverId}__`
    let registeredToolCount = 0
    for (const name of names) {
      if (name.startsWith(prefix)) registeredToolCount++
    }

    const status: McpServerRuntimeStatus = {
      mountAttempted: this.mountAttempted.has(serverId),
      mounted: this.isMounted(serverId),
      registeredToolCount,
    }

    const mountStartedAt = this.mountStartedAt.get(serverId)
    if (mountStartedAt !== undefined) status.mountStartedAt = mountStartedAt

    const lastError = this.lastErrors.get(serverId)
    if (lastError) status.lastError = lastError
    const lastRefreshAt = this.lastRefreshAt.get(serverId)
    if (lastRefreshAt) status.lastRefreshAt = lastRefreshAt

    return status
  }

  /**
   * Tear down and remount the official client for a server, resetting the
   * bridge's reconnect budget — the only way to recover from "giving up after N
   * consecutive failed reconnect attempts", and the only way to replace a
   * streamable-HTTP session id the server has already forgotten (the SDK keeps
   * that id private, and the Host bridge never calls `terminateSession()`).
   *
   * Always rebuilds. The caller is an explicit user action, so there is nothing
   * left to second-guess: the former `force` flag existed to bypass the
   * "is this server enabled anywhere?" gate for a draft toggle that had not been
   * saved yet, and every path that could have needed it now asks for a remount
   * only from a card that is already enabled. A gate here would silently skip
   * the rebuild and report the untouched status as if it had run.
   *
   * Serialized against in-flight syncs for the same server.
   */
  public async refreshServer(
    server: GlobalMcpServerConfig,
    opts: { settleMs?: number } = {},
  ): Promise<McpRefreshOutcome> {
    const serverId = server.id
    const startedAt = Date.now()

    // Join any in-flight sync for this server before tearing it down again.
    const inFlight = this.activeSyncs.get(serverId)
    if (inFlight) {
      try {
        await inFlight
      } catch {}
    }

    const run = (async (): Promise<McpRefreshOutcome> => {
      this.lastErrors.delete(serverId)
      await this.unmountOfficialClient(serverId)

      let remounted = false
      let settled = false
      const liveServer = this.getMcpStore().servers[serverId] ?? server
      const officialPlugin = await loadOfficialMcpClientPlugin(this.ctx)
      if (officialPlugin) {
        remounted = await this.mountOfficialClient(liveServer, officialPlugin, {
          settleMs: opts.settleMs ?? 0,
        })
        // Activation does not wait for the handshake, so the tool count is
        // polled with its own budget: mounting already spent part of the wall
        // clock, and the caller's bound covers the whole remount.
        const remaining = (opts.settleMs ?? 0) - (Date.now() - startedAt)
        if (remounted && remaining > 0) {
          settled = await this.waitForTools(serverId, remaining)
        }
      } else {
        this.recordMountError(serverId, new Error(OFFICIAL_PLUGIN_MISSING))
        console.error(
          `[session-settings] [MCP-REFRESH] ${OFFICIAL_PLUGIN_MISSING} Skipping remount for "${serverId}".`,
        )
      }

      this.lastRefreshAt.set(serverId, Date.now())

      return {
        remounted,
        settled,
        status: this.getServerStatus(serverId),
        durationMs: Date.now() - startedAt,
      }
    })()

    const entry = run.then(
      () => undefined,
      () => undefined,
    )
    this.activeSyncs.set(serverId, entry)

    try {
      return await run
    } finally {
      if (this.activeSyncs.get(serverId) === entry) {
        this.activeSyncs.delete(serverId)
      }
    }
  }

  /**
   * Poll until the rebuilt fork has registered at least one tool, or the
   * budget runs out.
   *
   * The bridge exposes no readiness promise: activation resolves before the
   * handshake, and `registeredToolCount` on ctx.tools is the only observable
   * that moves when tools/list comes back. A server that legitimately exposes
   * no tools (resources-only) never settles, which is why the caller treats
   * 'settled' as 'registered something', not as 'is healthy'.
   *
   * @returns whether tools appeared inside the budget.
   */
  private async waitForTools(
    serverId: string,
    budgetMs: number,
  ): Promise<boolean> {
    const deadline = Date.now() + budgetMs
    for (;;) {
      if (this.getServerStatus(serverId).registeredToolCount > 0) return true
      // A recorded error is final: stop waiting and report it.
      if (this.lastErrors.has(serverId)) return false
      const remaining = deadline - Date.now()
      if (remaining <= 0) return false
      await delay(Math.min(MCP_TOOL_POLL_INTERVAL_MS, remaining))
    }
  }

  /** Record a mount/activation failure for status reporting. */
  private recordMountError(serverId: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err)
    this.lastErrors.set(serverId, message)
    console.warn(
      `[session-settings] [MCP-MOUNT] Official mcp-client activation failed for "${serverId}": ${message}`,
    )
  }

  /**
   * Ensure all servers in the given list are mounted on-demand.
   */
  public async ensureServersMounted(serverIds: string[]): Promise<void> {
    if (!Array.isArray(serverIds) || serverIds.length === 0) return
    const store = this.getMcpStore()
    const pending = serverIds
      .filter((id) => !this.isMounted(id))
      .map((id) => store.servers[id])
      .filter((s): s is GlobalMcpServerConfig => Boolean(s))

    if (pending.length === 0) return
    await Promise.all(pending.map((server) => this.syncServer(server)))
  }

  /**
   * Synchronize tool registrations for a single server by mounting/unmounting official client fork.
   */
  public async syncServer(server: GlobalMcpServerConfig): Promise<void> {
    if (!server || !server.id) return

    // If server is not needed (neither enabled by default nor in any active session), ensure it is unmounted
    if (!this.isServerNeeded(server.id)) {
      await this.unmountOfficialClient(server.id)
      return
    }

    // A live fork carrying the same connection config is already the desired
    // state. Tearing it down and reconnecting would drop working tools (and
    // briefly report zero) for a change that cannot affect the connection.
    if (
      this.isMounted(server.id) &&
      this.mountedConfigKeys.get(server.id) ===
        this.canonical(this.mountConfigOf(server))
    ) {
      return
    }

    if (this.activeSyncs.has(server.id)) {
      return this.activeSyncs.get(server.id)
    }

    const syncPromise = (async () => {
      try {
        const store = this.getMcpStore()
        const liveServer = store.servers[server.id] || server

        // Mount official @deepseek-ai/dsh-mcp-client dynamically
        const officialPlugin = await loadOfficialMcpClientPlugin(this.ctx)
        if (officialPlugin) {
          await this.mountOfficialClient(liveServer, officialPlugin)
        } else {
          console.error(
            `[session-settings] [MCP-SYNC] Official @deepseek-ai/dsh-mcp-client plugin not found in DSH environment. Skipping mount for server "${server.name || server.id}" (${server.id}).`,
            {
              serverId: server.id,
              serverName: server.name,
              transport: server.transport,
              target:
                server.transport === 'stdio'
                  ? `${server.command} ${(server.args || []).join(' ')}`
                  : server.url,
            },
          )
        }
      } catch (err: unknown) {
        console.error(
          `[session-settings] [MCP-SYNC] Sync failed for MCP server "${server.name || server.id}" (${server.id}):`,
          {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
        )
      } finally {
        this.activeSyncs.delete(server.id)
      }
    })()

    this.activeSyncs.set(server.id, syncPromise)
    return syncPromise
  }

  /**
   * Synchronize all servers in the store.
   */
  public syncAll(): void {
    const store = this.getMcpStore()
    const allServers = Object.values(store.servers)

    // Unmount any servers that were deleted from store or are no longer needed
    for (const serverId of Array.from(this.officialForks.keys())) {
      if (!store.servers[serverId] || !this.isServerNeeded(serverId)) {
        void this.unmountOfficialClient(serverId).catch(() => {})
      }
    }

    // Sync needed servers
    for (const server of allServers) {
      if (this.isServerNeeded(server.id)) {
        this.syncServer(server).catch(() => {})
      } else {
        void this.unmountOfficialClient(server.id).catch(() => {})
      }
    }
  }

  /**
   * Teardown and unmount all official client forks on plugin unload.
   */
  public async dispose(): Promise<void> {
    const forks = Array.from(this.officialForks.values())
    this.officialForks.clear()
    this.toolMeta.clear()
    this.serverToolMap.clear()
    this.lastErrors.clear()
    this.mountAttempted.clear()
    this.mountStartedAt.clear()
    this.mountedConfigKeys.clear()
    this.lastRefreshAt.clear()
    this.activeSyncs.clear()

    await Promise.allSettled(
      forks.map(async (fork) => {
        try {
          await fork.dispose()
        } catch {}
      }),
    )
  }
}
