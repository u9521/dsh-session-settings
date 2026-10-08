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
  /**
   * Local retention counts by consumer source. DSH 0.2.0 expresses "the session
   * the main view is showing" here (`mainView`), not as a `current` id.
   */
  retainedBy?: { mainView?: number }
}

export interface SessionsState {
  byId?: Record<string, SessionInfo>
  /**
   * Pre-0.2.0 session selection. DSH 0.2.0's `SessionListState` has no such
   * field — its equivalent fact is `byId[id].retainedBy.mainView`. Kept only as
   * a graceful fallback for an older host; never the primary read.
   */
  current?: string
}

export interface WorkspacesState {
  items?: WorkspaceInfo[]
  /**
   * Pre-0.2.0 "most recently active workspace". DSH 0.2.0's workspace snapshot
   * has no such field — recency is derived from member-session `updatedAt` (see
   * `resolveRecentWorkspaceId`). Kept only as a graceful fallback.
   */
  recentWorkspaceId?: string
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
