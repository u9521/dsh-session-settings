/**
 * Streamable HTTP & SSE transport tester powered by official @modelcontextprotocol/client.
 */

import type { GlobalMcpServerConfig, McpTestResult } from '../../../types.ts'
import { connectMcpServer } from './connect.ts'
import { collectDiscovery } from './collect.ts'

/** Test an MCP server over Streamable HTTP or SSE transport */
export async function testHttpConnection(
  server: Partial<GlobalMcpServerConfig>,
): Promise<McpTestResult> {
  const urlStr = server.url?.trim()
  if (!urlStr) {
    return { ok: false, message: 'HTTP/SSE 模式需要填写服务器地址 (url)' }
  }

  try {
    new URL(urlStr)
  } catch (err: unknown) {
    return {
      ok: false,
      message: `URL 格式不正确: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // Transport selection (including the SSE downgrade) belongs to the shared
  // connector so every operation reaches a server exactly the same way.
  const connected = await connectMcpServer(server)
  if (!connected.ok) return { ok: false, message: connected.message }

  const { session } = connected
  try {
    const timeoutMs =
      typeof server.toolCallTimeoutMs === 'number' &&
      server.toolCallTimeoutMs > 0
        ? Math.max(server.toolCallTimeoutMs, 3000)
        : 30000

    const discovery = await collectDiscovery(session.client, timeoutMs)
    const toolNames = discovery.toolDetails.map((tool) => tool.name)
    const count = toolNames.length

    return {
      ok: true,
      count,
      tools: toolNames,
      toolDetails: discovery.toolDetails,
      resourceDetails: discovery.resourceDetails,
      resourceTemplateDetails: discovery.resourceTemplateDetails,
      promptDetails: discovery.promptDetails,
      capabilities: discovery.capabilities,
      serverInfo: discovery.serverInfo,
      supportedVersions: discovery.supportedVersions,
      detectedTransport: session.detectedTransport,
      message:
        count > 0
          ? `成功获取到 ${count} 个工具`
          : '成功连接并完成 MCP 握手 (未声明可用工具)',
    }
  } catch (err: unknown) {
    return {
      ok: false,
      message: `${session.detectedTransport === 'sse' ? 'SSE' : 'HTTP'} 连接测试失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  } finally {
    await session.close()
  }
}
