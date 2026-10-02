import * as React from 'react'
import {
  type GlobalMcpServerConfig,
  type McpDiscoveredTool,
  type McpPromptGetResult,
  type McpResourceReadResult,
  type McpServerInfo,
  API_ENDPOINTS,
  API_METHODS,
} from '../../types/index.ts'
import {
  listsFromResponse,
  type McpPrimitiveLists,
} from '../../utils/mcpPrimitives.ts'

/**
 * The four primitives one server declares, as a single discovery result.
 *
 * Re-exported from the pure utils module so the panel, this hook, and the host
 * pages all name one type. `capabilities` rides alongside the lists because an
 * empty list alone is ambiguous: the MCP SDK answers a `list*` call for an
 * unadvertised capability with an empty result rather than an error, so only the
 * flags can tell "declares nothing" from "does not support this".
 */
export type { McpPrimitiveLists } from '../../utils/mcpPrimitives.ts'

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

const EMPTY_DISCOVERY: McpDiscovery = { tools: [], lists: EMPTY_LISTS }

/** Read state for one on-demand resource read. */
export interface ResourceReadState {
  loading: boolean
  error?: string
  result?: McpResourceReadResult
  /**
   * Identity of the row this state belongs to (`uri:<uri>` or `tpl:<template>`).
   * The panel renders many rows against one shared read slot, so without this a
   * row could not tell whether a result was its own — a template read in
   * particular has no `uri` to compare against before expansion.
   */
  targetKey?: string
  /** The URI the displayed result belongs to, so a refresh can repeat it. */
  uri?: string
}

/** One resource read request as the panel expresses it. */
export interface ResourceReadRequest {
  uri?: string
  uriTemplate?: string
  variables?: Record<string, string>
}

/** Fetch state for one on-demand prompt render. */
export interface PromptGetState {
  loading: boolean
  error?: string
  result?: McpPromptGetResult
  /** Prompt name this state belongs to; the panel renders many rows per slot. */
  targetName?: string
}

