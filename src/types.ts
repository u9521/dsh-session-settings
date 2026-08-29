export type SubagentModelMode = 'default' | 'workspace' | 'inherit' | 'custom'

export interface SubagentModelConfig {
  mode: SubagentModelMode
  provider?: string
  model?: string
  reasoningEffort?: string
}

export type McpTransportType = 'stdio' | 'streamable-http-or-sse'

export interface McpReconnectConfig {
  enabled?: boolean
  initialDelayMs?: number
  maxDelayMs?: number
  maxAttempts?: number
}

export interface GlobalMcpServerConfig {
  id: string
  name: string
  description?: string
  transport: McpTransportType
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  url?: string
  headers?: Record<string, string>
  enabledByDefault: boolean
  toolCallTimeoutMs?: number
  failOnStartupError?: boolean
  reconnect?: McpReconnectConfig
  disabledTools?: string[]
  tools?: string[]
  toolDetails?: McpDiscoveredTool[]
  detectedTransport?: 'stdio' | 'streamable-http' | 'sse'
  serverInfo?: McpServerInfo
  lastTestedAt?: number
  createdAt?: number
  updatedAt?: number
}

export interface McpDiscoveredTool {
  name: string
  description?: string
  inputSchema?: Record<string, any>
}

export interface McpIcon {
  src: string
  mimeType?: string
  sizes?: string[]
  theme?: 'light' | 'dark'
}

export interface McpServerInfo {
  name?: string
  title?: string
  version?: string
  description?: string
  websiteUrl?: string
  icons?: McpIcon[]
  protocolVersion?: string
  supportedVersions?: string[]
}

export interface McpTestResult {
  ok: boolean
  message: string
  tools?: string[]
  toolDetails?: McpDiscoveredTool[]
  serverInfo?: McpServerInfo
  supportedVersions?: string[]
  detectedTransport?: 'stdio' | 'streamable-http' | 'sse'
  count?: number
}

export interface McpServerStore {
  servers: Record<string, GlobalMcpServerConfig>
}

export type SessionMcpMode = 'default' | 'workspace' | 'custom'

export interface SessionMcpConfig {
  mode: SessionMcpMode
  enabledServerIds: string[]
  toolsMode?: Record<string, 'default' | 'custom'>
  disabledTools?: Record<string, string[]>
  effectiveDisabledTools?: Record<string, string[]>
}

export type SessionSkillsMode = 'default' | 'workspace' | 'custom'

export interface SessionSkillsConfig {
  mode: SessionSkillsMode
  disabledSkills?: string[] // Backwards-compatible alias for disabledModelSkills
  disabledModelSkills?: string[] // Explicitly disabled for model invocation
  disabledUserSkills?: string[] // Explicitly disabled for user /name invocation
  effectiveDisabledSkills?: string[] // Resolved effective disabled for model
  effectiveDisabledModelSkills?: string[] // Resolved effective disabled for model
  effectiveDisabledUserSkills?: string[] // Resolved effective disabled for user
}

export interface SkillItem {
  name: string
  description: string
  whenToUse?: string
  provider: string
  source?: string
  path?: string
  content?: string
  modelInvocable?: boolean
  userInvocable?: boolean
  isRuntime?: boolean
}

export interface SessionSettingsConfig {
  subagentModel: SubagentModelConfig
  mcp: SessionMcpConfig
  skills: SessionSkillsConfig
}

export interface SessionSettingsStore {
  default: SessionSettingsConfig
  workspaces?: Record<string, SessionSettingsConfig>
  sessions: Record<string, SessionSettingsConfig>
}
