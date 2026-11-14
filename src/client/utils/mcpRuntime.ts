import type { GlobalMcpServerConfig } from '../types/index.ts'

/**
 * Whether the official client for this server looks broken, and why.
 *
 * Reads the host's published connection state. There is no inference layer: the
 * official client owns the truth about its own connection, including which
 * terminal failure it hit, and a second guess derived from a tool count could
 * only disagree with it.
 */

/** The reason to show beside a broken server, or undefined when healthy. */
export function mcpClientFailureReason(
  server: GlobalMcpServerConfig,
): string | undefined {
  const runtime = server.runtime
  if (!runtime) return undefined
  // An activation failure means no instance exists to have a connection state.
  if (runtime.lastError) return runtime.lastError
  const connection = runtime.connection
  if (!connection) return undefined
  switch (connection.state) {
    case 'failed':
      return connection.reason === 'unclosed-generation'
        ? "This server's previous connection could not be confirmed closed; the host blocks replacement until it restarts."
        : (connection.lastError ?? `Connection stopped (${connection.reason}).`)
    case 'waiting-credentials':
      return connection.lastError
    case 'closed':
      return 'The connection is closed.'
    default:
      return undefined
  }
}

/**
 * Whether the official client for this server looks broken.
 *
 * Only the states that mean "not connected and not getting there" count:
 * `connecting` and `reconnecting` are progress, and a server whose tools have
 * not registered yet is not accused of being broken.
 */
export function isMcpClientUnavailable(server: GlobalMcpServerConfig): boolean {
  return mcpClientFailureReason(server) !== undefined
}
