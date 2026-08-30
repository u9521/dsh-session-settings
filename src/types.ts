import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'

const API_BASE = '/api/session-settings'

export const API_ENDPOINTS = {
  getSettings: `${API_BASE}/get-settings`,
  saveSettings: `${API_BASE}/save-settings`,
  deleteSettings: `${API_BASE}/delete-settings`,
  mcpServersList: `${API_BASE}/mcp-servers/list`,
  mcpServersAdd: `${API_BASE}/mcp-servers/add`,
  mcpServersEdit: `${API_BASE}/mcp-servers/edit`,
  mcpServersRm: `${API_BASE}/mcp-servers/rm`,
  mcpServersToolview: `${API_BASE}/mcp-servers/toolview`,
  mcpServersTools: `${API_BASE}/mcp-servers/tools`,
  mcpServersTest: `${API_BASE}/mcp-servers/test`,
  mcpServersImport: `${API_BASE}/mcp-servers/import`,
  skills: `${API_BASE}/skills`,
  skillsContent: `${API_BASE}/skills/content`,
} as const

export type SettingsMode = 'global' | 'workspace' | 'custom'
export type SubagentModelMode = SettingsMode | 'inherit'
export type SessionMcpMode = SettingsMode
export type SessionSkillsMode = SettingsMode

export interface SubagentModelTarget {
  provider: string
  model: string
  reasoningEffort?: string
}

export interface SubagentModelConfig {
  mode?: SettingsMode
  inherit?: boolean
  model?: SubagentModelTarget
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
  disabledTools?: string[] | number
  tools?: string[] | number
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
  inputSchema?: Record<string, unknown>
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

export interface SessionMcpConfig {
  mode?: SettingsMode
  enabledServerIds?: string[]
  toolsMode?: Record<string, 'global' | 'custom'>
  disabledTools?: Record<string, string[]>
}

export interface SessionSkillsConfig {
  mode?: SettingsMode
  disabledModelSkills?: string[] // Explicitly disabled for model invocation
  disabledUserSkills?: string[] // Explicitly disabled for user /name invocation
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
  globalConfig: SessionSettingsConfig
  workspaces?: Record<string, SessionSettingsConfig>
  sessions: Record<string, SessionSettingsConfig>
}

// --------------------------------------------------------------------------
// DSH Web Server and HTTP Types
// --------------------------------------------------------------------------

export type WebRouteKind = 'exact' | 'prefix'

export interface WebRoute {
  kind: WebRouteKind
  path: string
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

export interface WebServer {
  port: number
  host: string
  register(route: WebRoute): () => void
}

// --------------------------------------------------------------------------
// DSH Skills Registry Types
// --------------------------------------------------------------------------

export interface SkillInvocationPolicy {
  readonly modelInvocable: boolean
  readonly userInvocable: boolean
}

export interface SkillSummary {
  readonly name: string
  readonly description: string
  readonly whenToUse?: string
  readonly invocation: SkillInvocationPolicy
  readonly source: string
  readonly provider: string
  readonly path?: string
  readonly metadata?: Readonly<Record<string, unknown>>
}

export interface SkillDefinition extends SkillSummary {
  readonly content: string
}

export interface SkillCatalogSnapshot {
  readonly skills: SkillSummary[]
  readonly complete: boolean
}

export interface SkillViewOptions {
  readonly cwd?: string
  readonly signal?: AbortSignal
  readonly scope?: unknown
}

export interface SkillsService {
  list(options?: SkillViewOptions): Promise<SkillSummary[]>
  snapshot(options?: SkillViewOptions): Promise<SkillCatalogSnapshot>
  get(
    name: string,
    options?: SkillViewOptions,
  ): Promise<SkillDefinition | undefined>
}

// --------------------------------------------------------------------------
// DSH Session and Agent Types
// --------------------------------------------------------------------------

export interface SessionHeader {
  readonly version: number
  readonly id: string
  readonly createdAt: number
  readonly cwd?: string
  readonly parentSession?: string
  readonly seedLength?: number
  readonly origin?: 'subagent'
  readonly delegationDepth?: number
  readonly agentPreset?: string
}

export interface Session {
  readonly id: string
  readonly header: SessionHeader
  readonly events?: readonly unknown[]
}

export interface SessionsService {
  get(id: string): Session | undefined
  list(): Session[]
}

export interface Agent {
  readonly id: string
  readonly options: {
    provider?: string
    model?: string
    maxTokens?: number
  }
  readonly session: Session
  readonly ctx: Context
  readonly status: 'idle' | 'running'
}

export interface AgentsService {
  get(id: string): Agent | undefined
}

export interface AgentPreset {
  id: string
  name: string
  description?: string
}

export interface AgentPresetsService {
  list(): Promise<AgentPreset[]>
  resolve(id?: string): Promise<AgentPreset>
  standingKeyFor(id?: string): Promise<unknown>
  serviceFor<T = unknown>(agent: { ctx: Context }, name: string): T | undefined
}

export interface SessionInspection {
  readonly meta: SessionHeader
  readonly events: readonly unknown[]
}

export interface SessionPersistenceService {
  inspect(id: string, signal?: AbortSignal): Promise<SessionInspection>
  list(signal?: AbortSignal): Promise<SessionHeader[]>
}

export interface LoaderEntry {
  id?: string
  name?: string
  target?: string
}

export interface LoaderService {
  entries: Map<string, LoaderEntry>
  locate(fiber?: unknown): string | undefined
}

// --------------------------------------------------------------------------
// DSH Tools and Execution Pipeline Types
// --------------------------------------------------------------------------

export interface ToolSchema {
  name: string
  description?: string
  parameters?: Record<string, unknown>
}

export interface ToolExecution {
  readonly name: string
  readonly arguments: unknown
  readonly agent?: Agent
  readonly signal: AbortSignal
  readonly callId?: string
  readonly rootCallId?: string
}

export type PreToolDecision =
  | { kind: 'allow' }
  | { kind: 'deny'; reason: string }
  | { kind: 'ask'; reason?: string }

export interface PromptAssembly {
  sections: Array<{ name: string; text: string }>
  contexts: Array<{ name: string; text: string }>
  tools: ToolSchema[]
  variables: Record<string, string | undefined>
}

export interface AssembleContext {
  scope?: unknown
  agent?: Agent
  signal?: AbortSignal
}

export interface LlmCallConfig {
  provider?: string
  model?: string
  reasoningEffort?: string
  temperature?: number
  maxTokens?: number
  stop?: string[]
}

export interface AgentRequestPayload {
  agent: Agent
  turn: number
  step: number
  signal: AbortSignal
}

// --------------------------------------------------------------------------
// Cordis Context & Events Augmentation
// --------------------------------------------------------------------------

declare module '@deepseek-ai/cordis' {
  interface Context {
    skills?: SkillsService
    agents?: AgentsService
    sessions?: SessionsService
    sessionPersistence?: SessionPersistenceService
    agentPresets?: AgentPresetsService
    loader?: LoaderService
    webServer?: WebServer
    agent?: Agent
  }

  interface Events {
    'agent/request'(
      payload: AgentRequestPayload,
      next: () => Promise<LlmCallConfig>,
    ): Promise<LlmCallConfig>

    'system-prompt/assemble'(
      assembly: PromptAssembly,
      context: AssembleContext,
      next: () => Promise<PromptAssembly>,
    ): Promise<PromptAssembly>

    'tools/pre-execute'(
      exec: ToolExecution,
      next: () => Promise<PreToolDecision>,
    ): Promise<PreToolDecision>

    'skills/change'(): void
  }
}
