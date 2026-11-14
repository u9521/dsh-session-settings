import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { McpImportSkip } from './shared/mcpDocument.ts'

export type { McpImportSkip }

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
  sandboxTemplatesList: `${API_BASE}/sandbox-templates/list`,
  sandboxTemplatesSave: `${API_BASE}/sandbox-templates/save`,
  sandboxTemplatesRemove: `${API_BASE}/sandbox-templates/remove`,
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
  sandboxTemplatesList: 'GET',
  sandboxTemplatesSave: 'POST',
  sandboxTemplatesRemove: 'POST',
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
  /** A `.mcp.json` document: `{ "mcpServers": { <name>: <entry> } }`. */
  data: unknown
}

/**
 * Outcome of one import.
 *
 * `skipped` is the point of this type: the old importer swallowed every
 * per-entry failure and answered `ok: true` with a write count, so an import
 * that dropped every stdio server still read as a success. An import now has to
 * account for each entry it was handed.
 */
export interface McpImportResult {
  /** Entries actually written (de-duplicated by id, not counting overwrites twice). */
  count: number
  /** Entries refused, each with the reason shown to the user. */
  skipped: McpImportSkip[]
  /** Entries that replaced an existing server with the same id. */
  overwritten: number
  /** The full list after the import, so a caller need not re-fetch. */
  servers?: GlobalMcpServerConfig[]
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
  /** The target session's resolved sandbox facts, for the panel's notices. */
  sandboxCapability?: SandboxCapabilityInfo
  /** Configured allow entries skipped at the last enforcement, with reasons. */
  sandboxSkipped?: SandboxSkippedEntry[]
  /**
   * Skill policy entries the registry REJECTED at the last enforcement.
   *
   * A rejected shadow leaves the session's catalog unchanged, so without this
   * the panel would show a skill as disabled while the agent still sees it.
   */
  skillsPolicyFailures?: SkillPolicyFailure[]
  error?: string
}

