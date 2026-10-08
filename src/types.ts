import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'

const API_BASE = '/api/session-settings'

export const API_ENDPOINTS = {
  getSettings: `${API_BASE}/get-settings`,
  saveSettings: `${API_BASE}/save-settings`,
  mcpServersList: `${API_BASE}/mcp-servers/list`,
  mcpServersAdd: `${API_BASE}/mcp-servers/add`,
  mcpServersEdit: `${API_BASE}/mcp-servers/edit`,
  mcpServersRm: `${API_BASE}/mcp-servers/rm`,
  /**
   * The single discovery entry point: connect once and report every primitive
   * the server declares, optionally also rebuilding the official client.
   */
  mcpServersProbe: `${API_BASE}/mcp-servers/probe`,
  /**
   * The single cache-preview entry point: read what a previous probe stored.
   * Never opens a connection.
   */
  mcpServersCache: `${API_BASE}/mcp-servers/cache`,
  mcpServersImport: `${API_BASE}/mcp-servers/import`,
  mcpServersResourceRead: `${API_BASE}/mcp-servers/resource-read`,
  mcpServersPromptGet: `${API_BASE}/mcp-servers/prompt-get`,
  skills: `${API_BASE}/skills`,
  skillsContent: `${API_BASE}/skills/content`,
} as const

export type ApiEndpointKey = keyof typeof API_ENDPOINTS

/**
 * Methods the official carrier admits on a Fetch route.
 *
 * `DELETE` is deliberately absent: the carrier's route type only accepts these
 * three, so expressing a reset as an explicit `scope` on the save endpoint is
 * both simpler and the only shape the transport can carry.
 */
export type ApiHttpMethod = 'GET' | 'POST'

/**
 * The HTTP method each endpoint answers to.
 *
 * Typed as `Record<ApiEndpointKey, …>` so the method table cannot drift from the
 * path table: adding an endpoint without a method (or naming one that does not
 * exist) is a compile error. Both halves read this single source — the client to
 * send, the server to declare its route methods.
 */
export const API_METHODS: Record<ApiEndpointKey, ApiHttpMethod> = {
  getSettings: 'GET',
  saveSettings: 'POST',
  mcpServersList: 'GET',
  mcpServersAdd: 'POST',
  mcpServersEdit: 'POST',
  mcpServersRm: 'POST',
  mcpServersProbe: 'POST',
  mcpServersCache: 'GET',
  mcpServersImport: 'POST',
  mcpServersResourceRead: 'POST',
  mcpServersPromptGet: 'POST',
  skills: 'GET',
  skillsContent: 'GET',
}

/**
 * One exact route registered on the official authenticated `/api` channel.
 *
 * The carrier applies its Host/Origin fence and browser authentication before
 * `fetch` runs, so a handler registered this way is never reachable unauthenticated.
 */
export interface ConnectionFetchRoute {
  /** Absolute pathname under `/api`. */
  readonly path: string
  readonly methods: readonly ApiHttpMethod[]
  /** Buffered bodies are read by the carrier, subject to its JSON size cap. */
  readonly requestBody: 'buffered'
  readonly fetch: (request: Request) => Promise<Response>
}

export type SettingsMode = 'global' | 'workspace' | 'custom'
export type SubagentModelMode = SettingsMode | 'inherit'
export type SessionMcpMode = SettingsMode
export type SessionSkillsMode = SettingsMode
export type SessionSandboxMode = SettingsMode

/**
 * The explicit write target of a settings save.
 *
 * This is a required discriminator rather than something inferred from which
 * fields happen to be present: inferring "no sessionId means global" is exactly
 * how a session-scoped save from a New-Session page silently overwrote the
 * global defaults.
 *
 * - `session`: one live session (`sessionId` required).
 * - `workspace`: a workspace's defaults (`workspaceId` required).
 * - `global`: the deployment-wide defaults.
 *
 * A page with no live session has no session scope to write to; it must say so
 * rather than guess a target. There is deliberately no staging scope: a staged
 * entry could only be keyed by a workspace the page had not selected.
 */
export type SettingsScopeId = 'session' | 'workspace' | 'global'

