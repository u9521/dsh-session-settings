/**
 * The `.mcp.json` wire format for MCP server import and export.
 *
 * One mapping, shared by both halves: the browser builds the exported document
 * from it, the Node side parses an imported document with it. Splitting the two
 * is what let an export lose every stdio server — the exporter wrote no
 * `type`, and the importer only inferred HTTP from a `url`.
 *
 * The shape is Claude Code's, not ours: an object keyed by server name whose
 * entries discriminate on `type` (`stdio` | `sse` | `http` | `ws`). Claude Code
 * keeps it in `.mcp.json`; its `settings.json` schema does not define servers
 * at all, only the approval lists that name them. A `type`-less entry with a
 * `command` is stdio by that format's own rule, which is also why our pre-format
 * export files still import.
 *
 * Fields Claude Code does not know (`id`, `name`, `cwd`, timeouts, reconnect,
 * `disabledTools`, timestamps) ride along as extra keys on the same entry: the
 * format's entry schema does not forbid additional properties, so they survive
 * a round trip here and are ignored there.
 *
 * This module is PURE — no `node:*`, no host package, no React.
 */
import type { GlobalMcpServerConfig } from '../types.ts'

/** What a `.mcp.json` entry may state. Values outside this set are rejected. */
export type McpDocumentType = 'stdio' | 'sse' | 'http' | 'ws'

/** One entry of the document, as written by us and as read by Claude Code. */
export interface McpDocumentEntry {
  type?: McpDocumentType
  // stdio
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  // remote
  url?: string
  headers?: Record<string, string>
  // Ours, carried alongside the format's own keys.
  id?: string
  name?: string
  description?: string
  toolCallTimeoutMs?: number
  failOnStartupError?: boolean
  maxInstructionBytes?: number
  reconnect?: {
    enabled?: boolean
    initialDelayMs?: number
    maxDelayMs?: number
    maxAttempts?: number
  }
  disabledTools?: string[]
  createdAt?: number
  updatedAt?: number
}

/** The document itself: `{ "mcpServers": { <name>: <entry> } }`. */
export interface McpDocument {
  mcpServers: Record<string, McpDocumentEntry>
}

/** One entry the importer refused, with the reason shown to the user. */
export interface McpImportSkip {
  /** The document key, so the user can find the entry they wrote. */
  key: string
  reason: string
}

/**
 * The type an entry is written as.
 *
 * `sse` and `http` are distinct in the document but one transport here, so the
 * last observed transport is what gets written back: a server that negotiated
 * SSE is exported as `sse`, not flattened into `http`.
 */
export function documentTypeOf(server: GlobalMcpServerConfig): McpDocumentType {
  if (server.transport === 'stdio') return 'stdio'
  return server.detectedTransport === 'sse' ? 'sse' : 'http'
}

/**
 * Project one stored server into its document entry.
 *
 * Every connection-relevant field is written, including `id`: the key carries
 * the name, so an id that differs from it (or was renamed) would otherwise be
 * lost on import. Discovery caches are deliberately absent — they are
 * observations about a past connection, not configuration, and a restored
 * cache would describe a server this process has never spoken to.
 */
export function toDocumentEntry(
  server: GlobalMcpServerConfig,
): McpDocumentEntry {
  const entry: McpDocumentEntry = {
    type: documentTypeOf(server),
    id: server.id,
    name: server.name,
  }
  if (server.description) entry.description = server.description
  if (server.transport === 'stdio') {
    entry.command = server.command
    if (server.args?.length) entry.args = server.args
    if (server.env && Object.keys(server.env).length > 0) entry.env = server.env
    if (server.cwd) entry.cwd = server.cwd
  } else {
    entry.url = server.url
    if (server.headers && Object.keys(server.headers).length > 0) {
      entry.headers = server.headers
    }
  }
  if (server.toolCallTimeoutMs !== undefined) {
    entry.toolCallTimeoutMs = server.toolCallTimeoutMs
  }
  if (server.failOnStartupError !== undefined) {
    entry.failOnStartupError = server.failOnStartupError
  }
  if (server.maxInstructionBytes !== undefined) {
    entry.maxInstructionBytes = server.maxInstructionBytes
  }
  if (server.reconnect) entry.reconnect = server.reconnect
  if (Array.isArray(server.disabledTools) && server.disabledTools.length > 0) {
    entry.disabledTools = server.disabledTools
  }
  if (server.createdAt !== undefined) entry.createdAt = server.createdAt
  if (server.updatedAt !== undefined) entry.updatedAt = server.updatedAt
  return entry
}

/**
 * Build the whole exported document.
 *
 * Keyed by name, as the format requires — but names are not unique here (the
 * store allows two servers to share one) and a document is a map. A colliding
 * name therefore falls back to the id, which always is unique; the entry
 * carries both fields either way, so the import restores the name regardless of
 * which key carried it.
 */
export function toDocument(servers: GlobalMcpServerConfig[]): McpDocument {
  const mcpServers: Record<string, McpDocumentEntry> = {}
  for (const server of servers) {
    const nameKey = server.name || server.id
    const key = mcpServers[nameKey] === undefined ? nameKey : server.id
    mcpServers[key] = toDocumentEntry(server)
  }
  return { mcpServers }
}

/** Whether a string is safe to use as a server id (the official client's grammar). */
export function isValidServerId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,32}$/.test(id)
}

/**
 * The document key a server should be stored under.
 *
 * Ids are the official client's namespace, so a key outside that grammar cannot
 * be used verbatim. Unlike the old importer — which rewrote the id to `_` and
 * reported success — the caller is told, because `测试` becoming `_____` is
 * indistinguishable from data loss.
 */
export function serverIdFromKey(key: string): string | undefined {
  const trimmed = key.trim()
  return isValidServerId(trimmed) ? trimmed : undefined
}
