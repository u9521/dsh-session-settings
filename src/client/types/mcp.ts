import type {
  GlobalMcpServerConfig,
  McpDiscoveredTool,
  McpServerInfo,
  McpTestResult,
  McpTransportType,
  McpReconnectConfig,
} from '../../types.ts'

export interface McpSettingsProps {
  api: any
  t: (key: string, vars?: Record<string, string | number>) => string
  close?: () => void
}

export interface ToolParamItem {
  name: string
  type: string
  required: boolean
  description?: string
  default?: any
  enum?: string[]
}

export interface EnvEntry {
  key: string
  value: string
}