/** Write targets accepted by `API_ENDPOINTS.saveSettings`. */
export const SETTINGS_SCOPE_IDS: readonly SettingsScopeId[] = [
  'session',
  'workspace',
  'global',
]

export function isSettingsScopeId(value: unknown): value is SettingsScopeId {
  return (
    typeof value === 'string' &&
    (SETTINGS_SCOPE_IDS as readonly string[]).includes(value)
  )
}

/** Fields shared by every save/reset request. */
interface SaveSettingsBaseRequest {
  /** Reset this scope to its inherited default instead of writing a config. */
  isRestoringDefault?: boolean
}

export interface SaveSettingsGlobalRequest extends SaveSettingsBaseRequest {
  scope: 'global'
  /** Required unless `isRestoringDefault`. */
  globalConfig?: SessionSettingsConfig
}

export interface SaveSettingsWorkspaceRequest extends SaveSettingsBaseRequest {
  scope: 'workspace'
  workspaceId: string
  /** Required unless `isRestoringDefault`. */
  config?: SessionSettingsConfig
}

export interface SaveSettingsSessionRequest extends SaveSettingsBaseRequest {
  scope: 'session'
  sessionId: string
  /** Required unless `isRestoringDefault`. */
  config?: SessionSettingsConfig
}

/** Body of `API_ENDPOINTS.saveSettings`, discriminated by `scope`. */
export type SaveSettingsRequest =
  | SaveSettingsGlobalRequest
  | SaveSettingsWorkspaceRequest
  | SaveSettingsSessionRequest

/** Body of the MCP server write endpoints that carry a server payload. */
export interface McpServerRequest {
  server: Partial<GlobalMcpServerConfig>
  /** Present on edit; the id the server had before a rename. */
  originalId?: string
}

/** Body of `API_ENDPOINTS.mcpServersImport`. */
export interface McpImportRequest {
  data: unknown
}

/** Body of the MCP endpoints addressed by server id. */
export interface McpIdRequest {
  id: string
}

/** Body of every settings response; fields are present per resolved scope. */
export interface SettingsSnapshotResponse {
  ok: boolean
  scope?: SettingsScopeId
  sessionId?: string
  workspaceId?: string
  sessionConfig?: SessionSettingsConfig
  workspaceConfig?: SessionSettingsConfig
  globalConfig?: SessionSettingsConfig
  /**
   * What the mounted sandbox backend can do, so the sandbox panel can disable
   * itself with a reason instead of saving a grant nothing will honor.
   */
  sandboxCapability?: SandboxCapabilityInfo
  /** Configured allow entries skipped at the last enforcement, with reasons. */
  sandboxSkipped?: SandboxSkippedEntry[]
  error?: string
}

export interface SubagentModelTarget {
  provider: string
  model: string
  reasoningEffort?: string
}

export interface SubagentModelConfig {
  mode?: SettingsMode
  inherit?: boolean
  model?: SubagentModelTarget
  allowAgentSelectModel?: boolean
  overrideForkModel?: boolean
}

/**
 * One directory a session may additionally WRITE to, with the sentence the
 * model reads about it.
 *
 * The description travels into the runtime-context prompt next to the path
 * rather than living only in this plugin's UI: the model is the party that
 * decides where a toolchain writes its cache, and a bare path with no stated
 * purpose invites it to treat the grant as general licence.
 */
export interface SandboxAllowEntry {
  /**
   * A directory to grant, spelled the way a user thinks about it.
   *
   * `.` means the session workspace itself, any other relative path resolves
   * against it, and a leading `~` expands to the host home directory. An
   * absolute path is taken as written. The value is normalized to an absolute
   * path before it reaches any enforcement layer.
   */
  path: string
  /** One short line on what the directory is for; omitted renders the path alone. */
  description?: string
}

export interface SessionSandboxConfig {
  mode?: SettingsMode
  /**
   * Extra writable directories beyond the mode's own derivation, unioned into
   * the provider's grant list.
   *
   * Only `custom` consumes this list, and only `workspace-write` acts on it:
   * `danger-full-access` needs no widening, and granting under `read-only`
   * would be a silent end-run around the wider mode's approval prompt.
   */
  allow?: SandboxAllowEntry[]
}

