/**
 * Discovery of one server's declared primitives over a live connection.
 *
 * Tools, resources, and prompts are collected together because they come from
 * the same handshake: the capability snapshot, server version, and negotiated
 * protocol all describe one connection, and splitting them across calls would
 * mean reconnecting to ask the same server what it supports.
 *
 * The capability flags are load-bearing rather than decorative. The MCP SDK
 * answers a `list*` call for a capability the server never advertised with an
 * EMPTY LIST and a console warning — not an error — so an empty result alone
 * cannot distinguish "declares nothing" from "does not support this". Only the
 * flags can, and the panel needs that distinction to avoid telling a
 * tools-only server that it has zero resources.
 */

import { UriTemplate, type Client } from '@modelcontextprotocol/client'
import type {
  McpDiscoveredPrompt,
  McpDiscoveredResource,
  McpDiscoveredResourceTemplate,
  McpDiscoveredTool,
  McpServerCapabilities,
  McpServerInfo,
} from '../../../types.ts'

/** Everything one connection revealed about its server. */
export interface McpDiscovery {
  toolDetails: McpDiscoveredTool[]
  resourceDetails: McpDiscoveredResource[]
  resourceTemplateDetails: McpDiscoveredResourceTemplate[]
  promptDetails: McpDiscoveredPrompt[]
  capabilities: McpServerCapabilities
  serverInfo: McpServerInfo
  supportedVersions: string[]
}

/** Options shared by every request on one discovery pass. */
interface RequestOptions {
  timeout: number
  signal: AbortSignal
}

/** Narrow an unknown value to a string, or undefined. */
function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** Narrow an unknown value to a finite number, or undefined. */
function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Build the per-request deadline options for one pass. */
function requestOptions(timeoutMs: number): RequestOptions {
  return { timeout: timeoutMs, signal: AbortSignal.timeout(timeoutMs) }
}

/**
 * Read a server's declared capabilities as booleans.
 *
 * Presence, not truthiness of the inner object: the spec defines the capability
 * as an object (possibly empty), so `resources: {}` still means "supported".
 */
function readCapabilities(client: Client): McpServerCapabilities {
  const caps = client.getServerCapabilities()
  return {
    tools: caps?.tools !== undefined,
    resources: caps?.resources !== undefined,
    prompts: caps?.prompts !== undefined,
  }
}

/** Project the SDK's Tool list onto the wire-forward shape. */
function mapTools(raw: unknown): McpDiscoveredTool[] {
  if (!Array.isArray(raw)) return []
  return raw.map((tool) => {
    const item = (tool ?? {}) as Record<string, unknown>
    return {
      name:
        typeof tool === 'string'
          ? tool
          : asString(item.name) || asString(item.id) || '',
      description: asString(item.description),
      inputSchema:
        item.inputSchema && typeof item.inputSchema === 'object'
          ? (item.inputSchema as Record<string, unknown>)
          : undefined,
    }
  })
}

/** Project the SDK's Resource list onto the wire-forward shape. */
function mapResources(raw: unknown): McpDiscoveredResource[] {
  if (!Array.isArray(raw)) return []
  const mapped: McpDiscoveredResource[] = []
  for (const resource of raw) {
    const item = (resource ?? {}) as Record<string, unknown>
    const uri = asString(item.uri)
    // A resource without a URI cannot be read, so it cannot be listed as one.
    if (!uri) continue
    mapped.push({
      uri,
      name: asString(item.name) || uri,
      title: asString(item.title),
      description: asString(item.description),
      mimeType: asString(item.mimeType),
      size: asNumber(item.size),
    })
  }
  return mapped
}

/**
 * Project resource templates, resolving each one's variable names.
 *
 * `UriTemplate.variableNames` is the SDK's own RFC 6570 parse, so the set the
 * panel prompts for is exactly the set `expand` will consume. A template with no
 * expressions (`docs://readme`) keeps an empty name list and is still listed
 * rather than dropped: it is a server-declared entry, and an empty form reads it
 * immediately. Only a genuinely malformed template is skipped, because offering
 * a fill-in form whose expansion would throw helps no one.
 */