export interface UseMcpPrimitivesOptions {
  /** The server whose primitives are shown. Null closes the panel. */
  server: Partial<GlobalMcpServerConfig> | null
  /**
   * Publish a completed discovery to the host so its server list and modal
   * target stay in step. Called after both a probe and a cache read.
   */
  onDiscovery?: (discovery: McpDiscovery) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export interface UseMcpPrimitivesResult {
  /** Tools of the current server. */
  tools: McpDiscoveredTool[]
  lists: McpPrimitiveLists
  serverInfo?: McpServerInfo
  detectedTransport?: 'stdio' | 'streamable-http' | 'sse'
  /**
   * One loading flag and one error for ALL THREE tabs.
   *
   * The probe returns every primitive in a single connection, so the tools,
   * resource, and prompt tabs are three views of one request. Separate flags
   * would let one tab claim to be loading while another claimed to have failed.
   */
  loading: boolean
  error?: string
  /** True once cached data has been read or a probe has completed. */
  loaded: boolean
  /**
   * Refresh every primitive from one probe.
   *
   * Shared by all three tabs, so any refresh button updates the whole panel and
   * only one request leaves the browser.
   */
  refresh: () => Promise<void>
  resourceRead: ResourceReadState
  readResource: (args: ResourceReadRequest) => Promise<void>
  promptGet: PromptGetState
  getPrompt: (name: string, args?: Record<string, string>) => Promise<void>
}

/**
 * Stable identity for one resource row's read state.
 *
 * Template form is keyed by the template string rather than an expanded URI:
 * the panel needs the key BEFORE the read succeeds, and expansion happens
 * server-side.
 */
export function resourceTargetKey(args: ResourceReadRequest): string {
  return args.uri ? `uri:${args.uri}` : `tpl:${args.uriTemplate ?? ''}`
}

/** Whether any list actually carries entries (flags alone do not count). */
function hasEntries(lists: McpPrimitiveLists): boolean {
  return (
    lists.resources.length > 0 ||
    lists.resourceTemplates.length > 0 ||
    lists.prompts.length > 0
  )
}

/**
 * Own one server's whole discovery surface for the management modal.
 *
 * All three tabs consume this: tools, resources/templates, and prompts are four
 * views of a single probe, so one hook owns the request, one loading flag, one
 * error, and one `refresh`. Splitting them across two state machines — as an
 * earlier revision did — let the tools tab and the primitive tabs disagree about
 * whether the same request was in flight.
 *
 * The open path is cache-first: the payload the caller already holds is used
 * when it carries entries, otherwise the cache endpoint is read. That endpoint
 * never opens a connection, so only an explicit refresh reaches the server.
 */
export function useMcpPrimitives({
  server,
  onDiscovery,
  t,
}: UseMcpPrimitivesOptions): UseMcpPrimitivesResult {
  const [discovery, setDiscovery] =
    React.useState<McpDiscovery>(EMPTY_DISCOVERY)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | undefined>()
  const [loaded, setLoaded] = React.useState(false)

  const [resourceRead, setResourceRead] = React.useState<ResourceReadState>({
    loading: false,
  })
  const [promptGet, setPromptGet] = React.useState<PromptGetState>({
    loading: false,
  })

  const serverId = server?.id

  // Keep the publish callback in a ref so the seed effect does not re-run merely
  // because the host handed us a new closure.
  const publish = React.useRef(onDiscovery)
  React.useEffect(() => {
    publish.current = onDiscovery
  }, [onDiscovery])

  React.useEffect(() => {
    if (!server) {
      setDiscovery(EMPTY_DISCOVERY)
      setLoaded(false)
      setError(undefined)
      setResourceRead({ loading: false })
      setPromptGet({ loading: false })
      return
    }

    let cancelled = false
    setResourceRead({ loading: false })
    setPromptGet({ loading: false })
    setError(undefined)
    setLoaded(false)

    const seededTools = Array.isArray(server.toolDetails)
      ? server.toolDetails
      : []
    const seededLists = listsFromResponse(server)

    // Only actual ENTRIES count as a seed. `capabilities` deliberately does not:
    // the server-list projection strips the detail arrays but keeps the flags, so
    // treating a bare flag as "already loaded" would skip the cache read and then
    // report "declares resources but provides none" for a server whose cached
    // list is sitting in the store.
    if (seededTools.length > 0 || hasEntries(seededLists)) {
      setDiscovery({
        tools: seededTools,
        lists: seededLists,
        serverInfo: server.serverInfo,
        detectedTransport: server.detectedTransport,
      })
      setLoaded(true)
      return
    }

    setDiscovery(EMPTY_DISCOVERY)

    if (!serverId) return

    void (async () => {
      try {
        const res = await fetch(
          `${API_ENDPOINTS.mcpServersCache}?id=${encodeURIComponent(serverId)}`,
        )
        const data = await res.json()
        if (cancelled || !data?.ok) return

        const cachedLists = listsFromResponse(data)

        // Here the flags DO count, because this response IS the cache: a set
        // capability with empty lists genuinely means "declares it, exposes
        // none", which is the distinction the panel renders.
        const cachedHasAny =
          hasEntries(cachedLists) || cachedLists.capabilities !== undefined
        if (!cachedHasAny) return

        const next: McpDiscovery = {
          tools: Array.isArray(data.toolDetails) ? data.toolDetails : [],
          lists: cachedLists,
          serverInfo: data.serverInfo,
          detectedTransport: data.detectedTransport,
        }
        setDiscovery(next)
        setLoaded(true)
        publish.current?.(next)
      } catch {
        // A failed cache read is not an error the user must see; an explicit
        // refresh reports its own failures.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    server,
    serverId,
    server?.toolDetails,
    server?.resourceDetails,
    server?.resourceTemplateDetails,
    server?.promptDetails,
    server?.capabilities,
    server?.serverInfo,
    server?.detectedTransport,
  ])

  /**
   * Refresh every primitive from ONE probe.
   *
   * Shared by all three tabs: the probe reports tools, resources, templates, and
   * prompts over a single connection, so there is nothing to gain from a
   * per-tab request and something to lose (divergent spinners and errors).
   */
  const refresh = React.useCallback(async () => {
    if (!server) return
    setLoading(true)
    setError(undefined)
    try {
      const res = await fetch(API_ENDPOINTS.mcpServersProbe, {
        method: API_METHODS.mcpServersProbe,
        headers: { 'Content-Type': 'application/json' },
        // Only the connection-relevant fields travel: the discovered lists are
        // an output of this call, never an input to it.
        body: JSON.stringify({ server }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        setError(
          typeof data?.message === 'string'
            ? data.message
            : t('mcpServers.primitives.fetchFailed'),
        )
        return
      }

      const next: McpDiscovery = {
        tools: Array.isArray(data.toolDetails) ? data.toolDetails : [],
        lists: listsFromResponse(data),
        serverInfo: data.serverInfo,
        detectedTransport: data.detectedTransport,
      }
      setDiscovery(next)
      setLoaded(true)
      publish.current?.(next)
    } catch (err: unknown) {
      setError(
        `${t('mcpServers.primitives.fetchFailed')}${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setLoading(false)
    }
  }, [server, t])

  /** Read one resource (literal URI or expanded template). */
  const readResource = React.useCallback(
    async (args: ResourceReadRequest) => {
      if (!server) return
      const targetKey = resourceTargetKey(args)
      setResourceRead({ loading: true, targetKey, uri: args.uri })
      try {
        const res = await fetch(API_ENDPOINTS.mcpServersResourceRead, {
          method: API_METHODS.mcpServersResourceRead,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            server,
            ...(args.uri ? { uri: args.uri } : {}),
            ...(args.uriTemplate ? { uriTemplate: args.uriTemplate } : {}),
            ...(args.variables ? { variables: args.variables } : {}),
          }),
        })
        const data = (await res.json()) as McpResourceReadResult
        if (!data?.ok) {
          setResourceRead({
            loading: false,
            targetKey,
            error: data?.message || t('mcpServers.primitives.readFailed'),
          })
          return
        }
        setResourceRead({
          loading: false,
          targetKey,
          result: data,
          uri: data.uri,
        })
      } catch (err: unknown) {
        setResourceRead({
          loading: false,
          targetKey,
          error: `${t('mcpServers.primitives.readFailed')}${err instanceof Error ? err.message : String(err)}`,
        })
      }
    },
    [server, t],
  )

  /** Render one prompt template with the caller's argument values. */
  const getPrompt = React.useCallback(
    async (name: string, args?: Record<string, string>) => {
      if (!server) return
      setPromptGet({ loading: true, targetName: name })
      try {
        const res = await fetch(API_ENDPOINTS.mcpServersPromptGet, {
          method: API_METHODS.mcpServersPromptGet,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            server,
            name,
            ...(args && Object.keys(args).length > 0
              ? { arguments: args }
              : {}),
          }),
        })
        const data = (await res.json()) as McpPromptGetResult
        if (!data?.ok) {
          setPromptGet({
            loading: false,
            targetName: name,
            error: data?.message || t('mcpServers.primitives.getFailed'),
          })
          return
        }
        setPromptGet({ loading: false, targetName: name, result: data })
      } catch (err: unknown) {
        setPromptGet({
          loading: false,
          targetName: name,
          error: `${t('mcpServers.primitives.getFailed')}${err instanceof Error ? err.message : String(err)}`,
        })
      }
    },
    [server, t],
  )

  return {
    tools: discovery.tools,
    lists: discovery.lists,
    serverInfo: discovery.serverInfo,
    detectedTransport: discovery.detectedTransport,
    loading,
    error,
    loaded,
    refresh,
    resourceRead,
    readResource,
    promptGet,
    getPrompt,
  }
}
