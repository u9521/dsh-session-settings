/**
 * STDIO transport tester powered by official @modelcontextprotocol/client.
 */

import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import type {
  GlobalMcpServerConfig,
  McpDiscoveredTool,
  McpTestResult,
} from '../../../types.ts'

/** Test an MCP server over STDIO transport */
export async function testStdioConnection(
  server: Partial<GlobalMcpServerConfig>,
): Promise<McpTestResult> {
  const command = server.command?.trim()
  if (!command) {
    return { ok: false, message: 'stdio 模式需要填写启动命令 (command)' }
  }

  let stderrBuffer = ''
  const transport = new StdioClientTransport({
    command,
    args: server.args || [],
    env: server.env || {},
    cwd: server.cwd,
    stderr: 'pipe',
  })

  // Capture stderr output for error diagnostics
  transport.stderr?.on('data', (chunk: Buffer | string) => {
    stderrBuffer += chunk.toString('utf8')
    if (stderrBuffer.length > 2048) {
      stderrBuffer = stderrBuffer.slice(-2048)
    }
  })

  const testTimeoutMs = 4000
  const probeTimeoutMs = 2000

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
    const toolDetails: McpDiscoveredTool[] = rawTools.map((t: any) => ({
      name: typeof t === 'string' ? t : t.name || t.id || '',
      description: typeof t === 'object' ? t.description : undefined,
      inputSchema:
        typeof t === 'object'
          ? (t.inputSchema as Record<string, any>)
          : undefined,
    }))

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
      detectedTransport: 'stdio',
      message:
        count > 0
          ? `成功获取到 ${count} 个工具`
          : '成功连接并完成 MCP 握手 (未声明可用工具)',
    }
  } catch (err: any) {
    const stderrDetail = stderrBuffer.trim()
      ? `\n(stderr: ${stderrBuffer.trim().slice(-300)})`
      : ''
    return {
      ok: false,
      message: `STDIO 连接测试失败: ${err?.message || String(err)}${stderrDetail}`,
    }
  } finally {
    await client.close().catch(() => {})
  }
}
