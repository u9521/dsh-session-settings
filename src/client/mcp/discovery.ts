import * as React from 'react'
import type {
  GlobalMcpServerConfig,
  McpPromptGetResult,
  McpProbeResult,
  McpResourceReadResult,
} from '../types/index.ts'
import { API_ENDPOINTS, API_METHODS } from '../types/index.ts'
import {
  listsFromResponse,
  type McpPrimitiveLists,
} from '../utils/mcpPrimitives.ts'
import {
  EMPTY_DISCOVERY,
  discoveryFromResponse,
  resourceTargetKey,
  type McpDiscovery,
} from '../utils/mcpDiscovery.ts'

export type { McpDiscovery } from '../utils/mcpDiscovery.ts'
export { serverPatch, resourceTargetKey } from '../utils/mcpDiscovery.ts'

/**
 * The MCP discovery face: one probe, one result shape, one patch.
 *
 * Discovery used to be assembled in three places — five probe call sites each
 * parsing the response themselves, two copies of the field-by-field write-back
 * to the server list, and a hook whose twelve flat members the host had to
 * re-seed through a callback. This module owns the parse, the patch, and the
 * state machine, so a caller names what it wants instead of rebuilding it.
 */

/** Read state for one on-demand resource read. */
export interface ResourceReadState {
  loading: boolean
  error?: string
  result?: McpResourceReadResult
  /** Identity of the row this state belongs to; the panel renders many rows. */
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
  /** Prompt name this state belongs to. */
  targetName?: string
}

/**
 * Probe one server over a single connection.
 *
 * The one request every caller shares: the discovery panel, the card's test
 * action, and the form's pre-save check all send the same body and need the
 * same normalized result. What differs is only how a failure is presented, so
 * this returns the outcome and lets the caller decide.
 *
 * @param server - the connection-relevant fields (discovered lists are output).
 * @returns the discovery plus the probe's own ok/message, or a failure.
 */
export async function probeServer(
  server: Partial<GlobalMcpServerConfig>,
): Promise<{ ok: boolean; message?: string; discovery?: McpDiscovery }> {
  try {
    const res = await fetch(API_ENDPOINTS.mcpServersProbe, {
      method: API_METHODS.mcpServersProbe,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server }),
    })
    const data = (await res.json()) as McpProbeResult & {
      ok?: boolean
      message?: string
    }
    if (!res.ok || !data?.ok) {
      return { ok: false, message: data?.message }
    }
    return {
      ok: true,
      message: data.message,
      discovery: discoveryFromResponse(data),
    }
  } catch (err: unknown) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Whether any list actually carries entries (flags alone do not count). */
function hasEntries(lists: McpPrimitiveLists): boolean {
  return (
    lists.resources.length > 0 ||
    lists.resourceTemplates.length > 0 ||
    lists.prompts.length > 0
  )
}

/** The discovery state machine: exactly one status at a time. */
export type DiscoveryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; discovery: McpDiscovery }
  | { status: 'error'; message: string }

export interface UseMcpDiscoveryOptions {
  /** The server whose primitives are shown. Null closes the panel. */
  server: Partial<GlobalMcpServerConfig> | null
  t: (key: string, vars?: Record<string, string | number>) => string
}

export interface McpDiscoveryController {
  state: DiscoveryState
  /** The discovery of the current server, empty while idle or loading. */
  discovery: McpDiscovery
  /** Probe every primitive over one connection. */
  refresh: () => Promise<McpDiscovery | undefined>
  readResource: (args: ResourceReadRequest) => Promise<void>
  getPrompt: (name: string, args?: Record<string, string>) => Promise<void>
  /** The read state of one resource row, or an idle placeholder. */
  readState: (targetKey: string) => ResourceReadState
  promptGet: PromptGetState
}

/**
 * Own one server's discovery: the request, the state machine, and the reads.
 *
 * The open path is cache-first: the payload the caller already holds is used
 * when it carries entries, otherwise the cache endpoint is read. That endpoint
 * never opens a connection, so only an explicit refresh reaches the server.
 */
export function useMcpDiscovery({
  server,
  t,
}: UseMcpDiscoveryOptions): McpDiscoveryController {
  const [state, setState] = React.useState<DiscoveryState>({ status: 'idle' })
  const [resourceRead, setResourceRead] = React.useState<ResourceReadState>({
    loading: false,
  })
  const [promptGet, setPromptGet] = React.useState<PromptGetState>({
    loading: false,
  })

  const serverId = server?.id

  React.useEffect(() => {
    if (!server) {
      setState({ status: 'idle' })
      setResourceRead({ loading: false })
      setPromptGet({ loading: false })
      return
    }

    let cancelled = false
    setResourceRead({ loading: false })
    setPromptGet({ loading: false })

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
      setState({
        status: 'ready',
        discovery: {
          tools: seededTools,
          lists: seededLists,
          serverInfo: server.serverInfo,
          detectedTransport: server.detectedTransport,
        },
      })
      return
    }

    setState({ status: 'loading' })
    if (!serverId) {
      setState({ status: 'idle' })
      return
    }

    void (async () => {
      try {
        const res = await fetch(
          `${API_ENDPOINTS.mcpServersCache}?id=${encodeURIComponent(serverId)}`,
        )
        const data = await res.json()
        if (cancelled) return
        if (!data?.ok) {
          setState({ status: 'idle' })
          return
        }

        const cachedLists = listsFromResponse(data)
        // Here the flags DO count, because this response IS the cache: a set
        // capability with empty lists genuinely means "declares it, exposes
        // none", which is the distinction the panel renders.
        const cachedHasAny =
          hasEntries(cachedLists) || cachedLists.capabilities !== undefined
        setState(
          cachedHasAny
            ? { status: 'ready', discovery: discoveryFromResponse(data) }
            : { status: 'idle' },
        )
      } catch {
        // A failed cache read is not an error the user must see; an explicit
        // refresh reports its own failures.
        if (!cancelled) setState({ status: 'idle' })
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
  const refresh = React.useCallback(async (): Promise<
    McpDiscovery | undefined
  > => {
    if (!server) return undefined
    setState({ status: 'loading' })
    try {
      const res = await fetch(API_ENDPOINTS.mcpServersProbe, {
        method: API_METHODS.mcpServersProbe,
        headers: { 'Content-Type': 'application/json' },
        // Only the connection-relevant fields travel: the discovered lists are
        // an output of this call, never an input to it.
        body: JSON.stringify({ server }),
      })
      const data = (await res.json()) as McpProbeResult & {
        ok?: boolean
        message?: string
      }
      if (!res.ok || !data?.ok) {
        setState({
          status: 'error',
          message:
            typeof data?.message === 'string'
              ? data.message
              : t('mcpServers.primitives.fetchFailed'),
        })
        return undefined
      }

      const discovery = discoveryFromResponse(data)
      setState({ status: 'ready', discovery })
      return discovery
    } catch (err: unknown) {
      setState({
        status: 'error',
        message: `${t('mcpServers.primitives.fetchFailed')}${err instanceof Error ? err.message : String(err)}`,
      })
      return undefined
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

  /** The read state of one row; every other row sees an idle placeholder. */
  const readState = React.useCallback(
    (targetKey: string): ResourceReadState =>
      resourceRead.targetKey === targetKey ? resourceRead : { loading: false },
    [resourceRead],
  )

  return {
    state,
    discovery: state.status === 'ready' ? state.discovery : EMPTY_DISCOVERY,
    refresh,
    readResource,
    getPrompt,
    readState,
    promptGet,
  }
}
