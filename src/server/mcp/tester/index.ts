/**
 * MCP Server Connection & Discovery Tester subsystem powered by official @modelcontextprotocol/client.
 */

export * from './stdio-runner.ts'
export * from './http-runner.ts'
export * from './read.ts'
export * from './connect.ts'
export * from './collect.ts'

import type { GlobalMcpServerConfig, McpTestResult } from '../../../types.ts'
import { testStdioConnection } from './stdio-runner.ts'
import { testHttpConnection } from './http-runner.ts'

/** Test if an MCP server can be connected to and successfully list its tools via MCP JSON-RPC protocol */
export async function testMcpConnection(
  server: Partial<GlobalMcpServerConfig>,
): Promise<McpTestResult> {
  if (!server.transport) {
    return { ok: false, message: '缺少传输协议类型 (transport)' }
  }

  // 1. STDIO Transport
  if (server.transport === 'stdio') {
    return testStdioConnection(server)
  }

  return testHttpConnection(server)
}
