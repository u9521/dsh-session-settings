/**
 * Pure discovery helpers: one response in, one normalized result out.
 *
 * Kept free of React and of any non-platform import, mirroring
 * `mcpPrimitives.ts` and `mcpRuntime.ts`, so the parse and the field table are
 * checkable by a plain node probe. The hook that drives the requests lives in
 * `src/client/mcp/discovery.ts` and imports from here.
 */
import type {
  GlobalMcpServerConfig,
  McpDiscoveredTool,
  McpServerInfo,
} from '../types/index.ts'
import { listsFromResponse, type McpPrimitiveLists } from './mcpPrimitives.ts'

/** One server's full discovery, from a single probe or a cache read. */
export interface McpDiscovery {
  tools: McpDiscoveredTool[]
  lists: McpPrimitiveLists
  serverInfo?: McpServerInfo
  detectedTransport?: 'stdio' | 'streamable-http' | 'sse'
}

const EMPTY_LISTS: McpPrimitiveLists = {
  resources: [],
  resourceTemplates: [],
  prompts: [],
}

/** A discovery result carrying nothing; used before any read. */
export const EMPTY_DISCOVERY: McpDiscovery = { tools: [], lists: EMPTY_LISTS }

/**
 * Normalize one probe or cache response into a discovery result.
 *
 * The single parser for every caller. `tools` is read from `toolDetails`
 * only: the old `tools`-as-number fallback described a projection this
 * endpoint never returns, and accepting it made two call sites disagree about
 * what the same response meant.
 *
 * @param payload - a raw probe or cache response.
 * @returns the normalized discovery; absent fields become empty arrays.
 */
export function discoveryFromResponse(payload: unknown): McpDiscovery {
  const data = (payload ?? {}) as {
    toolDetails?: unknown
    serverInfo?: McpServerInfo
    detectedTransport?: 'stdio' | 'streamable-http' | 'sse'
  }
  return {
    tools: Array.isArray(data.toolDetails)
      ? (data.toolDetails as McpDiscoveredTool[])
      : [],
    lists: listsFromResponse(data as never),
    serverInfo: data.serverInfo,
    detectedTransport: data.detectedTransport,
  }
}

/**
 * The server-list fields one discovery implies.
 *
 * The single field table: the global tab and the session page both apply this
 * patch, so a newly discovered primitive cannot reach one and miss the other.
 * `capabilities` rides in the lists because an empty list alone cannot say
 * whether a server declares a primitive at all.
 */
export function serverPatch(
  discovery: McpDiscovery,
): Partial<GlobalMcpServerConfig> {
  const { lists } = discovery
  return {
    toolDetails: discovery.tools,
    tools: discovery.tools.length,
    resourceDetails: lists.resources,
    resourceTemplateDetails: lists.resourceTemplates,
    promptDetails: lists.prompts,
    capabilities: lists.capabilities,
    resourceCount: lists.resources.length,
    resourceTemplateCount: lists.resourceTemplates.length,
    promptCount: lists.prompts.length,
    ...(discovery.serverInfo ? { serverInfo: discovery.serverInfo } : {}),
    ...(discovery.detectedTransport
      ? { detectedTransport: discovery.detectedTransport }
      : {}),
    lastTestedAt: Date.now(),
  }
}

/**
 * Stable identity for one resource row's read state.
 *
 * Template form is keyed by the template string rather than an expanded URI:
 * the panel needs the key BEFORE the read succeeds, and expansion happens
 * server-side.
 */
export function resourceTargetKey(args: {
  uri?: string
  uriTemplate?: string
}): string {
  return args.uri ? `uri:${args.uri}` : `tpl:${args.uriTemplate ?? ''}`
}
