import type {
  GlobalMcpServerConfig,
  McpServerStore,
  McpTransportType,
  McpReconnectConfig,
  SessionSettingsStore,
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

export function registerMcpRoutes(
  webServer: any,
  getMcpStore: () => McpServerStore,
  setMcpStore: (s: McpServerStore) => void,
  mcpManager?: McpManager,
  getSessionSettingsStore?: () => SessionSettingsStore,
  setSessionSettingsStore?: (s: SessionSettingsStore) => void,
): () => void {
  const unregisterMcpRoute = webServer.register({
    kind: 'exact',
    path: '/api/mcp-servers',
    handler: async (req: any, res: any) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      const url = new URL(req.url ?? '/', 'http://localhost')

      if (req.method === 'GET') {
        const currentStore = loadMcpStore()
        setMcpStore(currentStore)
        res.writeHead(200)
        res.end(
          JSON.stringify({
            ok: true,
            servers: Object.values(currentStore.servers),
          }),
        )
        return
      }

      if (req.method === 'POST') {
        try {
          const bodyStr = await readRequestBody(req)
          const parsed = JSON.parse(bodyStr || '{}')

          // Sub-action: test connection or list tools
          if (
            parsed.action === 'test' ||
            parsed.action === 'tools' ||
            url.searchParams.get('action') === 'test' ||
            url.searchParams.get('action') === 'tools'
          ) {
            const testResult = await testMcpConnection(parsed.server || parsed)
            const mcpStore = getMcpStore()
            const targetId = (parsed.server?.id || parsed.id || '').trim()
            if (targetId && mcpStore.servers[targetId]) {
              const s = mcpStore.servers[targetId]
              if (testResult.ok) {
                if (testResult.tools) {
                  s.tools = testResult.tools
                }
                if (testResult.toolDetails) {
                  s.toolDetails = testResult.toolDetails
                }
                if (testResult.detectedTransport) {
                  s.detectedTransport = testResult.detectedTransport
                }
                if (testResult.serverInfo) {
                  s.serverInfo = testResult.serverInfo
                }
                s.lastTestedAt = Date.now()
                saveMcpStore(mcpStore)
                setMcpStore(mcpStore)

                // Sync official client instance
                mcpManager?.syncServer(s)
              }
            }
            res.writeHead(200)
            res.end(
              JSON.stringify({
                ...testResult,
                servers: Object.values(mcpStore.servers),
              }),
            )
            return
          }

          const incoming: Partial<GlobalMcpServerConfig> =
            parsed.server || parsed
          const rawId = (incoming.id || '').trim()
          const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '_')
          const name = (incoming.name || '').trim()
          const rawTransport = incoming.transport
          const transport: McpTransportType =
            rawTransport === 'stdio'
              ? 'stdio'
              : rawTransport === 'streamable-http-or-sse' ||
                  rawTransport === 'streamable-http' ||
                  rawTransport === 'sse'
                ? 'streamable-http-or-sse'
                : ('' as any)

          if (!transport) {
            res.writeHead(400)
            res.end(
              JSON.stringify({
                ok: false,
                error:
                  'Valid transport (stdio, streamable-http-or-sse) is required',
              }),
            )
            return
          }

          if (transport === 'stdio' && !incoming.command?.trim()) {
            res.writeHead(400)
            res.end(
              JSON.stringify({
                ok: false,
                error: 'Command is required for stdio transport',
              }),
            )
            return
          }

          if (transport !== 'stdio' && !incoming.url?.trim()) {
            res.writeHead(400)
            res.end(
              JSON.stringify({
                ok: false,
                error: 'URL is required for HTTP/SSE transport',
              }),
            )
            return
          }

          const mcpStore = getMcpStore()
          const originalId =
            typeof parsed.originalId === 'string'
              ? parsed.originalId.trim()
              : ''
          const isRename = Boolean(
            originalId && originalId !== id && mcpStore.servers[originalId],
          )
          const existing = isRename
            ? mcpStore.servers[originalId]
            : mcpStore.servers[id]
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

          const serverConfig: GlobalMcpServerConfig = {
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
            toolCallTimeoutMs,
            failOnStartupError,
            reconnect,
            disabledTools:
              disabledTools && disabledTools.length > 0
                ? disabledTools
                : undefined,
            tools: incoming.tools || existing?.tools,
            toolDetails: incoming.toolDetails || existing?.toolDetails,
            detectedTransport:
              incoming.detectedTransport || existing?.detectedTransport,
            serverInfo: incoming.serverInfo || existing?.serverInfo,
            lastTestedAt: incoming.lastTestedAt || existing?.lastTestedAt,
            createdAt: existing?.createdAt || now,
            updatedAt: now,
          }

          if (isRename) {
            delete mcpStore.servers[originalId]
            mcpManager?.unregisterServer(originalId)

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

          mcpStore.servers[id] = serverConfig
          saveMcpStore(mcpStore)
          setMcpStore(mcpStore)

          // Sync tool registration on ctx.tools
          mcpManager?.syncServer(serverConfig)

          res.writeHead(200)
          res.end(
            JSON.stringify({
              ok: true,
              server: serverConfig,
              servers: Object.values(mcpStore.servers),
            }),
          )
        } catch (err: any) {
          res.writeHead(400)
          res.end(
            JSON.stringify({ ok: false, error: err?.message || String(err) }),
          )
        }
        return
      }

      if (req.method === 'DELETE') {
        try {
          const bodyStr = await readRequestBody(req)
          const parsed = bodyStr ? JSON.parse(bodyStr) : {}
          const targetId = url.searchParams.get('id') || parsed.id
          const mcpStore = getMcpStore()
          if (targetId && mcpStore.servers[targetId]) {
            delete mcpStore.servers[targetId]
            saveMcpStore(mcpStore)
            setMcpStore(mcpStore)
            mcpManager?.unregisterServer(targetId)
          }
          res.writeHead(200)
          res.end(
            JSON.stringify({
              ok: true,
              servers: Object.values(mcpStore.servers),
            }),
          )
        } catch (err: any) {
          res.writeHead(400)
          res.end(
            JSON.stringify({ ok: false, error: err?.message || String(err) }),
          )
        }
        return
      }

      res.writeHead(405)
      res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }))
    },
  })

  return unregisterMcpRoute
}