/**
 * Whether the mounted sandbox backend can accept extra writable roots at all.
 *
 * Reported by the host half because the answer is a runtime fact of the
 * provider that is only known after it selects and probes a runner — a client
 * guessing from `process.platform` would enable a control that silently does
 * nothing on some hosts and not others.
 */
export interface SandboxCapabilityInfo {
  /** A provider is mounted and its backend accepts appended writable roots. */
  readonly canAllowExtraRoots: boolean
  /**
   * Why it cannot, for display. `undefined` when {@link canAllowExtraRoots}.
   * Either no `ctx.sandbox` provider is composed, or the selected backend
   * expresses its policy in a form that cannot be extended argument-wise
   * (macOS Seatbelt's single SBPL profile string).
   */
  readonly reason?: string
  /**
   * The backend the provider selected, when it is knowable without forcing a
   * probe. Present for diagnostics and for the client's own wording.
   */
  readonly backend?: string
  /**
   * The file-effect mode the target session actually runs under, when the
   * policy service could resolve it.
   *
   * Carried here rather than derived client-side because only the host can read
   * the session's `sandbox/mode` projection; the panel needs it to say that an
   * allow list does nothing outside `workspace-write`.
   */
  readonly effectiveMode?: string
}

/**
 * Directories that were configured but skipped at enforcement time, with why.
 *
 * A path that does not exist is the realistic case: granting a nonexistent
 * root is not merely useless under every backend, it is fatal under `bwrap`,
 * whose `--bind` refuses to build the profile at all and would fail every
 * command in the session. Surfacing the skip keeps "saved" from reading as
 * "in effect".
 */
export interface SandboxSkippedEntry {
  readonly path: string
  readonly reason: string
}

export type McpTransportType = 'stdio' | 'streamable-http'

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
  toolCallTimeoutMs?: number
  failOnStartupError?: boolean
  /** Maximum UTF-8 bytes of attributed server instructions (official default 32768). */
  maxInstructionBytes?: number
  reconnect?: McpReconnectConfig
  disabledTools?: string[] | number
  tools?: string[] | number
  toolDetails?: McpDiscoveredTool[]
  /**
   * Discovered resources, resource templates, and prompts.
   *
   * Lists are cached because they are cheap to store and expensive to fetch;
   * resource TEXT and prompt message bodies are deliberately never persisted —
   * those are read on demand and live only in component state.
   */
  resourceDetails?: McpDiscoveredResource[]
  resourceTemplateDetails?: McpDiscoveredResourceTemplate[]
  promptDetails?: McpDiscoveredPrompt[]
  /** Which primitives the server advertised at the last discovery. */
  capabilities?: McpServerCapabilities
  detectedTransport?: 'stdio' | 'streamable-http' | 'sse'
  serverInfo?: McpServerInfo
  lastTestedAt?: number
  createdAt?: number
  updatedAt?: number
  /**
   * Live runtime status of the official @deepseek-ai/dsh-mcp-client fork.
   * Response-only: attached by the MCP routes, never persisted to disk.
   */
  runtime?: McpServerRuntimeStatus
  /**
   * Counts of cached discovery lists, substituted for the arrays themselves on
   * the list response. Response-only, like `runtime`: the detail arrays are
   * served by `toolview` for the one server a panel opens.
   */
  resourceCount?: number
  resourceTemplateCount?: number
  promptCount?: number
}

/**
 * Live status of the official @deepseek-ai/dsh-mcp-client fork for one server.
 *
 * The official bridge exposes no status API, so this is inferred from four
 * observable facts:
 *  - whether we ever attempted to mount the official client in this process,
 *  - whether a (not yet disposed) Cordis fork exists,
 *  - how many `mcp__<serverId>__*` tools are currently registered on ctx.tools,
 *  - when the current mount attempt began.
 *
 * The bridge unregisters every tool once its reconnect budget is exhausted
 * ("giving up"), while the fork itself stays alive — hence `mounted` alone
 * cannot tell a healthy server from a permanently disabled one. A zero tool
 * count is likewise ambiguous on its own, since a fork still completing its
 * handshake looks identical; `mountStartedAt` is what separates the two.
 */
