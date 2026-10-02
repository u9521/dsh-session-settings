import {
  type ConnectionService,
  type GlobalMcpServerConfig,
  type McpCachedView,
  type McpProbeResult,
  type McpRefreshResult,
  type McpServerStore,
  type McpTransportType,
  type McpReconnectConfig,
  type SessionSettingsStore,
} from '../../types.ts'
import { loadMcpStore, saveMcpStore } from './storage.ts'
import {
  loadSessionSettingsStore,
  saveSessionSettingsStore,
  renameServerIdInSessionStore,
} from '../session/storage.ts'
import { testMcpConnection } from './tester/index.ts'
import { getPrompt, readResource } from './tester/read.ts'
import type { McpManager } from './manager.ts'
import {
  badRequest,
  jsonResponse,
  readJsonBody,
  toFetchRoute,
} from '../common/http.ts'

/**
 * How long a manual refresh waits for the freshly mounted official client to
 * settle before reading its runtime status. Bounded so the request stays snappy.
 */
const MCP_REFRESH_SETTLE_MS = 3000

/**
 * Build the client-facing representation of the MCP servers.
 *
 * Heavy fields (`toolDetails`) are stripped down to counts, and the live
 * `runtime` status of the official mcp-client fork is attached. `runtime` is
 * response-only and never persisted: `saveMcpStore` always serializes the store
 * itself, never this projection.
 */
function getSanitizedServers(
  store: McpServerStore,
  mcpManager?: McpManager,
): GlobalMcpServerConfig[] {
  // The registry is walked once and shared by every server in the response.
  const registeredNames = mcpManager?.collectRegisteredToolNames()
  return Object.values(store.servers).map((s) => {
    const {
      toolDetails,
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
      // are served by `toolview` for the one server the panel opens.
      resourceCount: Array.isArray(resourceDetails)
        ? resourceDetails.length
        : 0,
      resourceTemplateCount: Array.isArray(resourceTemplateDetails)
        ? resourceTemplateDetails.length
        : 0,
      promptCount: Array.isArray(promptDetails) ? promptDetails.length : 0,
      capabilities,
    } as GlobalMcpServerConfig
    if (mcpManager) {
      server.runtime = mcpManager.getServerStatus(s.id, registeredNames)
    }
    return server
  })
}

/** Official `dsh-mcp-client` namespacing contract for `mcp__<serverName>__<tool>`. */
const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

/**
 * Fold one successful probe's discovery into the stored server.
 *
 * The single writer for everything a probe learns. Three call sites (the tools
 * endpoint, the test endpoint, and the manual refresh) previously repeated the
 * same field list, so every new discovered primitive had to be added in three
 * places or one of them would silently drop it. Arrays are assigned only when
 * the probe reported them, so a partial result cannot erase a good cache.
 *
 * @param server - stored config to update in place.
 * @param result - a successful probe outcome.
 */
function applyProbeResult(
  server: GlobalMcpServerConfig,
  result: {
    tools?: string[]
    toolDetails?: GlobalMcpServerConfig['toolDetails']
    resourceDetails?: GlobalMcpServerConfig['resourceDetails']
    resourceTemplateDetails?: GlobalMcpServerConfig['resourceTemplateDetails']
    promptDetails?: GlobalMcpServerConfig['promptDetails']
    capabilities?: GlobalMcpServerConfig['capabilities']
    detectedTransport?: GlobalMcpServerConfig['detectedTransport']
    serverInfo?: GlobalMcpServerConfig['serverInfo']
  },
): void {
  if (result.tools) server.tools = result.tools
  if (result.toolDetails) server.toolDetails = result.toolDetails
  if (result.resourceDetails) server.resourceDetails = result.resourceDetails
  if (result.resourceTemplateDetails) {
    server.resourceTemplateDetails = result.resourceTemplateDetails
  }
  if (result.promptDetails) server.promptDetails = result.promptDetails
  if (result.capabilities) server.capabilities = result.capabilities
  if (result.detectedTransport)
    server.detectedTransport = result.detectedTransport
  if (result.serverInfo) server.serverInfo = result.serverInfo
  server.lastTestedAt = Date.now()
}

