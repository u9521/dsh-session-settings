import type { SessionSettingsConfig } from '../../types.ts'

export interface ModelReasoningEffort {
  id: string
  name: string
  description?: string
}

export interface ModelReasoning {
  efforts: ModelReasoningEffort[]
  defaultEffort?: string
}

/**
 * One model the catalog offers.
 *
 * The host's `ModelCatalogModel` (`@deepseek-ai/dsh-api-session-controller`)
 * carries `badge` besides these fields; this view is field-for-field
 * compatible, and it is the minimum the selection UI reads.
 */
export interface ModelCatalogItem {
  id: string
  name: string
  description?: string
  reasoning?: ModelReasoning
  badge?: unknown
}

export interface ModelProviderGroup {
  id: string
  name: string
  models: ModelCatalogItem[]
}

/**
 * One provider whose catalog could not be read.
 *
 * The host types this as `ModelCatalogFailure` (provider id + message); the
 * previous hand-rolled `unknown[]` discarded the reason, so a partially
 * available catalog could not explain itself.
 */
export interface ModelCatalogFailure {
  provider?: string
  message?: string
  [key: string]: unknown
}

/** The host's `ModelCatalog` value, as the selection UI consumes it. */
export interface ModelCatalog {
  default?: { provider?: string; model?: string; reasoningEffort?: string }
  routableProviders?: string[]
  groups: ModelProviderGroup[]
  failures?: ModelCatalogFailure[]
}

/**
 * The host's `RemoteResult<ModelCatalog>` envelope.
 *
 * `error` is a `RemoteError` instance on the wire, not a plain object: it
 * carries `code`, `details`, and `isDSHRemoteError`. Reading only `message` is
 * safe for either shape.
 */
export type ModelCatalogResult =
  | { ok: true; value: ModelCatalog }
  | { ok: false; error: { code?: string; message?: string; details?: unknown } }

export interface ClientRemoteSessionService {
  modelCatalog?: () => Promise<ModelCatalogResult>
  [key: string]: unknown
}

export interface ClientRemoteServiceRef {
  session?: ClientRemoteSessionService
  [key: string]: unknown
}

export interface WorkspaceInfo {
  id?: string
  workspaceId?: string
  name?: string
  title?: string
  path?: string
  cwd?: string
  sessionIds?: string[]
  /** Host record timestamps; `createdAt` seeds the recency ranking for an empty workspace. */
  createdAt?: string
  updatedAt?: string
}

export interface SessionInfo {
  id?: string
  title?: string
  cwd?: string
  parentId?: string
  /** List ordering key; the workspace recency ranking reads it. */
  updatedAt?: number
  /** Local retention counts by consumer source; `mainView` marks the shown session. */
  retainedBy?: { mainView?: number }
}

/**
 * The session list snapshot this plugin reads.
 *
 * "Which session the main view shows" is `byId[id].retainedBy.mainView`; there
 * is no separate current-id field on the host's `SessionListState`.
 */
export interface SessionsState {
  byId?: Record<string, SessionInfo>
}

/**
 * The workspace list snapshot this plugin reads.
 *
 * "Most recently active workspace" is derived from member-session `updatedAt`
 * (see `resolveRecentWorkspaceId`); the host's snapshot carries no recency id.
 */
export interface WorkspacesState {
  items?: WorkspaceInfo[]
}

export type UseSessionsHook = (
  selector?: (state: SessionsState) => unknown,
) => unknown
export type UseWorkspacesHook = (
  selector?: (state: WorkspacesState) => unknown,
) => unknown

export interface ClientPageProps {
  remote?: ClientRemoteServiceRef
  t: (key: string, vars?: Record<string, string | number>) => string
  sessionId?: string
  sessionTitle?: string
  workspaceId?: string
  workspaceTitle?: string
  useSessions?: UseSessionsHook
  useWorkspaces?: UseWorkspacesHook
  onClose?: () => void
  onSave?: (config: SessionSettingsConfig) => void
}

export type NavSection = 'model' | 'mcp' | 'skills' | 'sandbox'
