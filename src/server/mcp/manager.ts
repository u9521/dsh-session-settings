import type { Context, Fiber, Plugin } from '@deepseek-ai/cordis'
import type {
  GlobalMcpServerConfig,
  McpServerStore,
  SessionSettingsStore,
} from '../../types.ts'
import { publicToolName } from './naming.ts'

export interface ToolMeta {
  serverId: string
  rawName: string
}

let cachedOfficialPlugin: Plugin | null = null

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
   * Check if an MCP server is currently needed (enabled by default or enabled in any active session).
   */
  public isServerNeeded(serverId: string): boolean {
    const store = this.getMcpStore()
    const server = store.servers[serverId]
    if (!server) return false

    // 1. Is it enabled by default in global server settings?
    if (server.enabledByDefault) return true

    // 2. Is it enabled in session settings?
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
   * Mount official @deepseek-ai/dsh-mcp-client plugin instance dynamically in memory.
   */
  public async mountOfficialClient(
    server: GlobalMcpServerConfig,
    officialPlugin: Plugin,
  ): Promise<boolean> {
    this.unmountOfficialClient(server.id)

    const baseConfig = {
      serverName: server.id,
      toolCallTimeoutMs: server.toolCallTimeoutMs ?? 60000,
      failOnStartupError: Boolean(server.failOnStartupError),
      reconnect: {
        enabled: server.reconnect?.enabled ?? true,
        initialDelayMs: server.reconnect?.initialDelayMs ?? 500,
        maxDelayMs: server.reconnect?.maxDelayMs ?? 30000,
        maxAttempts: server.reconnect?.maxAttempts ?? 10,
      },
    }

    const officialConfig =
      server.transport === 'stdio'
        ? {
            ...baseConfig,
            transport: 'stdio' as const,
            command: server.command ?? '',
            args: server.args ?? [],
            env: server.env ?? {},
            cwd: server.cwd ?? '',
          }
        : {
            ...baseConfig,
            transport: 'streamable-http' as const,
            url: server.url ?? '',
            headers: server.headers ?? {},
          }

    try {
      const fork = this.ctx.plugin(officialPlugin, officialConfig)
      this.officialForks.set(server.id, fork)

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

      return true
    } catch (err: unknown) {
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
   */
  public unmountOfficialClient(serverId: string): void {
    const fork = this.officialForks.get(serverId)
    if (fork) {
      try {
        fork.dispose()
      } catch {}
      this.officialForks.delete(serverId)
    }

    const existingNames = this.serverToolMap.get(serverId)
    if (existingNames) {
      for (const pubName of existingNames) {
        this.toolMeta.delete(pubName)
      }
      this.serverToolMap.delete(serverId)
    }
  }

  /**
   * Ensure all servers in the given list are mounted on-demand.
   */
  public async ensureServersMounted(serverIds: string[]): Promise<void> {
    if (!Array.isArray(serverIds) || serverIds.length === 0) return
    const store = this.getMcpStore()
    const pending = serverIds
      .filter((id) => !this.officialForks.has(id))
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
      this.unmountOfficialClient(server.id)
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
        this.unmountOfficialClient(serverId)
      }
    }

    // Sync needed servers
    for (const server of allServers) {
      if (this.isServerNeeded(server.id)) {
        this.syncServer(server).catch(() => {})
      } else {
        this.unmountOfficialClient(server.id)
      }
    }
  }

  /**
   * Teardown and unmount all official client forks on plugin unload.
   */
  public dispose(): void {
    for (const fork of this.officialForks.values()) {
      try {
        fork.dispose()
      } catch {}
    }
    this.officialForks.clear()
    this.toolMeta.clear()
    this.serverToolMap.clear()
  }
}
