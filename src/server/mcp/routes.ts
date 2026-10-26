import {
  type ConnectionService,
  type GlobalMcpServerConfig,
  type McpProbeResult,
  type McpRefreshResult,
} from '../../types.ts'
import type { McpServerRegistry } from './registry.ts'
import { testMcpConnection } from './tester/index.ts'
import { getPrompt, readResource } from './tester/read.ts'
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
 * Outcome text for a rebuild that outlived its settle budget while its fork is
 * still alive. Reported as success: the connection exists, the handshake is
 * merely unfinished, and the caller can press the button again if it stalls.
 */
const STILL_SETTLING =
  'The MCP client was rebuilt and its tools are still registering.'

export function registerMcpRoutes(
  connection: ConnectionService,
  registry: McpServerRegistry,
): () => void {
  // 1. GET /mcp-servers/list
  const unregisterListRoute = connection.fetch.register(
    toFetchRoute({
      endpoint: 'mcpServersList',
      handler: async () => {
        try {
          return jsonResponse({ ok: true, servers: registry.list() })
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
          const result = await registry.upsert(incoming)
          if ('error' in result) return badRequest(result.error)
          return jsonResponse({ ok: true, server: result.config })
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
          const result = await registry.upsert(
            incoming,
            originalId || undefined,
          )
          if ('error' in result) return badRequest(result.error)
          return jsonResponse({ ok: true, server: result.config })
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
          await registry.remove(targetId)
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
        const cached = targetId ? registry.cacheView(targetId) : undefined
        if (!cached) {
          return jsonResponse({ ok: false, error: 'Server not found' }, 404)
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
          const targetId = (
            typeof probePayload.id === 'string' ? probePayload.id : ''
          ).trim()
          const existing = targetId ? registry.raw(targetId) : undefined
          const effectiveServer = existing
            ? { ...existing, ...probePayload }
            : probePayload
          const startedAt = Date.now()
          const probe = await testMcpConnection(effectiveServer)

          // Patch only the discovery fields AFTER the network round trip: a
          // concurrent edit that landed during the probe keeps its connection
          // config instead of being overwritten by a pre-await snapshot.
          if (targetId && probe.ok) {
            registry.recordDiscovery(targetId, probe)
          }

          let remount: McpRefreshResult | undefined
          if (parsed.remount === true) {
            if (!targetId) {
              return badRequest('A "server.id" is required to remount')
            }
            const target = registry.raw(targetId)
            if (!target) {
              return jsonResponse(
                { ok: false, error: `Unknown MCP server "${targetId}"` },
                404,
              )
            }

            // `settleMs` makes the response wait (bounded) for the rebuilt fork
            // to register its tools, so a caller can update its badge from this
            // single response without polling. It is budgeted unconditionally:
            // the rebuild must be judged on its own, never on whether the probe
            // happened to succeed.
            const outcome = await registry.refreshClient(target, {
              settleMs: MCP_REFRESH_SETTLE_MS,
            })

            const status = outcome?.status ?? {
              mountAttempted: false,
              mounted: false,
              registeredToolCount: 0,
            }
            const remounted = outcome?.remounted ?? false
            const settled = outcome?.settled ?? false
            // The probe's own verdict is NOT the remount's verdict: it opens a
            // separate short-lived connection, so it can reach a server whose
            // long-lived client is dead (a stale streamable-HTTP session id
            // does exactly that) and it can fail on one whose client came back.
            // `settled` means tools appeared inside the budget. A server that
            // legitimately exposes none can never settle, so it is not judged by
            // that signal — only a recorded activation error can condemn it.
            const usable =
              remounted && (settled || status.registeredToolCount > 0)
            const ok = usable && !status.lastError

            remount = {
              id: targetId,
              name: target.name,
              ok,
              message: ok
                ? settled
                  ? ''
                  : STILL_SETTLING
                : (status.lastError ??
                  (remounted
                    ? 'The MCP client was rebuilt but registered no tools.'
                    : probe.message) ??
                  ''),
              toolCount: probe.tools?.length ?? 0,
              durationMs: outcome?.durationMs ?? Date.now() - startedAt,
              remounted,
              status,
            }
          }

          const result: McpProbeResult = {
            ...probe,
            ...(remount ? { remount } : {}),
            ...(targetId ? { server: registry.find(targetId) } : {}),
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

        try {
          const imported = await registry.importServers(parsed.data)
          if ('error' in imported) {
            return jsonResponse({ ok: false, message: imported.error }, 400)
          }
          return jsonResponse({
            ok: true,
            count: imported.count,
            servers: registry.list(),
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