export interface McpServerRuntimeStatus {
  /** True once this process attempted to mount the official client for the server. */
  mountAttempted: boolean
  /** True while the Cordis fork exists and has not been disposed (fork.uid !== null). */
  mounted: boolean
  /** Number of currently registered `mcp__<serverId>__*` tools on ctx.tools. */
  registeredToolCount: number
  /** Wall clock when the current mount attempt began; absent when never attempted. */
  mountStartedAt?: number
  /** Activation/mount error (invalid config, fork startup rejection). Not set for plain connection failures. */
  lastError?: string
  /** Timestamp of the last manual client refresh for this server. */
  lastRefreshAt?: number
}

/** Result of a manual "remount the official MCP client" refresh request. */
export interface McpRefreshResult {
  id: string
  name: string
  /** Connection probe succeeded (server reachable and tools/list returned). */
  ok: boolean
  /** Human readable probe outcome, surfaced inline on the card when it fails. */
  message: string
  /** Tool count reported by the probe (0 when the probe failed). */
  toolCount: number
  /** Wall-clock duration of the whole refresh (probe + remount settle). */
  durationMs: number
  /** True when the official client fork was actually remounted (not just probed). */
  remounted: boolean
  /** Runtime status read after the remount settled. */
  status: McpServerRuntimeStatus
}

export interface McpDiscoveredTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

/**
 * Which primitives one server advertised during discovery.
 *
 * This exists because the MCP SDK answers a `list*` call for an unadvertised
 * capability with an EMPTY LIST plus a console warning, not an error. Without
 * these flags an empty result and an unsupported capability are literally the
 * same response, and the panel could only guess which message to show.
 */
export interface McpServerCapabilities {
  tools?: boolean
  resources?: boolean
  prompts?: boolean
}

/** One concrete resource a server exposes. */
export interface McpDiscoveredResource {
  uri: string
  name: string
  title?: string
  description?: string
  mimeType?: string
  size?: number
}

/**
 * One parameterized resource URI template.
 *
 * `variableNames` is resolved server-side with the MCP SDK's `UriTemplate`: the
 * client half may not value-import `@modelcontextprotocol/client`, and a naive
 * brace-scan in the client would disagree with the SDK's operator handling
 * (`{?q}`, `{+path}`, …). The server is the single source for this parse.
 */
export interface McpDiscoveredResourceTemplate {
  uriTemplate: string
  name: string
  title?: string
  description?: string
  mimeType?: string
  variableNames: string[]
}

/** One argument a prompt template accepts. */
export interface McpPromptArgument {
  name: string
  description?: string
  required?: boolean
}

/** One prompt template a server exposes. */
export interface McpDiscoveredPrompt {
  name: string
  title?: string
  description?: string
  arguments?: McpPromptArgument[]
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
  resourceDetails?: McpDiscoveredResource[]
  resourceTemplateDetails?: McpDiscoveredResourceTemplate[]
  promptDetails?: McpDiscoveredPrompt[]
  capabilities?: McpServerCapabilities
  serverInfo?: McpServerInfo
  supportedVersions?: string[]
  detectedTransport?: 'stdio' | 'streamable-http' | 'sse'
  count?: number
}

/**
 * Body of the single discovery request.
 *
 * `remount` is the recovery action for a bridge that exhausted its reconnect
 * budget, folded into this entry rather than living at its own path. It is
 * opt-in and defaults to off: a plain probe must never tear down a live client.
 */
export interface McpProbeRequest {
  server: Partial<GlobalMcpServerConfig>
  /** Passed through to the remount path; ignored unless `remount` is set. */
  force?: boolean
  /** Also rebuild the official client for this server after probing. */
  remount?: boolean
}

/** Discovery response: the probe's own result, plus the remount outcome when asked. */
export interface McpProbeResult extends McpTestResult {
  /** Present only when the request asked for a remount. */
  remount?: McpRefreshResult
  /** Sanitized server record, so a caller can refresh its list from one response. */
  server?: GlobalMcpServerConfig
}

/**
 * One server's cached discovery, as stored by the last successful probe.
 *
 * Served without connecting, so a panel can render immediately. Absent fields
 * mean nothing was cached for that primitive yet.
 */
