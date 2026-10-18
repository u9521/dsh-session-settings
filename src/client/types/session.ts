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

export interface ModelCatalogItem {
  id: string
  name: string
  description?: string
  reasoning?: ModelReasoning
}

export interface ModelProviderGroup {
  id: string
  name: string
  models: ModelCatalogItem[]
}

export interface ClientRemoteSessionService {
  modelCatalog?: () => Promise<{
    ok?: boolean
    value?: {
      groups?: ModelProviderGroup[]
      failures?: unknown[]
    }
    error?: {
      code?: string
      message?: string
    }
  }>
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
