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

export interface ClientRemoteApi {
  get?: <T = unknown>(
    path: string,
    params?: Record<string, string | number | boolean>,
  ) => Promise<T>
  post?: <T = unknown>(path: string, body?: unknown) => Promise<T>
  delete?: <T = unknown>(path: string, body?: unknown) => Promise<T>
  invoke?: <T = unknown>(path: string, options?: RequestInit) => Promise<T>
  [key: string]: unknown
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
}

export interface SessionInfo {
  id?: string
  title?: string
  cwd?: string
  parentSession?: string
}

export interface SessionsState {
  items?: SessionInfo[]
  byId?: Record<string, SessionInfo>
  current?: string
}

export interface WorkspacesState {
  items?: WorkspaceInfo[]
  byId?: Record<string, WorkspaceInfo>
  recentWorkspaceId?: string
}

export type UseSessionsHook = (
  selector?: (state: SessionsState) => unknown,
) => unknown
export type UseWorkspacesHook = (
  selector?: (state: WorkspacesState) => unknown,
) => unknown

export interface ClientPageProps {
  api?: ClientRemoteApi
  remote?: ClientRemoteServiceRef
  t: (key: string, vars?: Record<string, string | number>) => string
  sessionId?: string
  sessionTitle?: string
  workspaceId?: string
  workspaceTitle?: string
  useSessions?: UseSessionsHook
  useWorkspaces?: UseWorkspacesHook
  workspaces?: {
    list?: () => WorkspaceInfo[]
    resolveByPath?: (path: string) => Promise<WorkspaceInfo | undefined>
  }
  onClose?: () => void
  onSave?: (config: SessionSettingsConfig) => void
}

export type NavSection = 'model' | 'mcp' | 'skills'
