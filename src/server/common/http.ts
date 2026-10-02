import type {
  ApiEndpointKey,
  ApiHttpMethod,
  ConnectionFetchRoute,
} from '../../types.ts'
import { API_ENDPOINTS, API_METHODS } from '../../types.ts'

/** A handler that receives the browser request and owns the returned response. */
export type ApiRouteHandler = (request: Request) => Promise<Response>

/**
 * One registered endpoint, keyed so a route cannot name a path or method the
 * contract does not declare.
 */
export interface ApiRouteSpec {
  endpoint: ApiEndpointKey
  handler: ApiRouteHandler
}

/**
 * Build a carrier-registered route from one contract endpoint.
 *
 * The path and the accepted methods are both read from `src/types.ts`, so a
 * route can never disagree with what the client sends. Bodies are `buffered`, so
 * the carrier reads and size-limits them before the handler runs.
 */
export function toFetchRoute(spec: ApiRouteSpec): ConnectionFetchRoute {
  const path = API_ENDPOINTS[spec.endpoint]
  const method: ApiHttpMethod = API_METHODS[spec.endpoint]
  return {
    path,
    methods: [method],
    requestBody: 'buffered',
    fetch: spec.handler,
  }
}

/** JSON response with the plugin's standard content type. */
export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/** The plugin's uniform rejection for a request whose shape violates the contract. */
export function badRequest(error: string): Response {
  return jsonResponse({ ok: false, error }, 400)
}

/** Read and parse a buffered JSON body; `undefined` when it is absent or unparsable. */
export async function readJsonBody(
  request: Request,
): Promise<Record<string, unknown> | undefined> {
  try {
    const text = await request.text()
    if (!text.trim()) return undefined
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

/** Query string of a read request. */
export function requestQuery(request: Request): URLSearchParams {
  return new URL(request.url).searchParams
}