function parseServerConfig(
  incoming: Partial<GlobalMcpServerConfig>,
  existing?: GlobalMcpServerConfig,
): { error?: string; config?: GlobalMcpServerConfig; id?: string } {
  const rawId = (typeof incoming.id === 'string' ? incoming.id : '').trim()
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const name = (typeof incoming.name === 'string' ? incoming.name : '').trim()

  if (!id || !name) {
    return { error: 'Server ID and name are required' }
  }

  // The official mcp-client derives model-facing tool names from this id and
  // rejects anything outside the pattern, so refuse it here with a clear message
  // instead of failing later at mount time.
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
    return {
      error: 'Valid transport (stdio, streamable-http) is required',
    }
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

  let reconnect: McpReconnectConfig | undefined = undefined
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

export function registerMcpRoutes(
  connection: ConnectionService,
  getMcpStore: () => McpServerStore,
  setMcpStore: (s: McpServerStore) => void,
  mcpManager?: McpManager,
  getSessionSettingsStore?: () => SessionSettingsStore,
  setSessionSettingsStore?: (s: SessionSettingsStore) => void,
  invalidatePolicies?: () => void,
): () => void {
  // 1. GET /mcp-servers/list
  const unregisterListRoute = connection.fetch.register(
    toFetchRoute({
      endpoint: 'mcpServersList',
      handler: async () => {
        try {
          const currentStore = loadMcpStore()
          setMcpStore(currentStore)
          const sanitizedServers = getSanitizedServers(currentStore, mcpManager)
          return jsonResponse({ ok: true, servers: sanitizedServers })
        } catch (err: unknown) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            500,
          )
        }
      },
    }),
  )

  // 2. POST /mcp-servers/add
  const unregisterAddRoute = connection.fetch.register(
    toFetchRoute({
      endpoint: 'mcpServersAdd',
      handler: async (request) => {
        const parsed = await readJsonBody(request)
        if (!parsed) return badRequest('A JSON request body is required')
        const incoming = parsed.server as
          Partial<GlobalMcpServerConfig> | undefined
        if (!incoming || typeof incoming !== 'object') {
          return badRequest('A "server" payload is required')
        }

        try {
          const { error, config, id } = parseServerConfig(incoming)
          if (error || !config || !id) {
            return badRequest(error || 'Invalid server configuration')
          }

          const mcpStore = getMcpStore()
          mcpStore.servers[id] = config
          saveMcpStore(mcpStore)
          setMcpStore(mcpStore)

          mcpManager?.syncServer(config)
          invalidatePolicies?.()

          return jsonResponse({ ok: true, server: config })
        } catch (err: unknown) {
          return badRequest(err instanceof Error ? err.message : String(err))
        }
      },
    }),
  )

  // 3. POST /mcp-servers/edit
  const unregisterEditRoute = connection.fetch.register(
    toFetchRoute({
      endpoint: 'mcpServersEdit',
      handler: async (request) => {
        const parsed = await readJsonBody(request)
        if (!parsed) return badRequest('A JSON request body is required')
        const incoming = parsed.server as
          Partial<GlobalMcpServerConfig> | undefined
        if (!incoming || typeof incoming !== 'object') {
          return badRequest('A "server" payload is required')
        }
        const originalId =
          typeof parsed.originalId === 'string' ? parsed.originalId.trim() : ''

        try {
          const mcpStore = getMcpStore()
          const isRename = Boolean(originalId && mcpStore.servers[originalId])
          const existing = isRename
            ? mcpStore.servers[originalId]
            : typeof incoming.id === 'string'
              ? mcpStore.servers[incoming.id.trim()]
              : undefined

          const { error, config, id } = parseServerConfig(incoming, existing)
          if (error || !config || !id) {
            return badRequest(error || 'Invalid server configuration')
          }

          if (isRename && originalId !== id) {
            delete mcpStore.servers[originalId]
            await mcpManager?.unmountOfficialClient(originalId)

            const currentSessionSettings = getSessionSettingsStore
              ? getSessionSettingsStore()
              : loadSessionSettingsStore()
            if (
              renameServerIdInSessionStore(
                currentSessionSettings,
                originalId,
                id,
              )
            ) {
              saveSessionSettingsStore(currentSessionSettings)
              setSessionSettingsStore?.(currentSessionSettings)
            }
          }

          mcpStore.servers[id] = config
          saveMcpStore(mcpStore)
          setMcpStore(mcpStore)

          mcpManager?.syncServer(config)
          invalidatePolicies?.()

          return jsonResponse({ ok: true, server: config })
        } catch (err: unknown) {
          return badRequest(err instanceof Error ? err.message : String(err))
        }
      },
    }),
  )

  // 4. POST /mcp-servers/rm
  const unregisterRmRoute = connection.fetch.register(
    toFetchRoute({
      endpoint: 'mcpServersRm',
      handler: async (request) => {
        const parsed = await readJsonBody(request)
        if (!parsed) return badRequest('A JSON request body is required')
        const targetId = (typeof parsed.id === 'string' ? parsed.id : '').trim()
        if (!targetId) return badRequest('Server ID is required')

        try {
          const mcpStore = getMcpStore()
          if (mcpStore.servers[targetId]) {
            delete mcpStore.servers[targetId]
            saveMcpStore(mcpStore)
            setMcpStore(mcpStore)
            await mcpManager?.unmountOfficialClient(targetId)
          }

          return jsonResponse({ ok: true, id: targetId })
        } catch (err: unknown) {
          return badRequest(err instanceof Error ? err.message : String(err))
        }
      },
    }),
  )

  // 5. GET /mcp-servers/cache
  //
  // The single cache-preview entry point: report what a previous probe stored
  // for one server. It reads the store and never opens a connection, so a panel
  // can render immediately. The four list types share this one response.
  const unregisterCacheRoute = connection.fetch.register(
    toFetchRoute({
      endpoint: 'mcpServersCache',
      handler: async (request) => {
        const targetId = (
          new URL(request.url).searchParams.get('id') || ''
        ).trim()
        const currentStore = loadMcpStore()
        setMcpStore(currentStore)

        if (!targetId || !currentStore.servers[targetId]) {
          return jsonResponse({ ok: false, error: 'Server not found' }, 404)
        }

        const s = currentStore.servers[targetId]
        const cached: McpCachedView = {
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
        return jsonResponse(cached)
      },
    }),
  )

  // 6. POST /mcp-servers/probe
  //
  // The single discovery entry point. One connection reports every primitive the
  // server declares — tools, resources, resource templates, and prompts — so a
  // caller never needs a second request per primitive family. This absorbs the
  // former /tools and /test routes, which were byte-identical.
  //
  // `remount: true` appends the former /refresh behaviour: after probing, tear
  // down and rebuild the official client. That is the recovery path for a server
  // whose bridge already exhausted its reconnect budget — such a fiber stays
  // alive while every tool has been unregistered, so nothing else ever retries
  // it (the lazy mount path skips servers that still have a live fork). It is
  // opt-in precisely because it disrupts a live connection.
  const unregisterProbeRoute = connection.fetch.register(
    toFetchRoute({
      endpoint: 'mcpServersProbe',
      handler: async (request) => {
        const parsed = await readJsonBody(request)
        if (!parsed) return badRequest('A JSON request body is required')
        const probePayload = parsed.server as
          Partial<GlobalMcpServerConfig> | undefined
        if (!probePayload || typeof probePayload !== 'object') {
          return badRequest('A "server" payload is required')
        }

        try {
          const mcpStore = getMcpStore()
          const targetId = (
            typeof probePayload.id === 'string' ? probePayload.id : ''
          ).trim()
          const existing = targetId ? mcpStore.servers[targetId] : undefined
          const effectiveServer = existing
            ? { ...existing, ...probePayload }
            : probePayload
          const startedAt = Date.now()
          const probe = await testMcpConnection(effectiveServer)

          if (targetId && mcpStore.servers[targetId] && probe.ok) {
            const s = mcpStore.servers[targetId]
            applyProbeResult(s, probe)

            saveMcpStore(mcpStore)
            setMcpStore(mcpStore)
            mcpManager?.syncServer(s)
            invalidatePolicies?.()
          }

          let remount: McpRefreshResult | undefined
          if (parsed.remount === true) {
            if (!targetId) {
              return badRequest('A "server.id" is required to remount')
            }
            if (!mcpStore.servers[targetId]) {
              return jsonResponse(
                { ok: false, error: `Unknown MCP server "${targetId}"` },
                404,
              )
            }

            // `settleMs` makes the response wait (bounded) for the rebuilt fork
            // to register its tools, so a caller can update its badge from this
            // single response without polling.
            const outcome = mcpManager
              ? await mcpManager.refreshServer(mcpStore.servers[targetId], {
                  force: parsed.force === true,
                  settleMs: probe.ok ? MCP_REFRESH_SETTLE_MS : 0,
                })
              : undefined

            remount = {
              id: targetId,
              name: mcpStore.servers[targetId].name,
              ok: probe.ok,
              message: probe.message,
              toolCount: probe.tools?.length ?? 0,
              durationMs: outcome?.durationMs ?? Date.now() - startedAt,
              remounted: outcome?.remounted ?? false,
              status: outcome?.status ?? {
                mountAttempted: false,
                mounted: false,
                registeredToolCount: 0,
              },
            }
          }

          const result: McpProbeResult = {
            ...probe,
            ...(remount ? { remount } : {}),
            ...(targetId
              ? {
                  server: getSanitizedServers(mcpStore, mcpManager).find(
                    (s) => s.id === targetId,
                  ),
                }
              : {}),
          }

          return jsonResponse(result)
        } catch (err: unknown) {
          return badRequest(err instanceof Error ? err.message : String(err))
        }
      },
    }),
  )

  // 7. POST /mcp-servers/import
  const unregisterImportRoute = connection.fetch.register(
    toFetchRoute({
      endpoint: 'mcpServersImport',
      handler: async (request) => {
        const parsed = await readJsonBody(request)
        if (!parsed) return badRequest('A JSON request body is required')
        if (parsed.data === undefined) {
          return badRequest('A "data" payload is required')
        }
        const rootObj = parsed.data as Record<string, unknown>
        const serversMap = (rootObj.mcpServers ?? rootObj) as Record<
          string,
          unknown
        >

        try {
          if (
            !serversMap ||
            typeof serversMap !== 'object' ||
            Array.isArray(serversMap)
          ) {
            return jsonResponse(
              {
                ok: false,
                message:
                  'Invalid JSON format: expected mcpServers object mapping',
              },
              400,
            )
          }

          const mcpStore = getMcpStore()
          let count = 0

          for (const [key, rawVal] of Object.entries(serversMap)) {
            if (!rawVal || typeof rawVal !== 'object') continue
            const raw = rawVal as Record<string, unknown>
            const rawId = (typeof raw.id === 'string' ? raw.id : key).trim()
            const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '_')
            if (!id) continue

            const name =
              (typeof raw.name === 'string' ? raw.name : key).trim() || id
            const transport: McpTransportType =
              raw.transport === 'stdio'
                ? 'stdio'
                : raw.transport === 'streamable-http' ||
                    raw.transport === 'streamable-http-or-sse' ||
                    raw.transport === 'sse'
                  ? 'streamable-http'
                  : raw.url
                    ? 'streamable-http'
                    : 'stdio'

            const existing = mcpStore.servers[id]
            const now = Date.now()

            const serverConfig: GlobalMcpServerConfig = {
              id,
              name,
              description:
                typeof raw.description === 'string'
                  ? raw.description.trim()
                  : existing?.description,
              transport,
              command:
                typeof raw.command === 'string'
                  ? raw.command.trim()
                  : existing?.command,
              args: Array.isArray(raw.args)
                ? raw.args.filter((a): a is string => typeof a === 'string')
                : existing?.args || [],
              env:
                raw.env && typeof raw.env === 'object'
                  ? (raw.env as Record<string, string>)
                  : existing?.env,
              cwd: typeof raw.cwd === 'string' ? raw.cwd.trim() : existing?.cwd,
              url: typeof raw.url === 'string' ? raw.url.trim() : existing?.url,
              headers:
                raw.headers && typeof raw.headers === 'object'
                  ? (raw.headers as Record<string, string>)
                  : existing?.headers,
              toolCallTimeoutMs:
                typeof raw.toolCallTimeoutMs === 'number'
                  ? raw.toolCallTimeoutMs
                  : existing?.toolCallTimeoutMs,
              failOnStartupError:
                typeof raw.failOnStartupError === 'boolean'
                  ? raw.failOnStartupError
                  : existing?.failOnStartupError,
              reconnect: (raw.reconnect && typeof raw.reconnect === 'object'
                ? raw.reconnect
                : existing?.reconnect) as McpReconnectConfig | undefined,
              disabledTools: Array.isArray(raw.disabledTools)
                ? raw.disabledTools
                : existing?.disabledTools,
              tools: existing?.tools,
              toolDetails: existing?.toolDetails,
              detectedTransport: existing?.detectedTransport,
              serverInfo: existing?.serverInfo,
              lastTestedAt: existing?.lastTestedAt,
              createdAt: existing?.createdAt ?? now,
              updatedAt: now,
            }

            mcpStore.servers[id] = serverConfig
            count++
          }

          saveMcpStore(mcpStore)
          setMcpStore(mcpStore)

          mcpManager?.syncAll()
          invalidatePolicies?.()

          const sanitizedServers = getSanitizedServers(mcpStore, mcpManager)
          return jsonResponse({
            ok: true,
            count,
            servers: sanitizedServers,
          })
        } catch (err: unknown) {
          return jsonResponse(
            {
              ok: false,
              message: err instanceof Error ? err.message : String(err),
            },
            400,
          )
        }
      },
    }),
  )

  // 8. POST /mcp-servers/resource-read
  //
  // Read ONE resource for the preview pane. This opens its own short-lived
  // connection rather than reusing the mounted official client, which lives
  // inside a Cordis fiber with no query API and exposes resources only to the
  // model-facing `ctx.mcpResources`. Nothing here is registered anywhere: the
  // read is a GUI action whose result stays in the browser.
  const unregisterResourceReadRoute = connection.fetch.register(
    toFetchRoute({
      endpoint: 'mcpServersResourceRead',
      handler: async (request) => {
        const parsed = await readJsonBody(request)
        if (!parsed) return badRequest('A JSON request body is required')

        const target = parsed.server as
          Partial<GlobalMcpServerConfig> | undefined
        if (!target || typeof target !== 'object') {
          return badRequest('A "server" payload is required')
        }

        const uri = typeof parsed.uri === 'string' ? parsed.uri.trim() : ''
        const uriTemplate =
          typeof parsed.uriTemplate === 'string'
            ? parsed.uriTemplate.trim()
            : ''
        if (!uri && !uriTemplate) {
          return badRequest('Either "uri" or "uriTemplate" is required')
        }

        const variables =
          parsed.variables && typeof parsed.variables === 'object'
            ? Object.fromEntries(
                Object.entries(
                  parsed.variables as Record<string, unknown>,
                ).filter((entry): entry is [string, string] => {
                  return typeof entry[1] === 'string'
                }),
              )
            : undefined

        const result = await readResource({
          server: target,
          ...(uri ? { uri } : {}),
          ...(uriTemplate ? { uriTemplate } : {}),
          ...(variables ? { variables } : {}),
        })
        return jsonResponse(result)
      },
    }),
  )

  // 9. POST /mcp-servers/prompt-get
  //
  // Render ONE prompt template, on demand. Same one-shot-connection reasoning as
  // the resource read above. The host supports no prompt invocation mechanism
  // at all, so this deliberately stops at showing the rendered text: it is a
  // viewer, not a way to inject content into a session.
  const unregisterPromptGetRoute = connection.fetch.register(
    toFetchRoute({
      endpoint: 'mcpServersPromptGet',
      handler: async (request) => {
        const parsed = await readJsonBody(request)
        if (!parsed) return badRequest('A JSON request body is required')

        const target = parsed.server as
          Partial<GlobalMcpServerConfig> | undefined
        if (!target || typeof target !== 'object') {
          return badRequest('A "server" payload is required')
        }

        const name = typeof parsed.name === 'string' ? parsed.name.trim() : ''
        if (!name) return badRequest('A "name" field is required')

        const args =
          parsed.arguments && typeof parsed.arguments === 'object'
            ? Object.fromEntries(
                Object.entries(
                  parsed.arguments as Record<string, unknown>,
                ).filter((entry): entry is [string, string] => {
                  return typeof entry[1] === 'string'
                }),
              )
            : undefined

        const result = await getPrompt({
          server: target,
          name,
          ...(args ? { arguments: args } : {}),
        })
        return jsonResponse(result)
      },
    }),
  )

  return async () => {
    await unregisterListRoute()
    await unregisterAddRoute()
    await unregisterEditRoute()
    await unregisterRmRoute()
    await unregisterCacheRoute()
    await unregisterProbeRoute()
    await unregisterImportRoute()
    await unregisterResourceReadRoute()
    await unregisterPromptGetRoute()
  }
}
