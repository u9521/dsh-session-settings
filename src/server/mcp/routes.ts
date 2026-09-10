import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  type GlobalMcpServerConfig,
  type McpServerStore,
  type McpTransportType,
  type McpReconnectConfig,
  type SessionSettingsStore,
  type WebServer,
  API_ENDPOINTS,
} from '../../types.ts'
import { loadMcpStore, saveMcpStore } from './storage.ts'
import {
  loadSessionSettingsStore,
  saveSessionSettingsStore,
  renameServerIdInSessionStore,
} from '../session/storage.ts'
import { testMcpConnection } from './tester/index.ts'
import type { McpManager } from './manager.ts'
import { readRequestBody } from '../common/http.ts'

function sendJson(
  res: ServerResponse,
  statusCode: number,
  data: unknown,
): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.writeHead(statusCode)
  res.end(JSON.stringify(data))
}

function sendMethodNotAllowed(res: ServerResponse): void {
  sendJson(res, 405, { ok: false, error: 'Method Not Allowed' })
}

function getSanitizedServers(store: McpServerStore): GlobalMcpServerConfig[] {
  return Object.values(store.servers).map((s) => {
    const { toolDetails, tools, disabledTools, ...rest } = s
    return {
      ...rest,
      tools: Array.isArray(tools) ? tools.length : 0,
      disabledTools: Array.isArray(disabledTools) ? disabledTools.length : 0,
    }
  })
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
    reconnect = {
      enabled:
        typeof incoming.reconnect.enabled === 'boolean'
          ? incoming.reconnect.enabled
          : undefined,
      initialDelayMs:
        typeof incoming.reconnect.initialDelayMs === 'number' &&
        incoming.reconnect.initialDelayMs >= 0
          ? Math.floor(incoming.reconnect.initialDelayMs)
          : undefined,
      maxDelayMs:
        typeof incoming.reconnect.maxDelayMs === 'number' &&
        incoming.reconnect.maxDelayMs >= 0
          ? Math.floor(incoming.reconnect.maxDelayMs)
          : undefined,
      maxAttempts:
        typeof incoming.reconnect.maxAttempts === 'number' &&
        incoming.reconnect.maxAttempts >= 0
          ? Math.floor(incoming.reconnect.maxAttempts)
          : undefined,
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
    enabledByDefault: Boolean(incoming.enabledByDefault),
    toolCallTimeoutMs: toolCallTimeoutMs ?? existing?.toolCallTimeoutMs,
    failOnStartupError: failOnStartupError ?? existing?.failOnStartupError,
    reconnect: reconnect ?? existing?.reconnect,
    disabledTools:
      Array.isArray(disabledTools) && disabledTools.length > 0
        ? disabledTools
        : undefined,
    tools: Array.isArray(incoming.tools) ? incoming.tools : existing?.tools,
    toolDetails: incoming.toolDetails ?? existing?.toolDetails,
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
  webServer: WebServer,
  getMcpStore: () => McpServerStore,
  setMcpStore: (s: McpServerStore) => void,
  mcpManager?: McpManager,
  getSessionSettingsStore?: () => SessionSettingsStore,
  setSessionSettingsStore?: (s: SessionSettingsStore) => void,
): () => void {
  // 1. GET /mcp-servers/list
  const unregisterListRoute = webServer.register({
    kind: 'exact',
    path: API_ENDPOINTS.mcpServersList,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'GET') {
        sendMethodNotAllowed(res)
        return
      }

      try {
        const currentStore = loadMcpStore()
        setMcpStore(currentStore)
        const sanitizedServers = getSanitizedServers(currentStore)
        sendJson(res, 200, { ok: true, servers: sanitizedServers })
      } catch (err: unknown) {
        sendJson(res, 500, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
  })

  // 2. POST /mcp-servers/add
  const unregisterAddRoute = webServer.register({
    kind: 'exact',
    path: API_ENDPOINTS.mcpServersAdd,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'POST') {
        sendMethodNotAllowed(res)
        return
      }

      try {
        const bodyStr = await readRequestBody(req)
        const parsed = JSON.parse(bodyStr || '{}') as Record<string, unknown>
        const incoming = (parsed.server ||
          parsed) as Partial<GlobalMcpServerConfig>
        const { error, config, id } = parseServerConfig(incoming)

        if (error || !config || !id) {
          sendJson(res, 400, {
            ok: false,
            error: error || 'Invalid server configuration',
          })
          return
        }

        const mcpStore = getMcpStore()
        mcpStore.servers[id] = config
        saveMcpStore(mcpStore)
        setMcpStore(mcpStore)

        mcpManager?.syncServer(config)

        sendJson(res, 200, { ok: true, server: config })
      } catch (err: unknown) {
        sendJson(res, 400, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
  })

  // 3. POST /mcp-servers/edit
  const unregisterEditRoute = webServer.register({
    kind: 'exact',
    path: API_ENDPOINTS.mcpServersEdit,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'POST') {
        sendMethodNotAllowed(res)
        return
      }

      try {
        const bodyStr = await readRequestBody(req)
        const parsed = JSON.parse(bodyStr || '{}') as Record<string, unknown>
        const incoming = (parsed.server ||
          parsed) as Partial<GlobalMcpServerConfig>
        const originalId =
          typeof parsed.originalId === 'string' ? parsed.originalId.trim() : ''

        const mcpStore = getMcpStore()
        const isRename = Boolean(originalId && mcpStore.servers[originalId])
        const existing = isRename
          ? mcpStore.servers[originalId]
          : typeof incoming.id === 'string'
            ? mcpStore.servers[incoming.id.trim()]
            : undefined

        const { error, config, id } = parseServerConfig(incoming, existing)
        if (error || !config || !id) {
          sendJson(res, 400, {
            ok: false,
            error: error || 'Invalid server configuration',
          })
          return
        }

        if (isRename && originalId !== id) {
          delete mcpStore.servers[originalId]
          mcpManager?.unmountOfficialClient(originalId)

          const currentSessionSettings = getSessionSettingsStore
            ? getSessionSettingsStore()
            : loadSessionSettingsStore()
          if (
            renameServerIdInSessionStore(currentSessionSettings, originalId, id)
          ) {
            saveSessionSettingsStore(currentSessionSettings)
            setSessionSettingsStore?.(currentSessionSettings)
          }
        }

        mcpStore.servers[id] = config
        saveMcpStore(mcpStore)
        setMcpStore(mcpStore)

        mcpManager?.syncServer(config)

        sendJson(res, 200, { ok: true, server: config })
      } catch (err: unknown) {
        sendJson(res, 400, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
  })

  // 4. POST /mcp-servers/rm
  const unregisterRmRoute = webServer.register({
    kind: 'exact',
    path: API_ENDPOINTS.mcpServersRm,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'POST') {
        sendMethodNotAllowed(res)
        return
      }

      try {
        const bodyStr = await readRequestBody(req)
        const parsed = (bodyStr ? JSON.parse(bodyStr) : {}) as { id?: string }
        const url = new URL(req.url ?? '/', 'http://localhost')
        const targetId = (parsed.id || url.searchParams.get('id') || '').trim()

        if (!targetId) {
          sendJson(res, 400, { ok: false, error: 'Server ID is required' })
          return
        }

        const mcpStore = getMcpStore()
        if (mcpStore.servers[targetId]) {
          delete mcpStore.servers[targetId]
          saveMcpStore(mcpStore)
          setMcpStore(mcpStore)
          mcpManager?.unmountOfficialClient(targetId)
        }

        sendJson(res, 200, { ok: true, id: targetId })
      } catch (err: unknown) {
        sendJson(res, 400, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
  })

  // 5. GET /mcp-servers/toolview
  const unregisterToolviewRoute = webServer.register({
    kind: 'exact',
    path: API_ENDPOINTS.mcpServersToolview,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'GET') {
        sendMethodNotAllowed(res)
        return
      }

      const url = new URL(req.url ?? '/', 'http://localhost')
      const targetId = (url.searchParams.get('id') || '').trim()
      const currentStore = loadMcpStore()
      setMcpStore(currentStore)

      if (!targetId || !currentStore.servers[targetId]) {
        sendJson(res, 404, { ok: false, error: 'Server not found' })
        return
      }

      const s = currentStore.servers[targetId]
      sendJson(res, 200, {
        ok: true,
        cached: true,
        tools: s.tools || [],
        toolDetails: s.toolDetails || [],
        disabledTools: Array.isArray(s.disabledTools) ? s.disabledTools : [],
        serverInfo: s.serverInfo,
        detectedTransport: s.detectedTransport,
      })
    },
  })

  // 6. POST /mcp-servers/tools
  const unregisterToolsRoute = webServer.register({
    kind: 'exact',
    path: API_ENDPOINTS.mcpServersTools,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'POST') {
        sendMethodNotAllowed(res)
        return
      }

      try {
        const bodyStr = await readRequestBody(req)
        const parsed = JSON.parse(bodyStr || '{}') as Record<string, unknown>
        const testPayload = (parsed.server ||
          parsed) as Partial<GlobalMcpServerConfig>
        const mcpStore = getMcpStore()
        const targetId = (
          typeof testPayload.id === 'string' ? testPayload.id : ''
        ).trim()
        const existing = targetId ? mcpStore.servers[targetId] : undefined
        const effectiveServer = existing
          ? { ...existing, ...testPayload }
          : testPayload
        const testResult = await testMcpConnection(effectiveServer)

        if (targetId && mcpStore.servers[targetId] && testResult.ok) {
          const s = mcpStore.servers[targetId]
          if (testResult.tools) s.tools = testResult.tools
          if (testResult.toolDetails) s.toolDetails = testResult.toolDetails
          if (testResult.detectedTransport)
            s.detectedTransport = testResult.detectedTransport
          if (testResult.serverInfo) s.serverInfo = testResult.serverInfo
          s.lastTestedAt = Date.now()

          saveMcpStore(mcpStore)
          setMcpStore(mcpStore)
          mcpManager?.syncServer(s)
        }

        sendJson(res, 200, testResult)
      } catch (err: unknown) {
        sendJson(res, 400, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
  })

  // 7. POST /mcp-servers/test
  const unregisterTestRoute = webServer.register({
    kind: 'exact',
    path: API_ENDPOINTS.mcpServersTest,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'POST') {
        sendMethodNotAllowed(res)
        return
      }

      try {
        const bodyStr = await readRequestBody(req)
        const parsed = JSON.parse(bodyStr || '{}') as Record<string, unknown>
        const testPayload = (parsed.server ||
          parsed) as Partial<GlobalMcpServerConfig>
        const mcpStore = getMcpStore()
        const targetId = (
          typeof testPayload.id === 'string' ? testPayload.id : ''
        ).trim()
        const existing = targetId ? mcpStore.servers[targetId] : undefined
        const effectiveServer = existing
          ? { ...existing, ...testPayload }
          : testPayload
        const testResult = await testMcpConnection(effectiveServer)

        if (targetId && mcpStore.servers[targetId] && testResult.ok) {
          const s = mcpStore.servers[targetId]
          if (testResult.tools) s.tools = testResult.tools
          if (testResult.toolDetails) s.toolDetails = testResult.toolDetails
          if (testResult.detectedTransport)
            s.detectedTransport = testResult.detectedTransport
          if (testResult.serverInfo) s.serverInfo = testResult.serverInfo
          s.lastTestedAt = Date.now()

          saveMcpStore(mcpStore)
          setMcpStore(mcpStore)
          mcpManager?.syncServer(s)
        }

        sendJson(res, 200, testResult)
      } catch (err: unknown) {
        sendJson(res, 400, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
  })

  // 8. POST /mcp-servers/import
  const unregisterImportRoute = webServer.register({
    kind: 'exact',
    path: API_ENDPOINTS.mcpServersImport,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'POST') {
        sendMethodNotAllowed(res)
        return
      }

      try {
        const bodyStr = await readRequestBody(req)
        const parsed = JSON.parse(bodyStr || '{}') as Record<string, unknown>
        const rootObj = (parsed.data || parsed) as Record<string, unknown>
        const serversMap = (rootObj.mcpServers || rootObj) as Record<
          string,
          unknown
        >

        if (
          !serversMap ||
          typeof serversMap !== 'object' ||
          Array.isArray(serversMap)
        ) {
          sendJson(res, 400, {
            ok: false,
            message: 'Invalid JSON format: expected mcpServers object mapping',
          })
          return
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
            enabledByDefault:
              typeof raw.enabledByDefault === 'boolean'
                ? raw.enabledByDefault
                : (existing?.enabledByDefault ?? true),
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

        const sanitizedServers = getSanitizedServers(mcpStore)
        sendJson(res, 200, {
          ok: true,
          count,
          servers: sanitizedServers,
        })
      } catch (err: unknown) {
        sendJson(res, 400, {
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    },
  })

  return () => {
    unregisterListRoute()
    unregisterAddRoute()
    unregisterEditRoute()
    unregisterRmRoute()
    unregisterToolviewRoute()
    unregisterToolsRoute()
    unregisterTestRoute()
    unregisterImportRoute()
  }
}