/** One skill whose per-session policy the registry refused to apply. */
export interface SkillPolicyFailure {
  /** The skill name as configured. */
  name: string
  /** Why the registry refused the shadowing registration. */
  reason: string
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
 * One user-authored fill-in preset for the sandbox panel.
 *
 * Deliberately NOT part of {@link SessionSandboxConfig}: a preset is a
 * deployment-wide authoring asset shared by every session, while the allow list
 * is a per-scope policy decision resolved through the three-layer ladder.
 * Folding the two together would make "which layer owns this template?"
 * unanswerable the moment a save ran under any single scope, and a global reset
 * would take the user's own presets with it.
 *
 * The built-in presets are not stored anywhere — they ship with the client
 * bundle and are read-only. Only what a user authors lives here, which is what
 * keeps a built-in path fixable by a plugin upgrade.
 */
export interface SandboxTemplate {
  /** Stable id; the storage key and the React key. Never shown to the user. */
  id: string
  /** Button label. Unique across the user's own presets and the built-in ones. */
  name: string
  /** Rows this preset fills, in the order they appear in the panel. */
  entries: SandboxAllowEntry[]
  /** Creation time, for a stable listing order independent of object keys. */
  createdAt?: number
}

/** The sandbox template store, keyed by id. */
export interface SandboxTemplateStore {
  templates: Record<string, SandboxTemplate>
}

/** Body of `API_ENDPOINTS.sandboxTemplatesSave`. */
export interface SandboxTemplateSaveRequest {
  /** The preset to write; `id` is assigned server-side when absent. */
  template: Partial<SandboxTemplate>
}

/** Body of `API_ENDPOINTS.sandboxTemplatesRemove`. */
export interface SandboxTemplateRemoveRequest {
  id: string
}

/**
 * What the sandbox panel may state about the target session.
 *
 * The policy service is a required part of this plugin's composition, so this
 * carries resolved facts rather than a capability verdict.
 */
export interface SandboxCapabilityInfo {
  /**
   * The file-effect mode the target session actually runs under.
   *
   * Carried here rather than derived client-side because only the host can read
   * the session's `sandbox/mode` projection; the panel needs it to say that an
   * allow list does nothing outside `workspace-write`.
   */
  readonly effectiveMode: string
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
 * One connection state the official client publishes for a server.
 *
 * Mirrors `McpConnectionStatus` from `@deepseek-ai/dsh-mcp-client/types`. Copied
 * structurally rather than imported because the client half of this plugin is
 * bundled independently and must not take a value dependency on a host package;
 * the host half reads these values from `connectionStatusOf()` at runtime.
 */
export type McpConnectionStatusLike =
  | {
      readonly state: 'closed'
      readonly result: McpCloseLike
    }
  | { readonly state: 'waiting-credentials'; readonly lastError: string }
  | { readonly state: 'connecting'; readonly attempt: number }
  | {
      readonly state: 'connected'
      readonly toolCount: number
      readonly connectedAt: number
    }
  | {
      readonly state: 'reconnecting'
      readonly attempt: number
      readonly maxAttempts: number
      readonly nextRetryAtMs: number
      readonly lastError: string
    }
  | {
      readonly state: 'failed'
      readonly reason: 'gave-up' | 'reconnect-disabled' | 'unclosed-generation'
      readonly lastError?: string
    }

/** Whether a generation's transport closed, and whether its cleanup finished. */
export interface McpCloseLike {
  /** Transport closure confirmed, or no transport was ever created. */
  readonly closeConfirmed: boolean
  /** Cleanup failed or exceeded its budget, including after confirmed closure. */
  readonly cleanupError?: string
}

/**
 * Live status of the official @deepseek-ai/dsh-mcp-client fork for one server.
 *
 * Every connection fact here is the host's own: `connectionStatusOf(fiber)`
 * publishes the state, the attempt counters, and the last failure. Nothing is
 * inferred from a tool count or a mount timestamp.
 */
export interface McpServerRuntimeStatus {
  /** True while this plugin holds a live, undisposed fork for the server. */
  mounted: boolean
  /**
   * The host's connection state for that instance.
   *
   * Absent in two real windows: before the instance publishes its first state,
   * and after activation failed so no instance exists.
   */
  connection?: McpConnectionStatusLike
  /**
   * The latest generation's cleanup result, independent of connection state.
   *
   * `closeConfirmed: false` means the bridge could not prove the transport
   * closed; the host then refuses to replace the instance, so the panel must
   * tell the user to restart rather than offer a remount that cannot work.
   */
  cleanup?: McpCloseLike
  /**
   * Why the fork could not be activated at all (invalid configuration, a
   * startup rejection). Distinct from a connection failure: activation failing
   * means no instance exists to have a connection state.
   */
  lastError?: string
}

/** Result of a manual "remount the official MCP client" refresh request. */
export interface McpRefreshResult {
  id: string
  name: string
  /**
   * The remount itself succeeded — the fork was rebuilt and is usable.
   *
   * Deliberately NOT the probe's verdict: a probe opens its own short-lived
   * connection, so it can reach a server whose long-lived client is dead (a
   * stale HTTP session id does exactly that) and it can fail on a server whose
   * client came back fine. Only the rebuilt fork answers "did the recovery
   * work".
   */
  ok: boolean
  /** Human readable outcome, surfaced in the notice after a remount. */
  message: string
  /** Tool count reported by the probe (0 when the probe failed). */
  toolCount: number
  /** Wall-clock duration of the whole refresh (probe + remount settle). */
  durationMs: number
  /** True when the official client fork was actually rebuilt. */
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
 *
 * When it IS asked for, it always rebuilds: the request names an explicit
 * recovery action, so the server does not second-guess it against the saved
 * scope lists. See `McpRefreshResult.remounted`.
 */
export interface McpProbeRequest {
  server: Partial<GlobalMcpServerConfig>
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
   * request-header events.
   *
   * Returns `undefined` until the Session has requested anything. This is how
   * the subagent-model interceptor recovers the route a delegation would have
   * inherited: the host's own child-option resolution uses the very same fold.
   */
  requestHeader():
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

/**
 * One complete provider/model/reasoning-effort route.
 *
 * The host appends a durable `model/selection` event for every choice, and step
 * preparation reads the latest one before it fixes the route the model request
 * must match.
 */
export interface ModelSelection {
  provider: string
  model: string
  reasoningEffort?: string
}

/** Agent-owned access to the model choice for future steps. */
export interface AgentModel {
  current(): Readonly<ModelSelection> | undefined
  select(selection: Readonly<ModelSelection>): void
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
  /**
   * The agent's own model selection.
   *
   * This is the only supported way to change a route. `agent/request` is
   * deprecated and the loop now rejects a request whose route differs from the
   * selection captured during step preparation.
   */
  readonly model?: AgentModel
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

/**
 * The domain form this plugin declares its two stores on.
 *
 * Structural rather than imported: the host package is not a dependency of this
 * plugin, and a value import would inline a second `zod` into the server
 * bundle. The shape below is the part of `DomainSpec` this plugin uses; the
 * host validates it at `open`.
 */
/**
 * One domain declaration, in the shape `defineDomain()` produces.
 *
 * The host helper validates a declaration at module load — the name against
 * `UNIT_NAME_RE`, the version against the non-negative-integer rule, the layout,
 * the compatible-version list, and that the global schema rejects `null` (a
 * nullable global would be indistinguishable from "never written" on reopen).
 * Passing a plain object to `open()` skips all of that and moves the same
 * failure to plugin activation, where it reads like a storage fault.
 */
export interface StorageDomainSpec {
  readonly name: string
  readonly version: number
  readonly layout?: 'single' | 'per-record'
  readonly compatibleVersions?: readonly number[]
  readonly invalidRecords?: 'backup-and-skip'
  readonly global?: { readonly schema: unknown; readonly initial: unknown }
  readonly tables: Record<string, { readonly valueSchema: unknown }>
}

/** One opened table: synchronous reads from memory, durable writes. */
export interface StorageDomainTable<V> {
  get(key: string): V | undefined
  entries(): IterableIterator<[string, V]>
  keys(): IterableIterator<string>
  readonly size: number
  put(key: string, value: V): Promise<void>
  delete(key: string): Promise<boolean>
}

/** One opened domain. */
export interface StorageDomain {
  readonly name: string
  readonly global: {
    get(): unknown
    set(value: unknown): Promise<void>
  }
  table<V>(name: string): StorageDomainTable<V>
  close(): Promise<void>
}

/** Data-form facility that opens declared domains. */
export interface StorageDomainFacility {
  open(spec: StorageDomainSpec): Promise<StorageDomain>
}

export interface LoaderEntry {
  id?: string
  name?: string
  target?: string
}

export interface LoaderService {
  entries?: Map<string, LoaderEntry>
  locate(fiber?: unknown): string | undefined
  /** Import one plugin module by specifier, resolved against the profile. */
  import(name: string): Promise<unknown>
  /** Normalize an ESM/CJS/default export shape into the plugin value. */
  unwrapExports(exports: unknown): unknown
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
  context(context: PromptContextInput): () => void
  getContextOrder(name: string): number
}

/**
 * Minimal view of `ctx.sandboxPolicy`.
 *
 * This service is the single owner of the per-call policy: consumers ask it for
 * the session's mode and roots instead of deriving either themselves.
 *
 * The plugin reads the mode and registers writable roots; it does NOT wrap
 * `resolve()`. The host folds active registrations into every policy it hands
 * out, so wrapping would add a second, competing copy of the same decision.
 */
export interface SandboxPolicyServiceLike {
  /** The absolute fallback root for calls without a session cwd. */
  readonly workspaceRoot: string
  /** The deployment default, the fallback beneath a session override. */
  readonly defaultMode: string
  /**
   * The session's last logged `sandbox/mode` override, or `undefined` without
   * one — i.e. before the deployment default is applied.
   */
  overrideOf(session: unknown): string | undefined
  /**
   * Permit writes under one directory in THIS Session's future
   * `workspace-write` operations, until the returned disposer runs.
   */
  registerWritableRoot(session: Session, directory: string): () => void
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
  /**
   * Variables interpolated into section text. The host attaches TOOLS to the
   * presentation after this waterfall runs, from the tool registry, so an
   * assembly never carries a tool list.
   */
  variables: Record<string, string | undefined>
}

export interface AssembleContext {
  scope?: unknown
  agent?: Agent
  signal?: AbortSignal
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
     * The sandbox policy owner.
     *
     * The plugin registers the session's extra writable roots on it and reads
     * the effective mode back; it never wraps the service.
     */
    sandboxPolicy?: SandboxPolicyServiceLike
    /**
     * Schema-validated durable stores.
     *
     * Required, not optional: the host mounts it in every base profile, rooted
     * at `$DSH_HOME/storages`. Declaring it optional only hid the fact that a
     * composition without it cannot serve this plugin at all.
     */
    storageDomain: StorageDomainFacility
  }

  interface Events {
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

    'agent/created'(payload: {
      agent: Agent
      source: unknown
      signal?: AbortSignal
    }): undefined | Promise<undefined>

    /**
     * Waterfall around one proposed step. The loop has ALREADY captured the
     * step's model selection by the time this runs; a listener that wants to
     * change the route must record it here and still only affects the next
     * step unless it is prepended before preparation.
     */
    'agent/pre-step'(
      payload: {
        agent: Agent
        messages: unknown[]
        turn: number
        step: number
        signal: AbortSignal
        modelSelection: Readonly<ModelSelection>
      },
      next: () => Promise<unknown>,
    ): Promise<unknown>

    'agent/disposed'(payload: { agent: Agent }): void
  }
}
