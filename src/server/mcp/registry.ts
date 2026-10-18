/**
 * The MCP server store's single write path.
 *
 * Every handler used to compose `load → normalize → save → setStore → sync`
 * itself. That produced three defects that only show up in combination:
 *
 * - Two read paths (`getMcpStore()` cache vs `loadMcpStore()` fresh) meant a
 *   mutation's visibility depended on whether a branch remembered to publish
 *   the store it had just written.
 * - Two normalizers meant `import` skipped the id pattern and the reconnect
 *   floor, and dropped the discovery caches the edit path preserves.
 * - `saveMcpStore` swallowed write failures, so a full disk reported success.
 *
 * This module owns the store, the normalizer, persistence, and the
 * invalidation broadcast. Routes only parse a request body and map a result.
 */
import type {
  GlobalMcpServerConfig,
  McpCachedView,
  McpReconnectConfig,
  McpServerRuntimeStatus,
  McpServerStore,
  McpTestResult,
  McpTransportType,
  SessionSettingsStore,
} from '../../types.ts'

import { renameServerIdInSessionStore } from '../session/storage.ts'
import type { McpManager } from './manager.ts'

/** Official `dsh-mcp-client` namespacing contract for `mcp__<serverName>__<tool>`. */
const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

/** A write result: the stored config, or the reason the input was refused. */
export type ServerWriteResult =
  { config: GlobalMcpServerConfig; id: string } | { error: string }

/** One successful probe's discovery, folded into the stored server. */
export type ProbeDiscovery = Pick<
  McpTestResult,
  | 'tools'
  | 'toolDetails'
  | 'resourceDetails'
  | 'resourceTemplateDetails'
  | 'promptDetails'
  | 'capabilities'
  | 'detectedTransport'
  | 'serverInfo'
>

/**
 * Normalize one incoming server payload.
 *
 * The single writer for everything a server config may contain: add, edit, and
 * import all pass through here, so the id grammar and the reconnect floor
 * cannot be enforced on one path and skipped on another.
 *
 * @param incoming - the raw payload.
 * @param existing - the stored record this write replaces, when there is one.
 * @returns the normalized config, or the reason it was refused.
 */
