/**
 * One-shot MCP connection for on-demand discovery and reads.
 *
 * Every operation in this subsystem (probe, resource read, prompt fetch) needs
 * the same thing: open a transport for one configured server, run one call, and
 * close. Transport selection, timeout budgeting, the HTTP-to-SSE fallback, and
 * the stdio stderr diagnostics were previously inlined in the two probe runners;
 * read operations would have been a third copy, so they live here instead.
 *
 * This is deliberately NOT the official bridge: it opens a short-lived
 * connection for the GUI, never registers anything model-visible, and never
 * enters a session's context. The mounted official client remains the only
 * source of model-facing tools and resources.
 */

import {
  Client,
  SSEClientTransport,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import type { GlobalMcpServerConfig } from '../../../types.ts'

/** A connected client plus the transport it came from. */
export interface McpSession {
  client: Client
  detectedTransport: 'stdio' | 'streamable-http' | 'sse'
  close: () => Promise<void>
  /**
   * Transport-specific failure context captured so far (for stdio, the tail of
   * the child's stderr). Empty string when the transport has none. A caller
   * that fails AFTER connecting appends this so a post-handshake failure is as
   * diagnosable as a failed handshake.
   */
  diagnostics: () => string
}

/** Connected session, or the human-readable reason the connection could not open. */
export type McpConnectResult =
  { ok: true; session: McpSession } | { ok: false; message: string }

export interface McpConnectOptions {
  /**
   * Deadline for connect and for each request on the connection, in ms.
   * Callers derive this from `server.toolCallTimeoutMs` with a transport default.
   */
  timeoutMs: number
  /** Version-negotiation probe budget, in ms. */
  probeTimeoutMs: number
  /**
   * Wording for the failure prefix, e.g. `连接测试失败` for a probe or
   * `连接失败` for a read. Kept as a parameter so a read never reports itself
   * as a "test".
   */
  failureLabel: string
}

/** Resolved timeouts for one server, per transport. */
function resolveTimeouts(server: Partial<GlobalMcpServerConfig>): {
  timeoutMs: number
  probeTimeoutMs: number
} {
  const isStdio = server.transport === 'stdio'
  const fallback = isStdio ? 60000 : 30000
  const configured = server.toolCallTimeoutMs
  const timeoutMs =
    typeof configured === 'number' && configured > 0
      ? Math.max(configured, isStdio ? 5000 : 3000)
      : fallback
  const probeTimeoutMs = isStdio
    ? Math.min(Math.max(Math.floor(timeoutMs / 4), 5000), 15000)
    : Math.min(Math.max(Math.floor(timeoutMs / 3), 3000), 10000)
  return { timeoutMs, probeTimeoutMs }
}

/**
 * Whether one stored transport value is the HTTP family.
 *
 * `streamable-http-or-sse` and plain `sse` are legacy on-disk spellings: the
 * live store still contains entries written by an older release. They name the
 * same HTTP family, so they dispatch identically here and the concrete flavour
 * is settled during negotiation. Only a value that is neither stdio nor this
 * family is an unusable configuration.
 */
function isHttpTransport(transport: unknown): boolean {
  return (
    transport === 'streamable-http' ||
    transport === 'sse' ||
    transport === 'streamable-http-or-sse'
  )
}
/**
 * Connect to one configured server and hand back a live session.
 *
 * The caller owns the returned session and MUST close it. Every failure path
 * closes whatever it opened before returning, so a failed call leaks no child
 * process and no open stream.
 */
export async function connectMcpServer(
  server: Partial<GlobalMcpServerConfig>,
  override?: Partial<McpConnectOptions>,
): Promise<McpConnectResult> {
  const resolved = resolveTimeouts(server)
  const opts: McpConnectOptions = {
    timeoutMs: resolved.timeoutMs,
    probeTimeoutMs: resolved.probeTimeoutMs,
    failureLabel: '连接测试失败',
    ...override,
  }

  if (server.transport === 'stdio') return connectStdio(server, opts)
  if (isHttpTransport(server.transport)) return connectHttp(server, opts)

  return {
    ok: false,
    message: `${opts.failureLabel}: 不支持的传输协议 (${String(server.transport)})`,
  }
}

/** Open one client over a prepared transport, returning the raw error on failure. */
async function openClient(
  transport:
    StreamableHTTPClientTransport | SSEClientTransport | StdioClientTransport,
  opts: McpConnectOptions,
): Promise<
  { client: Client; error?: undefined } | { client: Client; error: Error }
> {
  const client = new Client(
    { name: 'dsh-mcp-tester', version: '1.0.0' },
    {
      versionNegotiation: {
        mode: 'auto',
        probe: { timeoutMs: opts.probeTimeoutMs, maxRetries: 0 },
      },
    },
  )

  try {
    await client.connect(transport, {
      timeout: opts.timeoutMs,
      signal: AbortSignal.timeout(opts.timeoutMs),
    })
    return { client }
  } catch (err: unknown) {
    // Close before reporting so a failed negotiation cannot leave the
    // transport (and, for stdio, the child process) running.
    await client.close().catch(() => {})
    return {
      client,
      error: err instanceof Error ? err : new Error(String(err)),
    }
  }
}

/** Human label for the negotiation budget, used in timeout diagnostics. */
function timeoutHint(opts: McpConnectOptions): string {
  return ` (已等待 ${Math.round(opts.timeoutMs / 1000)} 秒)`
}

/** Whether an error looks like a deadline rather than a protocol or network fault. */
function isTimeoutError(err: Error): boolean {
  return (
    err.name === 'TimeoutError' ||
    err.name === 'AbortError' ||
    /timeout|timed out|aborted/i.test(err.message)
  )
}

/**
 * Failure that indicates a reachable server answered a Streamable HTTP request
 * incompatibly. Only these justify an SSE downgrade; a network outage or a DNS
 * failure must not be retried as SSE, which would double the wait to report the
 * same unreachability.
 */
function looksLikeSseDowngrade(err: Error): boolean {
  const message = err.message
  const isNetworkOrTimeout =
    /fetch failed|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT|ECONNRESET|timeout/i.test(
      message,
    )
  if (isNetworkOrTimeout) return false
  return /unexpected content|405|text\/event-stream/i.test(message)
}

async function connectStdio(
  server: Partial<GlobalMcpServerConfig>,
  opts: McpConnectOptions,
): Promise<McpConnectResult> {
  const command = server.command?.trim()
  if (!command) {
    return { ok: false, message: 'stdio 模式需要填写启动命令 (command)' }
  }

  let stderrBuffer = ''
  const transport = new StdioClientTransport({
    command,
    args: server.args ?? [],
    env: server.env ?? {},
    cwd: server.cwd?.trim() || undefined,
    stderr: 'pipe',
  })

  // Bounded tail: a chatty server must not grow this without limit.
  transport.stderr?.on('data', (chunk: Buffer | string) => {
    stderrBuffer += chunk.toString('utf8')
    if (stderrBuffer.length > 2048) {
      stderrBuffer = stderrBuffer.slice(-2048)
    }
  })

  const opened = await openClient(transport, opts)
  if (opened.error) {
    const stderrDetail = stderrBuffer.trim()
      ? `\n(stderr: ${stderrBuffer.trim().slice(-300)})`
      : ''
    const hint = isTimeoutError(opened.error) ? timeoutHint(opts) : ''
    return {
      ok: false,
      message: `STDIO ${opts.failureLabel}${hint}: ${opened.error.message}${stderrDetail}`,
    }
  }

  const client = opened.client
  return {
    ok: true,
    session: {
      client,
      detectedTransport: 'stdio',
      close: () => client.close().catch(() => {}),
      diagnostics: () =>
        stderrBuffer.trim()
          ? `\n(stderr: ${stderrBuffer.trim().slice(-300)})`
          : '',
    },
  }
}

async function connectHttp(
  server: Partial<GlobalMcpServerConfig>,
  opts: McpConnectOptions,
): Promise<McpConnectResult> {
  const urlStr = server.url?.trim()
  if (!urlStr) {
    return { ok: false, message: 'HTTP/SSE 模式需要填写服务器地址 (url)' }
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(urlStr)
  } catch (err: unknown) {
    return {
      ok: false,
      message: `URL 格式不正确: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const headers = server.headers ?? {}
  const isSsePath = parsedUrl.pathname.includes('/sse')

  const attempt = async (
    transport: StreamableHTTPClientTransport | SSEClientTransport,
    kind: 'streamable-http' | 'sse',
  ): Promise<
    { ok: true; session: McpSession } | { ok: false; error: Error }
  > => {
    const opened = await openClient(transport, opts)
    if (opened.error) return { ok: false, error: opened.error }
    const client = opened.client
    return {
      ok: true,
      session: {
        client,
        detectedTransport: kind,
        close: () => client.close().catch(() => {}),
        diagnostics: () => '',
      },
    }
  }

  const sseTransport = () =>
    new SSEClientTransport(parsedUrl, { requestInit: { headers } })

  // 1. An explicit SSE path is taken at its word; no downgrade to guess at.
  if (isSsePath) {
    const sseResult = await attempt(sseTransport(), 'sse')
    return sseResult.ok
      ? sseResult
      : {
          ok: false,
          message: `SSE ${opts.failureLabel}: ${sseResult.error.message}`,
        }
  }

  // 2. Default: Streamable HTTP, with retries off so a probe fails fast.
  const httpTransport = new StreamableHTTPClientTransport(parsedUrl, {
    requestInit: { headers },
    reconnectionOptions: {
      maxRetries: 0,
      initialReconnectionDelay: 0,
      maxReconnectionDelay: 0,
      reconnectionDelayGrowFactor: 1,
    },
  })
  const httpResult = await attempt(httpTransport, 'streamable-http')
  if (httpResult.ok) return httpResult

  // 3. Downgrade to SSE only for a protocol mismatch on a reachable server.
  if (!looksLikeSseDowngrade(httpResult.error)) {
    return {
      ok: false,
      message: `HTTP ${opts.failureLabel}: ${httpResult.error.message}`,
    }
  }

  const sseResult = await attempt(sseTransport(), 'sse')
  if (sseResult.ok) return sseResult
  return {
    ok: false,
    message: `Streamable HTTP 失败 (${httpResult.error.message})，尝试降级 SSE 亦失败: ${sseResult.error.message}`,
  }
}
