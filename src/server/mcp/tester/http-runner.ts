/**
 * Streamable HTTP & SSE transport tester powered by official @modelcontextprotocol/client.
 */

import {
  Client,
  SSEClientTransport,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client'
import type {
  GlobalMcpServerConfig,
  McpDiscoveredTool,
  McpTestResult,
} from '../../../types.ts'

/** Test an MCP server over Streamable HTTP or SSE transport */
export async function testHttpConnection(
  server: Partial<GlobalMcpServerConfig>,
): Promise<McpTestResult> {
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

  const isSsePath = parsedUrl.pathname.includes('/sse')

  const testTimeoutMs = 4000
  const probeTimeoutMs = 2000
  const customHeaders = server.headers ?? {}

  // Helper to run test with a specific transport
  const runTestWithTransport = async (
    transport: StreamableHTTPClientTransport | SSEClientTransport,
    transportKind: 'streamable-http' | 'sse',
  ): Promise<McpTestResult> => {
    const client = new Client(
      { name: 'dsh-mcp-tester', version: '1.0.0' },
      {
        versionNegotiation: {
          mode: 'auto',
          probe: {
            timeoutMs: probeTimeoutMs,
            maxRetries: 0,
          },
        },
      },
    )

    try {
      await client.connect(transport, {
        timeout: probeTimeoutMs,
        signal: AbortSignal.timeout(testTimeoutMs),
      })
      const listResult = await client.listTools(undefined, {
        signal: AbortSignal.timeout(testTimeoutMs),
      })

      const serverVersion = client.getServerVersion()
      const protocolVersion = client.getNegotiatedProtocolVersion()
      const discoverResult = client.getDiscoverResult()

      const supportedVersions: string[] =
        discoverResult && Array.isArray(discoverResult.supportedVersions)
          ? discoverResult.supportedVersions
          : protocolVersion
            ? [protocolVersion]
            : []

      const rawTools = listResult?.tools || []
      const toolDetails: McpDiscoveredTool[] = rawTools.map((t) => {
        const item = t as Record<string, unknown>
        return {
          name:
            typeof t === 'string'
              ? t
              : typeof item.name === 'string'
                ? item.name
                : typeof item.id === 'string'
                  ? item.id
                  : '',
          description:
            typeof item.description === 'string' ? item.description : undefined,
          inputSchema:
            item.inputSchema && typeof item.inputSchema === 'object'
              ? (item.inputSchema as Record<string, unknown>)
              : undefined,
        }
      })

      const toolNames = toolDetails.map((t) => t.name).filter(Boolean)
      const count = toolNames.length

      return {
        ok: true,
        count,
        tools: toolNames,
        toolDetails,
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
        detectedTransport: transportKind,
        message:
          count > 0
            ? `成功获取到 ${count} 个工具`
            : '成功连接并完成 MCP 握手 (未声明可用工具)',
      }
    } finally {
      await client.close().catch(() => {})
    }
  }

  // 1. If explicit SSE path, start with SSE transport
  if (isSsePath) {
    try {
      const sseTransport = new SSEClientTransport(parsedUrl, {
        requestInit: { headers: customHeaders },
      })
      return await runTestWithTransport(sseTransport, 'sse')
    } catch (err: unknown) {
      return {
        ok: false,
        message: `SSE 连接测试失败: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  // 2. Default: Streamable HTTP (with fast fail and zero reconnection retries for testing)
  try {
    const httpTransport = new StreamableHTTPClientTransport(parsedUrl, {
      requestInit: { headers: customHeaders },
      reconnectionOptions: {
        maxRetries: 0,
        initialReconnectionDelay: 0,
        maxReconnectionDelay: 0,
        reconnectionDelayGrowFactor: 1,
      },
    })
    return await runTestWithTransport(httpTransport, 'streamable-http')
  } catch (httpErr: unknown) {
    const errMsg = httpErr instanceof Error ? httpErr.message : String(httpErr)

    // Only attempt SSE fallback if the error indicates a method/content-type mismatch on a reachable server,
    // NEVER on a fatal network outage / connection refused / DNS failure / timeout
    const isNetworkOrTimeout =
      /fetch failed|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT|ECONNRESET|timeout/i.test(
        errMsg,
      )
    if (
      !isNetworkOrTimeout &&
      /unexpected content|405|text\/event-stream/i.test(errMsg)
    ) {
      try {
        const sseTransport = new SSEClientTransport(parsedUrl, {
          requestInit: { headers: customHeaders },
        })
        return await runTestWithTransport(sseTransport, 'sse')
      } catch (sseErr: unknown) {
        return {
          ok: false,
          message: `Streamable HTTP 失败 (${errMsg})，尝试降级 SSE 亦失败: ${sseErr instanceof Error ? sseErr.message : String(sseErr)}`,
        }
      }
    }

    return {
      ok: false,
      message: `HTTP 连接测试失败: ${errMsg}`,
    }
  }
}