function mapResourceTemplates(raw: unknown): McpDiscoveredResourceTemplate[] {
  if (!Array.isArray(raw)) return []
  const mapped: McpDiscoveredResourceTemplate[] = []
  for (const template of raw) {
    const item = (template ?? {}) as Record<string, unknown>
    const uriTemplate = asString(item.uriTemplate)
    if (!uriTemplate) continue

    let variableNames: string[] = []
    try {
      const parsed = new UriTemplate(uriTemplate)
      variableNames = parsed.variableNames
    } catch {
      // A malformed template is not usable; drop it rather than offer a
      // fill-in form whose expansion would throw later.
      continue
    }

    mapped.push({
      uriTemplate,
      name: asString(item.name) || uriTemplate,
      title: asString(item.title),
      description: asString(item.description),
      mimeType: asString(item.mimeType),
      variableNames,
    })
  }
  return mapped
}

/** Project the SDK's Prompt list onto the wire-forward shape. */
function mapPrompts(raw: unknown): McpDiscoveredPrompt[] {
  if (!Array.isArray(raw)) return []
  const mapped: McpDiscoveredPrompt[] = []
  for (const prompt of raw) {
    const item = (prompt ?? {}) as Record<string, unknown>
    const name = asString(item.name)
    if (!name) continue

    const rawArgs = Array.isArray(item.arguments) ? item.arguments : []
    const args = rawArgs
      .map((arg) => {
        const entry = (arg ?? {}) as Record<string, unknown>
        const argName = asString(entry.name)
        if (!argName) return undefined
        return {
          name: argName,
          description: asString(entry.description),
          required: entry.required === true,
        }
      })
      .filter((arg): arg is NonNullable<typeof arg> => arg !== undefined)

    mapped.push({
      name,
      title: asString(item.title),
      description: asString(item.description),
      arguments: args.length > 0 ? args : undefined,
    })
  }
  return mapped
}

/**
 * Collect every primitive the connected server declares.
 *
 * Each list call is isolated: a server that advertises `resources` but fails the
 * call contributes an empty list and leaves the rest of the discovery intact, so
 * one broken primitive cannot blank the whole panel. The corresponding
 * capability flag is downgraded to false in that case, keeping the flag an
 * honest report of what actually came back.
 *
 * @param client - already-connected client.
 * @param timeoutMs - per-request deadline.
 * @returns the collected primitives, capabilities, and server identity.
 */
export async function collectDiscovery(
  client: Client,
  timeoutMs: number,
): Promise<McpDiscovery> {
  const opts = requestOptions(timeoutMs)
  const capabilities = readCapabilities(client)

  const toolDetails = await (async () => {
    try {
      const result = await client.listTools(undefined, opts)
      return mapTools(result?.tools)
    } catch {
      capabilities.tools = false
      return []
    }
  })()

  const resourceDetails = await (async () => {
    if (!capabilities.resources) return []
    try {
      const result = await client.listResources(undefined, opts)
      return mapResources(result?.resources)
    } catch {
      capabilities.resources = false
      return []
    }
  })()

  const resourceTemplateDetails = await (async () => {
    if (!capabilities.resources) return []
    try {
      const result = await client.listResourceTemplates(undefined, opts)
      return mapResourceTemplates(result?.resourceTemplates)
    } catch {
      // A server may serve literal resources without templates; that is a
      // narrower surface, not a broken one, so the capability stays true.
      return []
    }
  })()

  const promptDetails = await (async () => {
    if (!capabilities.prompts) return []
    try {
      const result = await client.listPrompts(undefined, opts)
      return mapPrompts(result?.prompts)
    } catch {
      capabilities.prompts = false
      return []
    }
  })()

  const serverVersion = client.getServerVersion()
  const protocolVersion = client.getNegotiatedProtocolVersion()
  const discoverResult = client.getDiscoverResult()
  const supportedVersions: string[] =
    discoverResult && Array.isArray(discoverResult.supportedVersions)
      ? discoverResult.supportedVersions
      : protocolVersion
        ? [protocolVersion]
        : []

  return {
    toolDetails,
    resourceDetails,
    resourceTemplateDetails,
    promptDetails,
    capabilities,
    serverInfo: {
      name: serverVersion?.name,
      title: serverVersion?.title,
      version: serverVersion?.version,
      description: serverVersion?.description,
      websiteUrl: serverVersion?.websiteUrl,
      icons: serverVersion?.icons,
      protocolVersion,
      supportedVersions,
    },
    supportedVersions,
  }
}
