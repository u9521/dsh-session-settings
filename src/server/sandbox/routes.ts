import type { ConnectionService } from '../../types.ts'
import type { SandboxTemplateRegistry } from './templates.ts'
import {
  badRequest,
  jsonResponse,
  readJsonBody,
  toFetchRoute,
} from '../common/http.ts'

/**
 * The sandbox template routes.
 *
 * Three plain endpoints rather than a save-everything document: presets are
 * edited one at a time from a modal that writes immediately, exactly like MCP
 * servers, and a whole-document PUT would let one stale client clobber a preset
 * another session added a second earlier.
 */
export function registerSandboxTemplateRoutes(
  connection: ConnectionService,
  registry: SandboxTemplateRegistry,
  /**
   * Built-in labels in the active language, supplied by the caller.
   *
   * Read per request rather than captured at registration: the language can
   * change while the plugin is mounted, and a captured list would keep refusing
   * names that are no longer taken.
   */
  builtinNames: () => readonly string[],
): () => void {
  const unregisterList = connection.fetch.register(
    toFetchRoute({
      endpoint: 'sandboxTemplatesList',
      handler: async () => {
        try {
          return jsonResponse({ ok: true, templates: registry.list() })
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

  const unregisterSave = connection.fetch.register(
    toFetchRoute({
      endpoint: 'sandboxTemplatesSave',
      handler: async (request) => {
        const parsed = await readJsonBody(request)
        if (!parsed) return badRequest('A JSON request body is required')
        const incoming = parsed.template
        if (!incoming || typeof incoming !== 'object') {
          return badRequest('A "template" payload is required')
        }

        try {
          const result = await registry.upsert(
            incoming as Parameters<SandboxTemplateRegistry['upsert']>[0],
            builtinNames(),
          )
          if ('error' in result) return badRequest(result.error)
          return jsonResponse({
            ok: true,
            template: result.template,
            templates: registry.list(),
          })
        } catch (err: unknown) {
          return badRequest(err instanceof Error ? err.message : String(err))
        }
      },
    }),
  )

  const unregisterRemove = connection.fetch.register(
    toFetchRoute({
      endpoint: 'sandboxTemplatesRemove',
      handler: async (request) => {
        const parsed = await readJsonBody(request)
        if (!parsed) return badRequest('A JSON request body is required')
        const id = typeof parsed.id === 'string' ? parsed.id.trim() : ''
        if (!id) return badRequest('An "id" is required')

        try {
          const removed = await registry.remove(id)
          if (!removed) return badRequest(`No template with id "${id}"`)
          return jsonResponse({ ok: true, templates: registry.list() })
        } catch (err: unknown) {
          return badRequest(err instanceof Error ? err.message : String(err))
        }
      },
    }),
  )

  return () => {
    void unregisterList()
    void unregisterSave()
    void unregisterRemove()
  }
}
