import type {
  SessionSettingsConfig,
  SubagentModelConfig,
  SubagentModelMode,
  SessionMcpConfig,
  SessionSkillsConfig,
} from '../../types.ts'

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

export interface ClientPageProps {
  api: any
  t: (key: string, vars?: Record<string, string | number>) => string
  sessionId?: string
  sessionTitle?: string
  workspaceId?: string
  workspaceTitle?: string
  useSessions?: any
  useWorkspaces?: any
  workspaces?: any
  onClose?: () => void
  onSave?: (config: SessionSettingsConfig) => void
}

export type NavSection = 'model' | 'mcp' | 'skills'
