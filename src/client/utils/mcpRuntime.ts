import type { GlobalMcpServerConfig } from '../types/index.ts'

/**
 * How long a fresh mount may sit at zero tools before it counts as failed.
 *
 * A stdio handshake is normally well under a second, but `listTools` against a
 * large catalogue is not, and a status snapshot taken inside that window is not
 * a failure. Without this the badge fired on every save, because saving
 * remounted every enabled server and the client read the status immediately.
 */
export const MCP_CLIENT_SETTLE_GRACE_MS = 10_000

/**
 * Tool count cached by the last probe.
 *
 * `getSanitizedServers()` reduces the persisted `tools` array to a number for
 * the client, so this is how many tools the server is known to expose.
 */
export function expectedToolCount(server: GlobalMcpServerConfig): number {
  if (typeof server.tools === 'number') return server.tools
  return Array.isArray(server.tools) ? server.tools.length : 0
}

/**
 * Whether the official client for this server looks broken.
 *
 * `registeredToolCount === 0` is ambiguous on its own: it means either that the
 * handshake has not finished or that the bridge exhausted its reconnect budget
 * and unregistered everything. The mount timestamp separates the two, and a
 * server that exposes no tools at all (resources-only) is never accused.
 *
 * `now` is injected so the decision is deterministically testable.
 */
export function isMcpClientUnavailable(
  server: GlobalMcpServerConfig,
  now: number = Date.now(),
): boolean {
  const runtime = server.runtime
  if (!runtime) return false
  // An activation/config error does not self-heal, so it never waits.
  if (runtime.lastError) return true
  if (!runtime.mountAttempted) return false
  if (runtime.registeredToolCount > 0) return false
  // Zero tools registered: nothing to expect from a resources-only server.
  if (expectedToolCount(server) === 0) return false
  const startedAt = runtime.mountStartedAt
  // Age unknown: do not accuse a mount we cannot date.
  if (startedAt === undefined) return false
  return now - startedAt > MCP_CLIENT_SETTLE_GRACE_MS
}