export interface McpCachedView {
  ok: boolean
  /** Tool names when known; a stored count is also possible, see `GlobalMcpServerConfig`. */
  tools?: string[] | number
  toolDetails?: McpDiscoveredTool[]
  resourceDetails?: McpDiscoveredResource[]
  resourceTemplateDetails?: McpDiscoveredResourceTemplate[]
  promptDetails?: McpDiscoveredPrompt[]
  capabilities?: McpServerCapabilities
  disabledTools?: string[]
  serverInfo?: McpServerInfo
  detectedTransport?: 'stdio' | 'streamable-http' | 'sse'
}

/**
 * Body of a resource read.
 *
 * Exactly one addressing form: a literal `uri`, or a `uriTemplate` with the
 * `variables` that expand it. The server expands template form itself and
 * refuses when any variable the template names is missing — `UriTemplate.expand`
 * silently drops unfilled variables, so `db://{table}/{id}` with no values
 * yields the plausible-but-wrong `"db:///"` instead of throwing.
 */
export interface McpResourceReadRequest {
  server: Partial<GlobalMcpServerConfig>
  uri?: string
  uriTemplate?: string
  variables?: Record<string, string>
}

/**
 * One resource payload.
 *
 * `blob` is deliberately absent: binary payloads are reported by their base64
 * length only, matching the host's own `renderResourceResult`, so a large
 * resource cannot reach the browser as inline base64.
 */
export interface McpResourceContent {
  uri: string
  mimeType?: string
  text?: string
  /** Base64 length of a binary payload; the payload itself is not transferred. */
  blobBytes?: number
  /** True when this entry's text was truncated at the size cap. */
  truncated?: boolean
}

export interface McpResourceReadResult {
  ok: boolean
  message: string
  /** The URI actually read; expanded from the template when template form was used. */
  uri?: string
  contents?: McpResourceContent[]
}

/** Body of a prompt fetch. */
export interface McpPromptGetRequest {
  server: Partial<GlobalMcpServerConfig>
  name: string
  arguments?: Record<string, string>
}

/**
 * One block of a rendered prompt message.
 *
 * Only `text` survives verbatim. Image, audio, and embedded-resource blocks are
 * reduced to a description: this panel never forwards content into a session, so
 * carrying binary payloads to the browser would be cost without purpose.
 */
export interface McpPromptBlock {
  type: 'text' | 'image' | 'audio' | 'resource' | 'unknown'
  text?: string
  mimeType?: string
  description?: string
  /** True when this block's text was truncated at the size cap. */
  truncated?: boolean
}

/** One role-tagged message returned by a prompt fetch. */
export interface McpPromptMessage {
  role: 'user' | 'assistant'
  blocks: McpPromptBlock[]
}