export function normalizeServer(
  incoming: Partial<GlobalMcpServerConfig>,
  existing?: GlobalMcpServerConfig,
): ServerWriteResult {
  const rawId = (typeof incoming.id === 'string' ? incoming.id : '').trim()
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const name = (typeof incoming.name === 'string' ? incoming.name : '').trim()

  if (!id || !name) return { error: 'Server ID and name are required' }

  // The official mcp-client derives model-facing tool names from this id and
  // rejects anything outside the pattern, so refuse it here with a clear
  // message instead of failing later at mount time.
  if (!SERVER_NAME_PATTERN.test(id)) {
    return {
      error: 'Server ID must be 1-32 characters of letters, digits, "_" or "-"',
    }
  }

  const rawTransport = incoming.transport
  const transport: McpTransportType | null =
    rawTransport === 'stdio'
      ? 'stdio'
      : rawTransport === 'streamable-http' ||
          rawTransport === 'streamable-http-or-sse' ||
          rawTransport === 'sse'
        ? 'streamable-http'
        : null

  if (!transport) {
    return { error: 'Valid transport (stdio, streamable-http) is required' }
  }
  if (transport === 'stdio' && !incoming.command?.trim()) {
    return { error: 'Command is required for stdio transport' }
  }
  if (transport !== 'stdio' && !incoming.url?.trim()) {
    return { error: 'URL is required for HTTP/SSE transport' }
  }

  const now = Date.now()
  const toolCallTimeoutMs =
    typeof incoming.toolCallTimeoutMs === 'number' &&
    incoming.toolCallTimeoutMs > 0
      ? Math.floor(incoming.toolCallTimeoutMs)
      : undefined

  const failOnStartupError =
    typeof incoming.failOnStartupError === 'boolean'
      ? incoming.failOnStartupError
      : undefined

  let reconnect: McpReconnectConfig | undefined
  if (incoming.reconnect && typeof incoming.reconnect === 'object') {
    // The official schema requires delays and attempt counts >= 1; "do not
    // retry" is expressed by `enabled: false`, never by a zero budget.
    const atLeastOne = (value: unknown): number | undefined =>
      typeof value === 'number' && Number.isFinite(value)
        ? Math.max(1, Math.floor(value))
        : undefined

    reconnect = {
      enabled:
        typeof incoming.reconnect.enabled === 'boolean'
          ? incoming.reconnect.enabled
          : undefined,
      initialDelayMs: atLeastOne(incoming.reconnect.initialDelayMs),
      maxDelayMs: atLeastOne(incoming.reconnect.maxDelayMs),
      maxAttempts: atLeastOne(incoming.reconnect.maxAttempts),
    }
  }

  const disabledTools = Array.isArray(incoming.disabledTools)
    ? Array.from(
        new Set(
          incoming.disabledTools
            .filter((t): t is string => typeof t === 'string')
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      )
    : existing?.disabledTools

  const config: GlobalMcpServerConfig = {
    id,
    name,
    description: incoming.description?.trim() || undefined,
    transport,
    command: incoming.command?.trim() || undefined,
    args: Array.isArray(incoming.args)
      ? incoming.args.filter((a) => typeof a === 'string')
      : [],
    env:
      incoming.env && typeof incoming.env === 'object'
        ? incoming.env
        : undefined,
    cwd: incoming.cwd?.trim() || undefined,
    url: incoming.url?.trim() || undefined,
    headers:
      incoming.headers && typeof incoming.headers === 'object'
        ? incoming.headers
        : undefined,
    toolCallTimeoutMs: toolCallTimeoutMs ?? existing?.toolCallTimeoutMs,
    failOnStartupError: failOnStartupError ?? existing?.failOnStartupError,
    maxInstructionBytes:
      typeof incoming.maxInstructionBytes === 'number' &&
      incoming.maxInstructionBytes > 0
        ? Math.floor(incoming.maxInstructionBytes)
        : existing?.maxInstructionBytes,
    reconnect: reconnect ?? existing?.reconnect,
    disabledTools:
      Array.isArray(disabledTools) && disabledTools.length > 0
        ? disabledTools
        : undefined,
    tools: Array.isArray(incoming.tools) ? incoming.tools : existing?.tools,
    toolDetails: incoming.toolDetails ?? existing?.toolDetails,
    // Cached discovery lists ride through every edit so a rename or a settings
    // change cannot silently drop them; the panel would otherwise show an empty
    // resource tab until the next probe. Content is never among these.
    resourceDetails: incoming.resourceDetails ?? existing?.resourceDetails,
    resourceTemplateDetails:
      incoming.resourceTemplateDetails ?? existing?.resourceTemplateDetails,
    promptDetails: incoming.promptDetails ?? existing?.promptDetails,
    capabilities: incoming.capabilities ?? existing?.capabilities,
    detectedTransport:
      incoming.detectedTransport ?? existing?.detectedTransport,
    serverInfo: incoming.serverInfo ?? existing?.serverInfo,
    lastTestedAt: incoming.lastTestedAt ?? existing?.lastTestedAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  return { config, id }
}

/** Fold one successful probe's discovery into a stored server. */
function applyProbeResult(
  server: GlobalMcpServerConfig,
  result: ProbeDiscovery,
): void {
  if (result.tools) server.tools = result.tools
  if (result.toolDetails) server.toolDetails = result.toolDetails
  if (result.resourceDetails) server.resourceDetails = result.resourceDetails
  if (result.resourceTemplateDetails) {
    server.resourceTemplateDetails = result.resourceTemplateDetails
  }
  if (result.promptDetails) server.promptDetails = result.promptDetails
  if (result.capabilities) server.capabilities = result.capabilities
  if (result.detectedTransport) {
    server.detectedTransport = result.detectedTransport
  }
  if (result.serverInfo) server.serverInfo = result.serverInfo
  server.lastTestedAt = Date.now()
}

/** Construction inputs the registry needs but does not own. */
export interface McpRegistryDeps {
  /**
   * The process-wide store, lazily loaded by the composition root.
   *
   * Shared with `McpManager`, which answers "is this server wanted" from the
   * same object; a second copy would let a mount decision read state a write
   * has not published yet.
   */
  getStore: () => McpServerStore
  /** Live client forks, for the unmount a rename or a removal requires. */
  manager?: McpManager
  /** Persist the MCP stores after a write. */
  persistMcpServers: () => Promise<void>
  /** Session settings store, for the rename cascade. */
  getSessionSettingsStore: () => SessionSettingsStore
  /** Persist the session settings store after a rename rewrote its ids. */
  persistSessionSettings: () => Promise<void>
  /** Re-derive every policy surface after a write. */
  invalidate: () => void
}

export class McpServerRegistry {
  private readonly deps: McpRegistryDeps

  constructor(deps: McpRegistryDeps) {
    this.deps = deps
  }

  /**
   * The process-wide store.
   *
   * This process is its only writer, so one cached copy is the whole
   * consistency model; the "read fresh from disk" path handlers used to take is
   * what made a mutation's visibility depend on which branch published it.
   */
  private current(): McpServerStore {
    return this.deps.getStore()
  }

  /** Persist whatever changed; a write failure is the caller's to report. */
  private persist(): Promise<void> {
    return this.deps.persistMcpServers()
  }

  /** The client-facing list: heavy fields reduced to counts, runtime attached. */
  public list(): GlobalMcpServerConfig[] {
    const registeredNames = this.deps.manager?.collectRegisteredToolNames()
    return Object.values(this.current().servers).map((s) => {
      const {
        toolDetails: _toolDetails,
        resourceDetails,
        resourceTemplateDetails,
        promptDetails,
        capabilities,
        tools,
        disabledTools,
        ...rest
      } = s
      const server = {
        ...rest,
        tools: Array.isArray(tools) ? tools.length : 0,
        disabledTools: Array.isArray(disabledTools) ? disabledTools.length : 0,
        // Counts replace the full arrays on the list response; the detail arrays
        // are served by `cacheView` for the one server a panel opens.
        resourceCount: Array.isArray(resourceDetails)
          ? resourceDetails.length
          : 0,
        resourceTemplateCount: Array.isArray(resourceTemplateDetails)
          ? resourceTemplateDetails.length
          : 0,
        promptCount: Array.isArray(promptDetails) ? promptDetails.length : 0,
        capabilities,
      } as GlobalMcpServerConfig
      if (this.deps.manager) {
        server.runtime = this.deps.manager.getServerStatus(
          s.id,
          registeredNames,
        )
      }
      return server
    })
  }

  /** The sanitized list entry for one server, or undefined. */
  public find(id: string): GlobalMcpServerConfig | undefined {
    return this.list().find((s) => s.id === id)
  }

  /** The stored record, untouched, or undefined. */
  public raw(id: string): GlobalMcpServerConfig | undefined {
    return this.current().servers[id]
  }

  /** What a previous probe stored for one server; never opens a connection. */
  public cacheView(id: string): McpCachedView | undefined {
    const s = this.current().servers[id]
    if (!s) return undefined
    return {
      ok: true,
      tools: s.tools || [],
      toolDetails: s.toolDetails || [],
      resourceDetails: s.resourceDetails || [],
      resourceTemplateDetails: s.resourceTemplateDetails || [],
      promptDetails: s.promptDetails || [],
      capabilities: s.capabilities,
      disabledTools: Array.isArray(s.disabledTools) ? s.disabledTools : [],
      serverInfo: s.serverInfo,
      detectedTransport: s.detectedTransport,
    }
  }

  /**
   * Insert or replace one server.
   *
   * A rename deletes the old id, tears down its live fork (the official client
   * reserves the `serverName` namespace), and rewrites every session settings
   * reference before the new record is written.
   */
  public async upsert(
    incoming: Partial<GlobalMcpServerConfig>,
    originalId?: string,
  ): Promise<ServerWriteResult> {
    const store = this.current()
    const isRename = Boolean(originalId && store.servers[originalId])
    const existing = isRename
      ? store.servers[originalId as string]
      : typeof incoming.id === 'string'
        ? store.servers[incoming.id.trim()]
        : undefined

    const normalized = normalizeServer(incoming, existing)
    if ('error' in normalized) return normalized
    const { config, id } = normalized

    if (isRename && originalId !== id) {
      delete store.servers[originalId as string]
      await this.deps.manager?.unmountOfficialClient(originalId as string)

      const sessionStore = this.deps.getSessionSettingsStore()
      if (
        renameServerIdInSessionStore(sessionStore, originalId as string, id)
      ) {
        await this.deps.persistSessionSettings()
      }
    }

    store.servers[id] = config
    await this.persist()
    this.deps.invalidate()
    return { config, id }
  }

  /** Remove one server and its live fork. */
  public async remove(id: string): Promise<boolean> {
    const store = this.current()
    if (!store.servers[id]) return false

    delete store.servers[id]
    await this.persist()
    await this.deps.manager?.unmountOfficialClient(id)
    this.deps.invalidate()
    return true
  }

  /**
   * Import an `mcpServers` mapping.
   *
   * Each entry passes the same normalizer as a form submission: an id outside
   * the grammar is skipped rather than silently rewritten into a name the
   * client cannot mount, and existing discovery caches survive the write.
   */
  public async importServers(
    data: unknown,
  ): Promise<{ count: number } | { error: string }> {
    const root = data as Record<string, unknown> | undefined
    const serversMap = (root?.mcpServers ?? root) as
      Record<string, unknown> | undefined
    if (
      !serversMap ||
      typeof serversMap !== 'object' ||
      Array.isArray(serversMap)
    ) {
      return {
        error: 'Invalid JSON format: expected mcpServers object mapping',
      }
    }

    const store = this.current()
    let count = 0
    for (const [key, rawValue] of Object.entries(serversMap)) {
      if (!rawValue || typeof rawValue !== 'object') continue
      const raw = rawValue as Record<string, unknown>
      const id =
        typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : key
      const name =
        typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : id
      const existingId = id.replace(/[^a-zA-Z0-9_-]/g, '_')

      const normalized = normalizeServer(
        {
          ...(raw as Partial<GlobalMcpServerConfig>),
          id,
          name,
          // A bare URL with no transport stated is an HTTP server; the
          // normalizer still owns every other validation.
          transport:
            raw.transport === undefined && raw.url !== undefined
              ? 'streamable-http'
              : (raw.transport as McpTransportType | undefined),
        },
        store.servers[existingId],
      )
      if ('error' in normalized) continue

      // A rename inside an import must retire the old live fork, exactly as a
      // form edit does; otherwise the namespace stays reserved under the old id.
      if (existingId !== normalized.id && store.servers[existingId]) {
        delete store.servers[existingId]
        void this.deps.manager?.unmountOfficialClient(existingId)
      }
      store.servers[normalized.id] = normalized.config
      count++
    }

    await this.persist()
    this.deps.invalidate()
    return { count }
  }

  /**
   * Tear down and rebuild one server's official client.
   *
   * The recovery path for a bridge that exhausted its reconnect budget: the
   * fiber stays alive while every tool is unregistered, so the lazy mount path
   * skips it and nothing else ever retries.
   *
   * @returns the manager's outcome, or undefined when no manager is mounted.
   */
  public refreshClient(
    server: GlobalMcpServerConfig,
    opts: { force?: boolean; settleMs?: number },
  ): Promise<
    | { remounted: boolean; status: McpServerRuntimeStatus; durationMs: number }
    | undefined
  > {
    return (
      this.deps.manager?.refreshServer(server, opts) ??
      Promise.resolve(undefined)
    )
  }

  /**
   * Store one successful probe's discovery.
   *
   * Called AFTER the network round trip, so it re-reads the current record and
   * patches only the discovery fields: a concurrent edit that landed during
   * the probe keeps its connection config instead of being overwritten by a
   * snapshot taken before the await.
   *
   * @returns whether the server still existed when the probe finished.
   */
  public async recordDiscovery(
    id: string,
    result: ProbeDiscovery,
  ): Promise<boolean> {
    const server = this.current().servers[id]
    if (!server) return false
    applyProbeResult(server, result)
    await this.persist()
    this.deps.invalidate()
    return true
  }
}
