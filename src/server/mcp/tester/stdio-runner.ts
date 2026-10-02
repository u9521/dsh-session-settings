/**
 * STDIO transport tester powered by official @modelcontextprotocol/client.
 */

import type { GlobalMcpServerConfig, McpTestResult } from '../../../types.ts'
import { connectMcpServer } from './connect.ts'
import { collectDiscovery } from './collect.ts'

/** Test an MCP server over STDIO transport */
export async function testStdioConnection(
  server: Partial<GlobalMcpServerConfig>,
): Promise<McpTestResult> {
  const command = server.command?.trim()
  if (!command) {
    return { ok: false, message: 'stdio 模式需要填写启动命令 (command)' }
  }

  const connected = await connectMcpServer(server)
  if (!connected.ok) return { ok: false, message: connected.message }

  const { session } = connected
  try {
    const timeoutMs =
      typeof server.toolCallTimeoutMs === 'number' &&
      server.toolCallTimeoutMs > 0
        ? Math.max(server.toolCallTimeoutMs, 5000)
        : 60000

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
      detectedTransport: 'stdio',
      message:
        count > 0
          ? `成功获取到 ${count} 个工具`
          : '成功连接并完成 MCP 握手 (未声明可用工具)',
    }
  } catch (err: unknown) {
    return {
      ok: false,
      message: `STDIO 连接测试失败: ${err instanceof Error ? err.message : String(err)}${session.diagnostics()}`,
    }
  } finally {
    await session.close()
  }
}