export interface McpPromptGetResult {
  ok: boolean
  message: string
  description?: string
  messages?: McpPromptMessage[]
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
  sandbox: SessionSandboxConfig
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

/**
 * The official browser-connection carrier slice this plugin consumes.
 *
 * Routes registered here are reached only after the carrier has applied its
 * Host/Origin fence and browser authentication, which is why this plugin no
 * longer registers directly on `webServer`.
 */
export interface ConnectionService {
  fetch: {
    register(route: ConnectionFetchRoute): () => Promise<void>
  }
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
  /** Provider-specific base for resolving relative resources. */
  readonly resourceBase?: {
    readonly kind?: string
    readonly path?: string
  }
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
  /**
   * Register a readonly runtime skill into the calling context's layer. A
   * scoped registration shadows a same-name entry in an ancestor layer, which
   * is how a per-agent invocation policy is expressed without rewriting the
   * registry's read path.
   */
  register(skill: SkillRegistrationInput): () => void
}

/** Runtime skill contribution; `invocation` and `provider` receive defaults. */
export interface SkillRegistrationInput {
  readonly name: string
  readonly description: string
  readonly content: string
  readonly whenToUse?: string
  readonly source?: string
  readonly path?: string
  readonly provider?: string
  readonly invocation?: SkillInvocationPolicy
  readonly resourceBase?: {
    readonly kind?: string
    readonly path?: string
  }
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
  readonly isSeeded?: boolean
  readonly origin?: 'subagent'
  readonly delegationDepth?: number
  readonly agentPreset?: string
}

export interface Session {
  readonly id: string
  readonly header: SessionHeader
  /**
   * The route this Session last requested, as the host folds it from the log's
   * request-header events. Optional because a Session that has not requested
   * anything yet has none, and because not every host surface exposes it.
   *
   * This is how the subagent-model interceptor recovers the route a delegation
   * would have inherited: the host's own `resolveChildAgentOptions` uses the
   * very same fold as its baseline.
   */
  requestHeader?():
    | {
        config?: {
          provider?: string
          model?: string
          reasoningEffort?: string
        }
      }
    | undefined
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
    reasoningEffort?: string
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
  /**
   * Lend a standing scope lease for one preset; release it through
   * `Symbol.asyncDispose` once the scoped read completes.
   */
  acquireScope(
    id?: string,
  ): Promise<{ key?: unknown; [Symbol.asyncDispose]?: () => Promise<void> }>
  serviceFor<T = unknown>(agent: { ctx: Context }, name: string): T | undefined
}

export interface SessionPersistenceStat {
  readonly header: SessionHeader
  readonly revision: string
  readonly sizeBytes?: number
}

export interface SessionPersistenceService {
  stat(
    id: string,
    options?: { signal?: AbortSignal },
  ): Promise<SessionPersistenceStat | undefined>
}

export interface LoaderEntry {
  id?: string
  name?: string
  target?: string
}

export interface LoaderService {
  entries?: Map<string, LoaderEntry>
  locate?(fiber?: unknown): string | undefined
  import?(name: string): Promise<unknown>
  unwrapExports?(exports: unknown): unknown
}

// --------------------------------------------------------------------------
// DSH Tools and Execution Pipeline Types
// --------------------------------------------------------------------------

export interface ToolSchema {
  name: string
  description?: string
  parameters?: Record<string, unknown>
}

/** Per-scope filter over global tools; restrictions intersect. */
export interface ToolRestriction {
  allow?: readonly string[]
  deny?: readonly string[]
}

/**
 * Monotonic execution guard. Returning a reason denies the call; no guard can
 * turn another guard's denial back into permission.
 */
export type ToolGuardFn = (exec: ToolExecution) => string | undefined

/**
 * Minimal view of `ctx.tools` this plugin consumes.
 *
 * `schemas()` is the presentation-agnostic, restriction-aware view: called with
 * no scope it yields the global layer, which is exactly the set of names a
 * per-agent `restrict()` may legally name.
 */
export interface ToolsService {
  schemas(scope?: unknown): ToolSchema[]
  restrict(filter: ToolRestriction): () => void
  guard(guard: ToolGuardFn): () => void
}

export interface PromptSectionInput {
  name: string
  order: number
  text: string | ((context: AssembleContext) => string)
  interpolate?: boolean
}

/**
 * One `ctx.systemPrompt.context()` contribution's input shape.
 *
 * `order` is optional because this plugin derives it from the host's own
 * `getContextOrder('SANDBOX_POLICY')` when that helper exists and otherwise
 * omits it, letting the host place the entry by its own default.
 */
export interface PromptContextInput {
  name: string
  order?: number
  text: string | ((context: AssembleContext) => string)
}

/**
 * Minimal view of `ctx.systemPrompt`.
 *
 * Carries both faces this plugin uses: per-agent `section()` shadowing (skills
 * and MCP policy) and runtime-context `context()` contributions (the sandbox
 * grant paragraph). `context` and `getContextOrder` are optional because the
 * service is reached structurally — a DSH release that stops offering context
 * entries must make this plugin skip its paragraph, not fail to load.
 */
export interface SystemPromptService {
  section(section: PromptSectionInput): () => void
  getSectionOrder(name: string): number
  context?(context: PromptContextInput): () => void
  getContextOrder?(name: string): number
}

/**
 * The confined-execution policy a consumer stamps onto one capability call.
 *
 * Only the fields this plugin reads are declared; the provider treats the value
 * as fully specified, so the wrapper passes it through untouched.
 */
export interface SandboxPolicyLike {
  readonly mode: 'read-only' | 'workspace-write' | 'danger-full-access'
  readonly workspaceRoot: string
  readonly sessionId?: string
}

/**
 * What a provider's `confine()` resolves to.
 *
 * `argv` is the only field this plugin rewrites; the classification facts
 * (enforcement, denial signatures, runner-failure rules) describe the runner
 * that produced them and stay exactly as returned.
 */
export interface ConfinedArgvLike {
  readonly argv: string[]
  readonly enforcement: 'full' | 'partial'
  readonly denialSignatures: readonly string[]
  readonly runnerFailureRules: readonly unknown[]
}

/** Minimal view of `ctx.sandboxPolicy`: only the session-mode read. */
export interface SandboxPolicyServiceLike {
  /** The deployment default, the fallback beneath a session override. */
  readonly defaultMode: string
  /**
   * The session's last logged `sandbox/mode` override, or `undefined` without
   * one — i.e. before the deployment default is applied.
   */
  overrideOf(session: unknown): string | undefined
}

/**
 * Minimal view of the `ctx.sandbox` provider seam.
 *
 * `confine` is the single method this plugin wraps. It is a service method
 * rather than a declared extension point, so the wrapper is installed on the
 * instance and the original restored on unload.
 */
export interface SandboxProviderLike {
  confine(
    argv: readonly string[],
    policy: SandboxPolicyLike,
    signal?: AbortSignal,
  ): Promise<ConfinedArgvLike>
}

/** The `sandboxPolicy` argument the fs seam receives on every mutation. */
export interface FsSandboxPolicyLike extends SandboxPolicyLike {
  /** Opaque session identity; the branded SessionId in the host's own types. */
  readonly sessionId?: string
}

/**
 * Minimal view of one resolved filesystem target.
 *
 * `targetKey` is deliberately opaque and never parsed: containment is answered
 * by {@link FileSystemLike.contains}, which the provider owns.
 */
export interface FsTargetLike {
  readonly targetKey: string
  readonly displayPath: string
}

/** Minimal view of `ctx.fs`: only the two mutations this plugin re-fences. */
export interface FileSystemLike {
  resolve(
    path: string,
    opts?: { cwd?: string; signal?: AbortSignal },
  ): Promise<FsTargetLike>
  /**
   * Canonical containment between two targets from THIS provider. Used instead
   * of comparing paths, so the check stays correct for any backend rather than
   * only host-backed ones.
   */
  contains(parent: FsTargetLike, child: FsTargetLike): boolean
  writeText(
    target: FsTargetLike,
    content: string,
    expected?: unknown,
    signal?: AbortSignal,
    sandboxPolicy?: FsSandboxPolicyLike,
  ): Promise<unknown>
  editText(
    target: FsTargetLike,
    edit: unknown,
    expected?: unknown,
    signal?: AbortSignal,
    sandboxPolicy?: FsSandboxPolicyLike,
  ): Promise<unknown>
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
  | { kind: 'cancel' }
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
    /**
     * The official browser-connection carrier. Its `fetch.register` puts a route
     * behind the Host/Origin fence and browser authentication.
     */
    connection?: ConnectionService
    tools?: ToolsService
    systemPrompt?: SystemPromptService
    agent?: Agent
    /**
     * The mounted filesystem provider. The sandbox allow-list re-fences its two
     * mutations so extra directories apply to the `write` / `edit` tools as
     * well as to confined subprocesses.
     */
    fs?: FileSystemLike
    /** The sandbox policy owner, read for the session's effective mode. */
    sandboxPolicy?: SandboxPolicyServiceLike
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

    'tools/result'(exec: ToolExecution, result: unknown): void

    /**
     * A tool was registered or unregistered, or a scoped restriction changed.
     * Deliberately unfiltered: a listener registered on a scoped context still
     * observes every change, not just its own scope's.
     */
    'tools/change'(): void

    'skills/change'(): void

    'agent/created'(payload: {
      agent: Agent
      source: unknown
      signal?: AbortSignal
    }): undefined | Promise<undefined>

    'agent/disposed'(payload: { agent: Agent }): void
  }
}
